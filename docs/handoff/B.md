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

## 复核修正（2026-10-22）

- 修正规格数字的子串自证：`2GB` 不再从 `512GB` 里误判为支持，仍保留同型号、同单位匹配。
- 扩展价格识别：`4999元`、`￥4999`、`RMB4999`、`CNY 4,999` 都会进入价格核验；预算金额不误判为产品价。
- 收紧商业承诺：`赠品一台汽车` 不再因为账本某处出现“赠品”二字而放行；具体赠品必须能在同型号事实中找到。
- 生产环境缺少 `HC_SESSION_SECRET` 或 `ADMIN_PASSCODE` 时直接失败关闭，不再使用公开默认密钥。
- 手机工作台补充五个渠道切换入口，并验证可切到朋友圈。
- 预算快捷按钮改为可解析区间；问答转内容会携带受众、场景、预算和下一步动作。
- 任务启动时恢复中断的 `queued/running` 任务；已完成的渠道不重跑，只补缺失渠道。
- 回归测试扩展到 19 项，全部通过；`npm run build` 通过；Impeccable 检测无输出。
