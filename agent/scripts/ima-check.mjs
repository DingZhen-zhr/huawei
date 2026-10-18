// ima 共享知识库接入自检:对应手册第六节 A-D 四步。
// 用法: node agent/scripts/ima-check.mjs [检索关键词]
// 凭证只从环境变量或 agent/.env 读取,输出中不打印任何凭证。
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const agentDir = join(here, '..');
const cacheDir = join(agentDir, '.cache');
mkdirSync(cacheDir, { recursive: true });

// 读取 .env(不覆盖已存在的环境变量)
const envFile = join(agentDir, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// 官方 ima Skill 统一调用脚本;更新检查的时间戳也放在当前目录
const skillApi = join(agentDir, '..', 'ima-skills-1.1.10', 'ima-skill', 'ima_api.cjs');
const { imaApi } = createRequire(import.meta.url)(skillApi);
const lastCheckFile = join(cacheDir, 'last_update_check');

async function ima(path, body) {
  const text = await imaApi(path, body, { lastCheckFile });
  try { return JSON.parse(text); } catch { return { code: -1, msg: 'non-JSON response', raw: text.slice(0, 200) }; }
}

const kbName = process.env.IMA_KB_NAME || '任德耀新建华为PC知识库';
const query = process.argv[2] || 'MateBook Pro S';
const report = { kbName, steps: {} };
const ok = (r) => r && r.code === 0;

try {
  // A. 按名称查知识库
  const a = await ima('openapi/wiki/v1/search_knowledge_base', { query: kbName, cursor: '', limit: 20 });
  const first = a.data?.info_list?.[0];
  const kbId = first?.id ?? first?.kb_id;
  report.steps.A_search_knowledge_base = { code: a.code, msg: a.msg, found: !!kbId, name: first?.name ?? first?.kb_name };
  if (!ok(a) || !kbId) throw new Error(`A 失败:${a.msg || '未找到知识库,请确认已用同一账号扫码加入'}`);

  // B. 浏览根目录并翻页统计条目数
  let cursor = '', total = 0, pages = 0, rootSample = [];
  do {
    const b = await ima('openapi/wiki/v1/get_knowledge_list', { knowledge_base_id: kbId, cursor, limit: 50 });
    if (!ok(b)) throw new Error(`B 失败:${b.msg}`);
    const items = b.data?.knowledge_list ?? [];
    total += items.length; pages++;
    if (pages === 1) rootSample = items.slice(0, 8).map((i) => i.title ?? i.name);
    cursor = b.data?.is_end ? '' : (b.data?.next_cursor ?? '');
  } while (cursor && pages < 20);
  report.steps.B_get_knowledge_list = { rootItems: total, pages, rootSample };

  // C. 按型号/任务搜索
  const c = await ima('openapi/wiki/v1/search_knowledge', { knowledge_base_id: kbId, query, cursor: '' });
  const hits = c.data?.info_list ?? [];
  report.steps.C_search_knowledge = {
    query, code: c.code, hits: hits.length,
    top: hits.slice(0, 5).map((h) => ({ media_id: h.media_id, title: h.title })),
    note: hits.length ? undefined : '搜索无结果不等于无权限,应改用 get_knowledge_list 按目录进入 P1-产品参数库',
  };

  // D. 取首个命中的原文访问信息
  if (hits[0]) {
    const d = await ima('openapi/wiki/v1/get_media_info', { media_id: hits[0].media_id });
    report.steps.D_get_media_info = {
      code: d.code, media_type: d.data?.media_type,
      hasUrl: !!d.data?.url_info?.url, needsHeaders: !!Object.keys(d.data?.url_info?.headers ?? {}).length,
    };
  }

  writeFileSync(join(cacheDir, 'kb-meta.json'), JSON.stringify({ kbId, kbName }, null, 2)); // 仅程序内部使用
  report.result = 'OK';
} catch (e) {
  report.result = 'FAIL';
  report.error = e.msg || e.message;
  if (e.code === -100) report.hint = '缺少凭证:在 agent/.env 填写 IMA_OPENAPI_CLIENTID / IMA_OPENAPI_APIKEY,或设置同名环境变量';
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.result === 'OK' ? 0 : 1);
