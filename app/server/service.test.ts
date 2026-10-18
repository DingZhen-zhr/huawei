import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from './service.ts';
import { KNOWLEDGE_BASE } from './contracts.ts';
import { testEvidence, testTask } from './test-fixture.ts';
const config = { imaUrl: 'https://ima.test', imaKey: 'TEST-IMA-SECRET', modelUrl: 'https://model.test/v1', modelKey: 'TEST-MODEL-SECRET', model: 'TEST-model' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function mock(evidence: unknown = testEvidence, brokenDraft = false, calls: string[] = [], draftPatch: Record<string, unknown> = {}): typeof fetch {
  return async (input, options) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/status')) return json({ knowledgeBase: KNOWLEDGE_BASE, authenticated: true, readOnly: true });
    if (url.endsWith('/search') || url.endsWith('/browse')) return json(evidence);
    const payload = JSON.parse(String(options?.body));
    const probe = payload.messages[0].content.includes('ready');
    return json({ choices: [{ message: { content: JSON.stringify(probe ? { ready: true } : { title: '测试草稿', titleFactIds: ['TEST-f1'], cta: '评论咨询', ctaFactIds: [], tags: [], segments: [{ text: '测试接口事实（仅测试条件）', factIds: [brokenDraft ? 'UNKNOWN' : 'TEST-f1'] }], ...draftPatch }) } }] });
  };
}
test('missing credentials blocks without any upstream calls', async () => {
  const service = createService({}, async () => { throw new Error('Must not call'); });
  assert.equal((await service.status()).knowledgeBase.status, 'unconfigured');
  assert.equal((await service.generate({ task: testTask })).code, 503);
});
test('upstream error bodies and credentials never reach responses', async () => {
  const service = createService(config, async () => json({ error: 'TEST-IMA-SECRET TEST-MODEL-SECRET' }, 401));
  const result = JSON.stringify(await service.generate({ task: testTask }));
  assert.doesNotMatch(result, /TEST-IMA-SECRET|TEST-MODEL-SECRET/);
  assert.match(result, /503/);
});
test('valid TEST evidence only yields unverified draft and missing-image warning', async () => {
  const response = await createService(config, mock()).generate({ task: testTask });
  assert.equal(response.code, 200); assert.equal(response.result.status, 'draft');
  assert.equal(response.result.verification?.status, 'pending-human-review');
  assert.ok(response.result.issues.some(issue => issue.includes('图片不足')));
});
test('identity mismatch, conflicts and absent original text block', async () => {
  for (const evidence of [
    { ...testEvidence, facts: [{ ...testEvidence.facts[0], identity: 'OTHER MODEL' }] },
    { ...testEvidence, conflicts: ['TEST conflict'] },
    { ...testEvidence, facts: [{ ...testEvidence.facts[0], quote: '' }] },
  ]) assert.equal((await createService(config, mock(evidence)).generate({ task: testTask })).code, 422);
});
test('zero search hits perform directory fallback', async () => {
  const calls: string[] = []; const base = mock(testEvidence, false, calls);
  const fetcher: typeof fetch = async (input, options) => String(input).endsWith('/search') ? (calls.push(String(input)), json({ ...testEvidence, facts: [] })) : base(input, options);
  assert.equal((await createService(config, fetcher).generate({ task: testTask })).code, 200);
  assert.ok(calls.some(url => url.endsWith('/browse')));
});
test('unknown factual IDs and price request cannot pass', async () => {
  assert.equal((await createService(config, mock(testEvidence, true)).generate({ task: testTask })).code, 502);
  assert.equal((await createService(config, mock()).generate({ task: { ...testTask, withPrice: true } })).code, 422);
});
test('current verified same-SKU price returns explicit calculation; stale price blocks', async () => {
  const priceQuote = { ...testEvidence.facts[0], location: 'P1/08 L1', quote: 'TEST-SKU 单价 100', sku: 'TEST-SKU', quantity: 3, unitPrice: 100, currency: 'CNY', channel: 'TEST渠道', currentVerified: true, currentVerifiedAt: new Date().toISOString() };
  const service = createService(config, mock({ ...testEvidence, priceQuote }));
  const result = await service.generate({ task: { ...testTask, withPrice: true } });
  assert.equal(result.code, 200); assert.equal(result.result.priceQuote?.total, 300);
  assert.match(result.result.body!, /100\.00 × 3 = ¥300\.00/);
  const stale = createService(config, mock({ ...testEvidence, priceQuote: { ...priceQuote, currentVerifiedAt: '2020-01-01' } }));
  assert.equal((await stale.generate({ task: { ...testTask, withPrice: true } })).code, 422);
});
test('server rejects unsupported scene, ambiguous goal and incomplete identity', async () => {
  for (const changes of [{ scenario: '不支持场景' }, { goal: '评论和到店' }, { identity: 'Pro' }]) {
    assert.equal((await createService({}, mock()).generate({ task: { ...testTask, ...changes } })).code, 422);
  }
});
test('even successful upstream responses cannot echo either server credential', async () => {
  const service = createService(config, mock({ ...testEvidence, facts: [{ ...testEvidence.facts[0], quote: config.modelKey }] }));
  const result = await service.generate({ task: testTask });
  assert.equal(result.code, 502); assert.doesNotMatch(JSON.stringify(result), /TEST-MODEL-SECRET/);
});
test('conflict block retains both original excerpts, identities, dates and source locations', async () => {
  const left = { ...testEvidence.facts[0], title: '左侧资料', quote: '左侧原文片段', identity: '左侧身份', date: '2026-10-17', location: '左侧L1' };
  const right = { ...testEvidence.facts[0], title: '右侧资料', quote: '右侧原文片段', identity: '右侧身份', date: '2026-10-18', location: '右侧L2' };
  const response = await createService(config, mock({ ...testEvidence, conflicts: [{ reason: '型号与重量不一致', left, right }] })).generate({ task: testTask });
  assert.equal(response.code, 422);
  const details = response.result.issues.join('\n');
  for (const text of ['左侧原文片段', '右侧原文片段', '左侧身份', '右侧身份', '2026-10-17', '2026-10-18', '左侧L1', '右侧L2', '左侧资料', '右侧资料']) assert.ok(details.includes(text));
  const calls: string[] = [];
  const emptyFacts = await createService(config, mock({ ...testEvidence, facts: [], conflicts: [{ left, right }] }, false, calls)).generate({ task: testTask });
  assert.equal(emptyFacts.code, 422); assert.ok(!calls.some(url => url.endsWith('/browse')));
});
test('conflict source secret is never surfaced and oversized snippets are bounded', async () => {
  const evidence = { ...testEvidence, conflicts: [{ left: { ...testEvidence.facts[0], quote: config.imaKey }, right: testEvidence.facts[0] }] };
  const response = await createService(config, mock(evidence)).generate({ task: testTask });
  assert.equal(response.code, 502); assert.doesNotMatch(JSON.stringify(response), /TEST-IMA-SECRET/);
  const bounded = await createService(config, mock({ ...testEvidence, conflicts: [{ left: { quote: '原'.repeat(10000) }, right: {} }] })).generate({ task: testTask });
  assert.equal(bounded.code, 422); assert.ok(JSON.stringify(bounded).length < 2000);
});
test('title and CTA each require valid mappings except pure action CTA', async () => {
  for (const patch of [{ titleFactIds: [] }, { titleFactIds: ['UNKNOWN'] }, { cta: '评论领取最低价', ctaFactIds: [] }, { ctaFactIds: ['UNKNOWN'] }]) {
    assert.equal((await createService(config, mock(testEvidence, false, [], patch)).generate({ task: testTask })).code, 502);
  }
  const response = await createService(config, mock(testEvidence, false, [], { cta: '测试接口可现场核对', ctaFactIds: ['TEST-f1'] })).generate({ task: testTask });
  assert.equal(response.code, 200);
  assert.deepEqual(response.result.titleFactIds, ['TEST-f1']);
  assert.deepEqual(response.result.ctaFactIds, ['TEST-f1']);
  assert.deepEqual(response.result.claimChecks?.map(check => check.section), ['title', 'body', 'cta']);
  assert.ok(response.result.claimChecks?.every(check => check.status === 'pending-human-review'));
  const pure = await createService(config, mock()).generate({ task: testTask });
  assert.equal(pure.code, 200); assert.deepEqual(pure.result.ctaFactIds, []);
});
test('entry model must match precise identity even when gateway echoes the mismatched identity', async () => {
  for (const identity of [testTask.identity.replace('MateBook Pro', 'MateBook Pro S'), testTask.identity.replace('MateBook Pro', 'MateBook 14'), `${testTask.identity} / MateBook Pro S`]) {
    const evidence = { ...testEvidence, facts: [{ ...testEvidence.facts[0], identity }] };
    const result = await createService(config, mock(evidence)).generate({ task: { ...testTask, identity } });
    assert.equal(result.code, 422); assert.match(result.result.issues.join(), /精确型号名称/);
  }
});
test('complete image package separates actual issues from mandatory human-review reminders', async () => {
  const images = [1, 2, 3].map(index => ({ ...testEvidence.facts[0], id: `TEST-image-${index}`, filename: `TEST-${index}.png`, url: `https://image.test/TEST-${index}.png` }));
  const result = await createService(config, mock({ ...testEvidence, images })).generate({ task: testTask });
  assert.equal(result.code, 200);
  assert.deepEqual(result.result.issues, []);
  assert.equal(result.result.verification?.status, 'pending-human-review');
  assert.ok(result.result.verification?.issues.some(issue => issue.includes('逐句核对')));
  assert.ok(result.result.verification?.issues.some(issue => issue.includes('图片画面身份')));
  const missing = await createService(config, mock()).generate({ task: testTask });
  assert.ok(missing.result.issues.some(issue => issue.includes('图片不足')));
  assert.ok(missing.result.verification?.issues.some(issue => issue.includes('图片不足')));
});
