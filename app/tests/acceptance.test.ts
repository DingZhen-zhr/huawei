import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingFields, platformIssues, canExport, exportDocument } from '../src/lib/workflow.ts';
import { createService } from '../server/service.ts';

// Synthetic contract fixtures only. These are NOT ima retrievals, model runs,
// publishable manuscripts, or evidence that the live business loop passed.
const scenarios = ['开学季', '职场办公', '内容创作', '家庭换新', '企业采购', '门店到访', '新品首发', '节日营销'];
const platforms = ['小红书', '公众号', '门店朋友圈', '门店海报'];
const ranges: Record<string, [number, number]> = { 小红书: [3, 6], 公众号: [2, 4], 门店朋友圈: [1, 3], 门店海报: [1, 1] };
const validBody = (platform: string) => platform === '公众号'
  ? Array.from({ length: 5 }, (_, i) => `## 合成章节${i + 1}\n${'文'.repeat(250)}`).join('\n')
  : platform === '门店朋友圈' ? '文'.repeat(100)
  : platform === '小红书' ? '仅用于合同测试的短段落。\n#合成测试'
  : '- 合成卖点一\n- 合成卖点二\n条件：仅合同测试';
const task = (scenario = '内容创作', platform = '小红书', modelId = 'matebook-pro') => ({
  modelId, scenario, platform, audience: '已确认的摄影顾问客户',
  customerQuote: '希望带自己的课程素材到店检查工作流',
  identity: modelId === 'matebook-pro-s' ? 'HUAWEI MateBook Pro S 2026 鸿蒙6.1 标准屏 24GB/1TB' : 'HUAWEI MateBook Pro 2026 鸿蒙6.1 标准屏 24GB/1TB',
  software: '用户确认：先现场检查必装软件，当前未实测', buyingStage: '比较选型',
  goal: '评论咨询', withPrice: false,
});
const blocked = (message: string) => ({ ok: false, status: 'blocked', message, issues: [message] });

