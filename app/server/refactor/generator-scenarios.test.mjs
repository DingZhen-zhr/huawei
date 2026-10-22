import assert from 'node:assert/strict';
import test from 'node:test';
import { getProduct, listProducts } from './ledger.mjs';
import { generatePlatformVariants, copyTextFor } from './generator.mjs';
import { verifyContent } from './verifier.mjs';
import { getSpec } from '../mcp/core.mjs';

const base = { product: getProduct('matebook-gt-14'), audience: '创作者', target: '私聊问配置' };
const a = { ...base, scene: '剪视频 / 整理素材', realDetail: '每天拍完课程要从相机导入素材，SD卡和移动硬盘经常一起插。' };
const c = { ...base, scene: '通勤 / 轻办公', realDetail: '每周背电脑坐地铁两小时，肩膀酸，只在咖啡店改课程脚本。' };
const platforms = ['xiaohongshu', 'moments', 'wechat-mp', 'poster', 'video'];

test('A/C change substantive copy, evidence, poster and shots across all eleven drafts', () => {
  let count = 0;
  for (const platform of platforms) {
    const media = generatePlatformVariants({ ...a, platform });
    const commute = generatePlatformVariants({ ...c, platform });
    assert.equal(media.length, ['xiaohongshu', 'moments', 'video'].includes(platform) ? 3 : 1);
    for (let i = 0; i < media.length; i++) {
      count++;
      const stripInput = (v) => copyTextFor(v).replaceAll(a.realDetail.replace(/。$/, ''), '').replaceAll(c.realDetail.replace(/。$/, ''), '').replaceAll(a.scene, '').replaceAll(c.scene, '');
      assert.notEqual(stripInput(media[i]), stripInput(commute[i]), platform);
      assert.notDeepEqual(media[i].evidenceIds, commute[i].evidenceIds);
      assert.notDeepEqual(media[i].imagePlan, commute[i].imagePlan);
      assert.equal(verifyContent(copyTextFor(media[i]), base.product.id, { platform }).status, 'ready');
      assert.equal(verifyContent(copyTextFor(commute[i]), base.product.id, { platform }).status, 'ready');
    }
    if (platform === 'poster') {
      assert.notEqual(media[0].title, commute[0].title);
      assert.match(media[0].body, /SD卡/);
      assert.match(commute[0].body, /1.49 kg/);
      for (const draft of [media[0], commute[0]]) {
        for (const line of draft.body.split('\n')) assert.ok(draft.imagePlan[0].overlayText.includes(line), 'poster image repeats the current checked selling points');
      }
    }
    if (platform === 'video') {
      assert.match(media[0].shotList.join(' '), /SD|导卡|硬盘/);
      assert.match(commute[0].shotList.join(' '), /装包|背包|拿取/);
      for (const variants of [media, commute]) {
        assert.equal(new Set(variants.map((v) => v.shotList.join(' '))).size, 3);
        assert.equal(new Set(variants.map((v) => v.cta)).size, 3);
      }
    }
  }
  assert.equal(count, 11);
});

test('specific commuting detail overrides creator editing topic and explains why', () => {
  const [draft] = generatePlatformVariants({ ...a, realDetail: c.realDetail, platform: 'xiaohongshu' });
  assert.match(draft.body, /真实细节.*优先/);
  assert.match(draft.body, /1.49 kg/);
  assert.doesNotMatch(draft.title, /素材|导卡/);
});

test('three angles reorganize main evidence and actions beyond the opening', () => {
  for (const platform of ['xiaohongshu', 'moments', 'video']) {
    const variants = generatePlatformVariants({ ...a, platform });
    assert.equal(new Set(variants.map((v) => v.evidenceIds.join(','))).size, 3);
    assert.equal(new Set(variants.map((v) => v.cta)).size, 3);
    assert.equal(new Set(variants.map((v) => v.imagePlan[0].backgroundBrief)).size, 3);
  }
});

test('moments angles display different evidence in the actual short copy', () => {
  const variants = generatePlatformVariants({ ...a, platform: 'moments' });
  const visibleFacts = variants.map((draft) => draft.evidence.filter((fact) => draft.body.includes(String(fact.value))).map((fact) => fact.id));
  assert.ok(visibleFacts.every((facts) => facts.length > 0), 'each short draft displays complete supporting evidence');
  assert.equal(new Set(visibleFacts.map((facts) => facts.join(','))).size, 3, 'evidence differences must be visible in body, not only evidenceIds');
  assert.equal(new Set(variants.map((draft) => draft.body.split('\n')[0])).size, 3, 'each angle has a distinct visible heading');
});

