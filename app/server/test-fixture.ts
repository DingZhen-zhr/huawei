// TEST ONLY. Synthetic evidence; never import from production code.
import { KNOWLEDGE_BASE } from './contracts.ts';
export const testTask = { modelId: 'matebook-pro', scenario: '内容创作', platform: '小红书', goal: '评论咨询', withPrice: false, audience: '测试人群', customerQuote: '测试任务', buyingStage: '了解', identity: 'HUAWEI MateBook Pro / 2026 / 测试系统 / TEST-SKU / 测试屏幕', software: '待现场测试' };
export const testEvidence = { knowledgeBase: KNOWLEDGE_BASE, readOnly: true, conflicts: [], facts: [{ id: 'TEST-f1', claim: '测试接口事实', quote: '测试原文：存在测试接口', title: 'TEST ONLY', entryId: 'TEST-entry', location: 'TEST L1', date: '2026-10-18', identity: testTask.identity, conditions: '仅测试条件', knowledgeBase: KNOWLEDGE_BASE }], images: [] };
