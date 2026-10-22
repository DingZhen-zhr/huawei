import assert from 'node:assert/strict';
import test from 'node:test';
import { getProduct, listProducts } from './ledger.mjs';

const strategy = await import('./scene-strategy.mjs').catch(() => ({}));
const product = getProduct('matebook-gt-14');
const base = { product, audience: '创作者', target: '私聊问配置' };
const a = { ...base, scene: '剪视频 / 整理素材', realDetail: '每天拍完课程要从相机导入素材，SD卡和移动硬盘经常一起插。' };
const c = { ...base, scene: '通勤 / 轻办公', realDetail: '每周背电脑坐地铁两小时，肩膀酸，只在咖啡店改课程脚本。' };

test('actual card import and commuting burden choose different fact orders', () => {
  assert.equal(typeof strategy.resolveScene, 'function', 'scene strategy is not implemented');
  const media = strategy.resolveScene(a);
  const commute = strategy.resolveScene(c);
  assert.equal(media.key, 'media-import');
  assert.equal(commute.key, 'commute');
  assert.match(media.evidence[0].value, /SD卡/, 'the import task shows the actual SD interface before generic USB facts');
  assert.match(commute.evidence[0].value, /1.49 kg/);
  assert.notDeepEqual(media.evidenceIds, commute.evidenceIds);
  const override = strategy.resolveScene({ ...a, realDetail: c.realDetail });
  assert.equal(override.key, 'commute');
  assert.match(override.explanation, /真实细节.*优先/);
});

test('negative tasks do not select media or commute; study and projects remain explicit', () => {
  assert.equal(typeof strategy.resolveScene, 'function');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '不导卡，不接硬盘，不通勤，不剪视频，只写论文PPT并带去教室。' }).key, 'study-documents');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '不导卡，不接硬盘，不通勤，不剪视频。' }).key, 'general');
  assert.equal(strategy.resolveScene({ ...base, scene: '项目工作集', realDetail: '同时打开多个软件和项目文件，核对内存存储。' }).key, 'multitask');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '电脑不接硬盘也不导卡，主要带去教室看论文。' }).key, 'study-documents');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '不用导卡只背电脑通勤。' }).key, 'commute');
  const denied = strategy.resolveScene({ ...base, scene: '剪视频 / 整理素材', realDetail: '不剪视频也不导卡，不接移动硬盘。' });
  assert.equal(denied.key, 'general');
  assert.match(denied.explanation, /待确认/);
});

for (const [label, realDetail] of [
  ['camera entity', '每天通勤两小时肩膀酸，相机素材已经在云端，只改课程脚本。'],
  ['postposed negation', '移动硬盘不用接，也不导卡，只在咖啡店改课程脚本。'],
]) {
  test(`commuting script work outranks ${label}`, () => {
    const result = strategy.resolveScene({ ...a, realDetail });
    assert.equal(result.key, 'commute');
    assert.match(result.evidence[0].value, /1.49 kg/);
    assert.doesNotMatch(result.actions.join(' '), /导卡|SD卡|移动硬盘/);
  });
}

test('a camera or hard drive entity alone does not establish an import action', () => {
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '桌上放着相机和移动硬盘。' }).key, 'general');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '每天整理素材，文件已经在云端。' }).key, 'general');
  assert.equal(strategy.resolveScene({ ...base, scene: '日常', realDetail: '把移动硬盘接到电脑，导入相机文件。' }).key, 'media-import');
});

test('every scene only organizes active facts from its own real product', () => {
  assert.equal(typeof strategy.resolveScene, 'function');
  for (const item of listProducts()) {
    const current = getProduct(item.id);
    for (const input of [a, c, { ...base, scene: '论文PPT教室', realDetail: '开文档接投影' }, { ...base, scene: '项目工作集', realDetail: '同时打开多个软件' }, { ...base, scene: '', realDetail: '' }]) {
      const selected = strategy.resolveScene({ ...input, product: current });
      assert.ok(selected.actions.length >= 3);
      for (const fact of selected.evidence) {
        assert.equal(fact.productId, current.id);
        assert.equal(fact.status, 'active');
        assert.notEqual(fact.field, 'price');
      }
    }
  }
});