test('moments angles show three distinct operations after narrative prefixes are removed', () => {
  for (const scenario of [a, c]) {
    const variants = generatePlatformVariants({ ...scenario, platform: 'moments' });
    const visibleActions = variants.map((draft) => draft.body.split('\n')[2].replace(/^(?:先展示实际阻碍|先列核对清单|顾客先说明任务并准备|顾客接着核对|完成前两步后)：/, ''));
    assert.equal(new Set(visibleActions).size, 3, 'all three visible operations differ beyond their narrative prefix');
  }
});

test('every import angle connects and checks recognition before opening the material directory', () => {
  for (const platform of ['video', 'xiaohongshu']) {
    for (const draft of generatePlatformVariants({ ...a, platform })) {
      const texts = platform === 'video' ? [draft.script, draft.shotList.join('\n')] : [draft.body];
      for (const text of texts) {
        const connection = text.indexOf('连接读卡设备与移动硬盘，检查设备识别状态');
        const directory = text.indexOf('打开素材目录');
        assert.ok(connection >= 0 && directory >= 0, 'both dependent actions must be visible');
        assert.ok(connection < directory, `${platform}/${draft.angle} must recognize devices before opening their files`);
        if (draft.angle === 'avoidance') {
          const checklist = text.indexOf('列出实际设备、接口与文件容量');
          assert.ok(checklist >= 0 && checklist < connection, 'avoidance starts with an actual equipment/interface/capacity checklist');
        }
      }
    }
  }
});

test('limited evidence is disclosed rather than inventing three visible claims', () => {
  const product = { ...base.product, facts: base.product.facts.filter((fact) => fact.id.endsWith(':portable:1')) };
  const variants = generatePlatformVariants({ ...c, product, platform: 'moments' });
  for (const draft of variants) {
    assert.match(draft.body, /可引用事实不足/);
    assert.ok(draft.body.includes(String(product.facts[0].value)));
    assert.equal(draft.evidence.length, 1);
    assert.equal(verifyContent(copyTextFor(draft), product.id, { platform: 'moments' }).status, 'ready');
  }
});

test('camera entities and postposed denials produce commuting shots rather than import actions', () => {
  for (const realDetail of ['每天通勤两小时肩膀酸，相机素材已经在云端，只改课程脚本。', '移动硬盘不用接，也不导卡，只在咖啡店改课程脚本。']) {
    for (const draft of generatePlatformVariants({ ...a, realDetail, platform: 'video' })) {
      assert.equal(draft.sceneStrategy.key, 'commute');
      const shotActions = draft.shotList.map((shot) => shot.split('；字幕引用：')[0]).join(' ');
      assert.doesNotMatch(shotActions, /导卡|SD卡|移动硬盘/);
      assert.match(draft.shotList.join(' '), /装包|背包|拿取/);
      assert.equal(verifyContent(copyTextFor(draft), base.product.id, { platform: 'video' }).status, 'ready');
    }
  }
});

test('all ten real products keep their own facts and fallback, with counterfeit claims blocked', () => {
  for (const publicProduct of listProducts()) {
    const product = getProduct(publicProduct.id);
    for (const scenario of [a, c, { scene: '论文PPT教室', realDetail: '写论文并准备PPT，到教室接投影。' }, { scene: '项目工作集', realDetail: '多个软件同时打开项目文件。' }, { scene: '日常', realDetail: '想先了解一下电脑。' }]) {
      for (const platform of platforms) {
        for (const draft of generatePlatformVariants({ ...c, ...scenario, product, platform })) {
          assert.equal(verifyContent(copyTextFor(draft), product.id, { platform }).status, 'ready', `${product.id}/${platform}`);
          assert.ok(draft.evidence.every((fact) => fact.productId === product.id));
          assert.equal(draft.imagePlan[0].productAssetId, product.id);
          const imageShape = { xiaohongshu: [3, 1080, 1440], moments: [1, 1080, 1080], 'wechat-mp': [1, 900, 383], poster: [1, 1242, 1656], video: [1, 1080, 1920] }[platform];
          assert.equal(draft.imagePlan.length, imageShape[0]);
          assert.ok(draft.imagePlan.every((image) => image.width === imageShape[1] && image.height === imageShape[2]));
          if (platform !== 'video') {
            const limits = getSpec(platform).limits;
            assert.ok([...draft.body].length >= limits.bodyMin && [...draft.body].length <= limits.bodyMax, `${product.id}/${platform}: ${draft.body.length} outside ${limits.bodyMin}-${limits.bodyMax}`);
            assert.ok([...draft.title].length >= limits.titleMin && [...draft.title].length <= limits.titleMax, `${platform} title length`);
          }
        }
      }
    }
    if (product.id === 'matebook-d-14') assert.equal(product.asset, null);
    assert.equal(verifyContent('49 kg，赠品汽车，4999元', product.id).status, 'blocked');
  }
});
