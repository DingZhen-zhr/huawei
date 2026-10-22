# 事实搜索与价格确认交接

## 已完成

- 新增 Tavily 官方来源搜索：只接受华为官方域，至多三次查询、二十秒总超时；必须实际抓取候选 URL 的正文，不信任搜索摘要；无正文、超时或非官方来源均返回待补状态。
- 新增候选事实导入：所有搜得资料均为 `proposed`，携带来源、抓取时间、摘录、hash/信任级别，冲突资料不可自动入账；提交后才持久化为 active 账本事实。
- 价格冲突按 SKU 解冻：管理员必须提供 SKU、地区、生效日期、来源和结论；确认写入本地运行时审计记录，未确认 SKU 继续冻结。
- 扩展确定性核验：无依据价格、规格、商业承诺以及极限词均为 `blocked`，并返回精确 span 与证据 ID。
- 新增管理员 P2 接口：候选预览/提交、来源查看、冲突确认、价格复查；全部通过既有 `requireAdmin` 保护。

## 变更文件

- `app/server/refactor/ledger.mjs`
- `app/server/refactor/verifier.mjs`
- `app/server/refactor/tavily.mjs`
- `app/server/refactor/fact-import.mjs`
- `app/server/refactor/routes.mjs`
- `app/server/refactor/fact-search.test.mjs`

## 验证

- `node --test server/refactor/fact-search.test.mjs`：11/11 通过，覆盖运行时路径、真实正文抓取、超时/空正文、密钥不泄露、stale、管理员鉴权/提交与 SKU 解冻。
- `npm run build`：通过。
- `npx eslint src/pages/Workbench.tsx src/pages/Today.tsx src/pages/Create.tsx`：通过；未修改这些共享页面。
- 本地未配置 `TAVILY_API_KEY`，因此只执行了离线 mock，未宣称真实 Tavily 搜索成功。

## 未解决项

- 需在部署环境配置 `TAVILY_API_KEY` 后，由管理员使用价格复查接口取得真实官方来源候选并完成审核。
- 本地 JSON 运行时记录固定在 `app/server/data/runtime/`，已被 git 忽略；若运行环境只读，会保持进程内安全状态，不会伪称数据库已写入。