for (const scenario of scenarios) {
  for (const platform of platforms) {
    test(`synthetic blocked matrix: ${scenario} × ${platform}`, async () => {
      const input = task(scenario, platform);
      const output = exportDocument(input, blocked('合成测试：未配置 ima，未调用模型'), 1, false);
      assert.equal((output.match(/^## /gm) || []).length, 4, 'must preserve four output areas');
      assert.match(output, /不可发布/, 'missing sources must remain a marked draft');
      assert.ok(output.includes(platform), 'export must retain task platform');
      assert.ok(output.includes(scenario), 'export must retain task scenario');
      assert.doesNotMatch(output, /✅/, 'blocked synthetic samples must never claim success');
      assert.equal(canExport(['未配置 ima'], true, false), false);
      const service = createService({}, async () => { throw new Error('Unconfigured service must not call a network'); });
      const response = await service.generate({ task: input });
      assert.equal(response.code, 503);
      assert.equal(response.result.status, 'blocked');
      assert.equal(response.result.body, undefined);
      const [min, max] = ranges[platform];
      const title = '合成测试专用标题不构成产品主张';
      assert.deepEqual(platformIssues(platform, title, validBody(platform), min), []);
      assert.ok(platformIssues(platform, title, validBody(platform), min - 1).some(issue => /缺图|超限/.test(issue)));
      assert.ok(platformIssues(platform, title, validBody(platform), max + 1).some(issue => /缺图|超限/.test(issue)));
    });
  }
}

const suggestedSamples = [
  { name: '首篇：Pro × 内容创作 × 小红书', input: task(), reason: '合成样张：缺少3张已核验ima图' },
  { name: '同型号换职场场景', input: task('职场办公'), reason: '合成样张：ima尚未连接' },
  { name: '首篇转公众号', input: task('内容创作', '公众号'), reason: '合成样张：模型请求失败' },
  { name: '首篇转朋友圈', input: task('内容创作', '门店朋友圈'), reason: '合成样张：来源存在冲突' },
  { name: '首篇转海报', input: task('内容创作', '门店海报'), reason: '合成样张：主视觉加载失败' },
  { name: 'Pro S 身份隔离', input: task('内容创作', '小红书', 'matebook-pro-s'), reason: '合成样张：图片身份待核验' },
];
for (const sample of suggestedSamples) {
  test(`reproducible synthetic sample: ${sample.name}`, () => {
    const result = blocked(sample.reason);
    const first = exportDocument(sample.input, result, 1, false);
    const repeated = exportDocument(sample.input, result, 1, false);
    assert.equal(first, repeated, 'same snapshot must produce identical export');
    assert.ok(first.includes(sample.reason), 'export must preserve actual blocking reason');
    assert.match(first, /不可发布/);
    assert.doesNotMatch(first, /✅/);
    assert.equal(canExport(result.issues, true, false), false);
  });
}

test('negative: incomplete audience, customer task, identity, and goal require questions', () => {
  const incomplete = { ...task(), audience: '', customerQuote: '', identity: '轻薄本', goal: '' };
  assert.ok(missingFields(incomplete).length >= 4);
});

// Controlled fake transport. The reserved .test hosts are never contacted.
const syntheticConfig = { imaUrl: 'https://synthetic-ima.test', imaKey: 'synthetic-ima-key', modelUrl: 'https://synthetic-model.test', modelKey: 'synthetic-model-key', model: 'synthetic-model' };
const kb = '任德耀新建华为PC知识库';
function fakeTransport(options: { fallback?: boolean; conflict?: boolean; wrongIdentity?: boolean; noQuote?: boolean; badClaimId?: boolean; modelFailure?: boolean; missingImages?: boolean } = {}) {
  const paths: string[] = [];
  const input = task();
  const source = { id: 'synthetic-f1', title: '合成合同资料，不是真实产品依据', entryId: 'synthetic-entry', location: '合成第1行', date: '2026-10-18', identity: options.wrongIdentity ? '另一型号' : input.identity, conditions: '仅合成测试', knowledgeBase: kb };
  const evidence = { knowledgeBase: kb, readOnly: true, facts: [{ ...source, claim: '合成事实', quote: options.noQuote ? '' : '合成原文' }], images: options.missingImages ? [] : [1, 2, 3].map(n => ({ ...source, id: `synthetic-image-${n}`, filename: `synthetic-${n}.png`, url: `https://image.test/${n}.png` })), conflicts: options.conflict ? ['合成冲突'] : [] };
  const fetcher: typeof fetch = async (url, init) => {
    const parsed = new URL(String(url)); paths.push(parsed.pathname);
    if (parsed.hostname === 'synthetic-ima.test') {
      if (parsed.pathname === '/status') return Response.json({ knowledgeBase: kb, authenticated: true, readOnly: true });
      if (parsed.pathname === '/search' && options.fallback) return Response.json({ facts: [] });
      if (parsed.pathname === '/search' || parsed.pathname === '/browse') return Response.json(evidence);
    }
    if (parsed.hostname === 'synthetic-model.test') {
      const payload = JSON.parse(String(init?.body));
      const probe = payload.messages[0].content.includes('Return JSON only');
      if (!probe && options.modelFailure) return new Response('synthetic failure', { status: 503 });
      const content = probe ? { ready: true } : { title: '合成标题', titleFactIds: [source.id], segments: [{ text: '合成正文，仅验证合同。', factIds: [options.badClaimId ? 'unknown-id' : source.id] }], cta: input.goal, ctaFactIds: [], tags: ['#合成测试'] };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
    }
    throw new Error('Unexpected fake request');
  };
  return { fetcher, paths };
}

test('synthetic empty search falls back to browse and remains pending human review', async () => {
  const fake = fakeTransport({ fallback: true });
  const response = await createService(syntheticConfig, fake.fetcher).generate({ task: task() });
  assert.equal(response.code, 200);
  assert.ok(fake.paths.indexOf('/browse') > fake.paths.indexOf('/search'));
  assert.equal(response.result.status, 'draft');
  assert.equal(response.result.verification?.status, 'pending-human-review');
  assert.deepEqual(response.result.issues, []);
  assert.ok(response.result.verification!.issues.length > 0, 'human reminders stay separate from blockers');
  assert.equal(canExport(response.result.issues, false, false), false);
  assert.equal(canExport(response.result.issues, true, false), true, 'human approval may unlock an otherwise valid current version');
});

for (const [name, options, expected] of [
  ['source conflict', { conflict: true }, 422],
  ['wrong product identity', { wrongIdentity: true }, 422],
  ['missing original quote', { noQuote: true }, 422],
  ['unknown claim mapping', { badClaimId: true }, 502],
  ['model unavailable', { modelFailure: true }, 502],
] as const) {
  test(`synthetic service negative: ${name}`, async () => {
    const fake = fakeTransport(options);
    const response = await createService(syntheticConfig, fake.fetcher).generate({ task: task() });
    assert.equal(response.code, expected);
    assert.equal(response.result.status, 'blocked');
    assert.equal(response.result.body, undefined);
  });
}

test('synthetic missing images cannot become a publishable sample', async () => {
  const fake = fakeTransport({ missingImages: true });
  const response = await createService(syntheticConfig, fake.fetcher).generate({ task: task() });
  assert.equal(response.code, 200);
  assert.ok(response.result.issues.some(issue => issue.includes('图片不足')));
  assert.equal(canExport(response.result.issues, true, false), false);
  assert.match(exportDocument(task(), response.result, 1, false), /不可发布/);
});

test('synthetic price request stays blocked without verified current P1/08 pricing', async () => {
  const fake = fakeTransport();
  const response = await createService(syntheticConfig, fake.fetcher).generate({ task: { ...task(), withPrice: true } });
  assert.equal(response.code, 422);
  assert.equal(response.result.status, 'blocked');
  assert.match(response.result.message, /价格/);
});

test('negative: multiple conversion goals require clarification', () => {
  assert.ok(missingFields({ ...task(), goal: '私信咨询与到店体验' }).length > 0);
});

test('negative: any source, image, compliance, or price issue blocks formal export', () => {
  for (const issue of ['无依据补贴', 'Pro/Pro S 混参', '图片型号不一致', '缺图', '来源冲突', '历史价格未复核', '虚构亲测']) {
    assert.equal(canExport([issue], true, false), false, issue);
    assert.match(exportDocument(task(), blocked(issue), 2, false), /不可发布/);
  }
});

test('negative: stale and unreviewed revisions cannot become formal exports', () => {
  assert.equal(canExport([], false, false), false);
  assert.equal(canExport([], true, true), false);
  assert.equal(canExport(['缺图'], true, true), false);
});

test('platform character boundaries are enforced for moments and poster', () => {
  assert.equal(platformIssues('门店朋友圈', '合成标题', '文'.repeat(80), 1).length, 0);
  assert.equal(platformIssues('门店朋友圈', '合成标题', '文'.repeat(180), 3).length, 0);
  assert.ok(platformIssues('门店朋友圈', '合成标题', '文'.repeat(79), 1).length > 0);
  assert.ok(platformIssues('门店朋友圈', '合成标题', '文'.repeat(181), 1).length > 0);
  assert.ok(platformIssues('门店海报', '短标题', '仅合成测试', 1).length > 0);
  assert.ok(platformIssues('门店海报', '文'.repeat(23), '仅合成测试', 1).length > 0);
});
