import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingFields, platformIssues, canExport, exportDocument } from '../src/lib/workflow.ts';

test('ambiguous identity and multi-goal require clarification', () => {
  assert.ok(missingFields({ modelId:'matebook-pro', scenario:'内容创作', platform:'小红书', audience:'摄影师', customerQuote:'处理照片', identity:'轻薄本', software:'待确认', buyingStage:'比较', goal:'私信与到店', withPrice:false }).length >= 2);
});
test('platform image limits and actual length are enforced', () => {
  assert.ok(platformIssues('小红书','标题','正文',0).length > 0);
  assert.ok(platformIssues('门店朋友圈','标题','太短',1).length > 0);
  assert.equal(platformIssues('门店朋友圈','标题','文'.repeat(100),1).length,0);
});
test('stale or unreviewed manuscripts cannot be formally exported', () => {
  assert.equal(canExport([],false,false),false);
  assert.equal(canExport([],true,true),false);
  assert.equal(canExport(['缺图'],true,false),false);
  assert.equal(canExport([],true,false),true);
});
test('blocked export contains exactly four areas and honest draft mark', () => {
  const task={modelId:'matebook-pro',scenario:'内容创作',platform:'小红书',audience:'摄影师',customerQuote:'处理照片',identity:'2026 鸿蒙版 标准屏 24GB',software:'待测',buyingStage:'比较',goal:'评论咨询',withPrice:false};
  const text=exportDocument(task,{ok:false,status:'blocked',message:'未连接',issues:['缺凭证']},1,false);
  assert.equal((text.match(/^## /gm)||[]).length,4);
  assert.match(text,/不可发布/);
  assert.doesNotMatch(text,/✅/);
});
