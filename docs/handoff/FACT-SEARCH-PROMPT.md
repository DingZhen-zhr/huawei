# 可直接发给队友 Codex 的 Prompt

把下面整段复制给队友的 Codex。

---

你是「华采智营」项目的事实搜索与核验负责人。

仓库：https://github.com/DingZhen-zhr/huawei
当前目标分支：`zhr`
当前基线提交：`e5ed585`

先读：

1. 根目录 `AGENTS.md`（如果存在）
2. `PRODUCT.md`
3. `docs/华采智营_重构执行规格.md` 的第 7、8、14 节
4. `docs/handoff/FACT-SEARCH-BRIEF.md`

注意：`docs/team/` 是旧版任务书，里面写的是 `apps/...` 目录和另一套架构。**不要按旧任务书新建项目，以当前 `app/` 代码为准。**

## 开工前

1. 先运行 `git status`，保留所有未提交改动，禁止 `git reset`、`git checkout --`、删除未提交文件。
2. 从最新 `origin/zhr` 创建分支：

```bash
git fetch origin
git switch -c feat/fact-search origin/zhr
```

3. 不要直接推 `zhr`，不要强推，不要 `git add .`。
4. `app/.env` 里有本地密钥时只读取变量名，不回显值，不提交 `.env`。
5. 如果本地没有 `TAVILY_API_KEY`，先写离线测试和 mock，不要假装真实搜索成功。

## 你的范围

你负责把三件事做实：

1. 缺资料时搜索华为官方来源
2. 搜索结果只作为候选事实
3. 价格冲突冻结，管理员确认后才能恢复

你不负责重做销售端页面，也不负责生成文案。

## 你可以修改

```text
app/server/refactor/ledger.mjs
app/server/refactor/verifier.mjs
app/server/refactor/tavily.mjs          （新建）
app/server/refactor/fact-import.mjs     （新建）
app/server/refactor/admin-facts-routes.mjs（新建）
app/server/refactor/routes.mjs          （只加 P2 路由，不改已有接口形状）
```

测试可以新增：

```text
app/server/refactor/fact-search.test.mjs
app/server/refactor/verifier.test.mjs
```

## 不要修改

```text
app/src/pages/Workbench.tsx
app/src/pages/Today.tsx
app/src/pages/Create.tsx
app/src/components/AppShell.tsx
app/src/index.css
app/src/App.tsx
app/server/refactor/tasks.mjs
app/server/refactor/generator.mjs
app/server/refactor/auth.mjs
app/server/refactor/store-repo.mjs
```

需要改共用部分时，先在回复里说明，不要直接大改。

## 实现要求

### 1. Tavily 搜索

实现 `tavily.mjs`：

- 环境变量：`TAVILY_API_KEY`
- 只接受华为官方域名，例如：
  - `consumer.huawei.com`
  - `www.vmall.com`
  - `item.vmall.com`
  - `m.vmall.com`
  - `huawei.com` 及其官方子域
- 最多 3 次查询
- 总等待上限 20 秒
- 使用 `AbortSignal` 和超时
- 检查 HTTP 状态、内容类型和正文长度
- 保存：URL、标题、抓取时间、正文 hash、摘录
- 不把搜索摘要直接当事实
- 抓不到正文、超时、非官方来源时返回明确的失败/待补状态
- 不往日志里输出密钥

### 2. 候选事实

实现 `fact-import.mjs`：

- 输入：官方来源正文、产品、模型名、SKU、字段
- 输出候选事实，状态为 `proposed`
- 至少支持：价格、屏幕、处理器、内存、存储、重量、厚度、电池、接口
- 候选事实必须带：
  - `sourceId`
  - `sourceUrl`
  - `capturedAt`
  - `excerpt`
  - `trustTier`
- 和当前 `ledger.mjs` 的事实做差异检查：
  - 同型号、同 SKU、同字段、同单位
  - 不一致时标记 conflict，不自动覆盖
- 候选事实不能直接进入可复制内容

### 3. 价格冲突

当前真实冲突：

- `conflict:matebook-14-harmony:price`
- `¥5,899`：知识库官方商城页面快照
- `¥6,599`：官网参考起价

必须保持冻结，直到管理员确认。

管理员确认接口至少包含：

```http
POST /api/admin/conflicts/:id/resolve
```

请求必须包含：

```json
{
  "sku": "...",
  "region": "CN",
  "effectiveFrom": "YYYY-MM-DD",
  "sourceId": "...",
  "conclusion": "..."
}
```

确认后：

- 只恢复被确认的 SKU/字段
- 写入审计记录
- 未确认的 SKU 仍然冻结
- 不能把 5,899 和 6,599 自动合并成一个价格

### 4. API

按需实现，保持现有 P0/P1 接口形状不变：

```http
POST /api/admin/import/preview
POST /api/admin/import/commit
GET  /api/admin/sources
POST /api/admin/conflicts/:id/resolve
POST /api/admin/recheck-prices
```

所有管理员接口使用现有 `requireAdmin`。

持久化优先兼容本地运行时目录：

```text
app/server/data/runtime/
```

不要把运行时数据提交到 git。数据库路径如果暂时不可用，必须显示真实状态，不能假称写入 Supabase。

### 5. 核验

扩展现有 `verifier.mjs`，保持确定性，不要让模型单独判定“通过”。

必须支持：

- 价格必须同型号、同 SKU/配置范围
- 价格快照超过 7 天标记 stale
- 价格冲突时 blocked
- 规格数字必须同型号、同单位
- 无来源的赠品、补贴、库存、保修、活动期限 blocked
- 极限词/绝对化承诺 blocked
- 每个 claim 返回精确 span、状态、原因和证据 ID
- 不允许字符串包含式自证

## 验收测试

至少覆盖这些用例：

```text
1. 稿子写 ¥4,999，但账本无依据 → blocked
2. 5,899 / 6,599 冲突 → 仍然 blocked
3. 同一型号、同一 SKU、同日期、同来源 → supported
4. 价格快照超过 7 天 → stale
5. 非官方搜索结果 → 拒绝
6. Tavily 搜到的网页 → 只进入 proposed
7. 管理员确认后 → 对应 SKU 恢复
8. 未确认的 SKU → 仍然冻结
9. 搜索超时/无正文 → 待补，不编造
10. 输出中不能泄露 API Key
```

测试优先使用 Node 内置测试：

```bash
node --test app/server/refactor/fact-search.test.mjs
node --test app/server/refactor/verifier.test.mjs
```

## 验证命令

在 `app/` 下运行：

```bash
npm run build
npx eslint src/pages/Workbench.tsx src/pages/Today.tsx src/pages/Create.tsx
```

如果改动涉及 server，至少手动启动并验证：

```bash
node server/index.mjs
```

再用真实或 mock 请求检查 API。不要用假成功截图代替验证。

## 交付

完成后更新：

```text
docs/handoff/B.md
```

内容包括：

- 做了什么
- 改了哪些文件
- 验证命令和结果
- 真实 Tavily 是否跑通
- 哪些是 mock
- 未解决问题
- PR 链接

提交后发 PR：`feat/fact-search` → `zhr`。

最后用一句话总结你实际完成的能力，不要只说“已完成”。
