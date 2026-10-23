const base = 'http://127.0.0.1:5177';
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

const cases = [
  { name: '小红书·开学季', input: { product: 'MateBook 14 酷睿 Ultra', audience: '预算 5000 的大学新生', scenario: '开学季', platform: 'xhs' } },
  { name: '公众号·职场', input: { product: 'HUAWEI MateBook Pro', audience: '经常出差的商务人士', scenario: '职场办公', platform: 'wechat' } },
  { name: '朋友圈·门店', input: { product: 'HUAWEI MateBook Fold 非凡大师', audience: '附近想换本的顾客', scenario: '门店到访', platform: 'moments' } },
  { name: '海报·新品', input: { product: 'MateBook D 16', audience: '到店顾客', scenario: '新品首发', platform: 'poster' } },
  { name: '缺参数', input: { product: 'MateBook D 14', platform: 'xhs' } },
  { name: '注入违规', input: { product: 'MateBook 14 酷睿 Ultra', audience: '大学新生', scenario: '开学季', platform: 'xhs', __stress: true } },
];

for (const c of cases) {
  const r = await post('/api/generate', c.input);
  if (!r.ok) { console.log(`\n[${c.name}] 追问 ${r.questions.length} 条 → ${r.questions[0].slice(0, 30)}…`); continue; }
  console.log(`\n[${c.name}]`);
  console.log('  标题:', r.draft.title || '(无标题)');
  console.log('  结构:', r.strategy.structure, '| 图数:', r.draft.images.length, '| 事实断言:', r.checks.facts.claims.length, '| 未核实:', r.checks.facts.failCount);
  console.log('  合规:', r.checks.compliance.length ? r.checks.compliance.map(x => x.type).join(',') : '通过');
  console.log('  依据:', r.sources.map(s => s.fact).join(' / '));
  if (r.checks.pending.length) console.log('  待确认:', r.checks.pending.join('；'));
  console.log('  首段:', (r.draft.lead || r.draft.body[0].text).slice(0, 70));
}
