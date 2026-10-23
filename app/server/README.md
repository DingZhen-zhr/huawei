# 服务端（华采智营）

Express 5 + 本地 JSON 运行时。入口 `server/index.mjs`，所有业务路由在 `server/refactor/routes.mjs`。

| 文件 | 作用 |
|---|---|
| `refactor/ledger.mjs` | 从 v7 知识库解析 10 个型号的事实与价格；价格冲突/参考价冻结 |
| `refactor/model-writer.mjs` | DeepSeek 生成五渠道文案；失败回退规则稿 |
| `refactor/generator.mjs` | 规则稿兜底、配图计划、复制文本 |
| `refactor/verifier.mjs` | 确定性核验：价格/参数/商业承诺/极限词 |
| `refactor/tasks.mjs` | 内容任务、SSE、部分失败、单渠道重试、刷新恢复 |
| `refactor/ask.mjs` | 顾客问答槽位（预算/场景/系统/否定表达） |
| `fact-import.mjs` / `tavily.mjs` | 候选事实、官方来源搜索 |
| `agent/kb-index.mjs` | 解析 `华为PC全板块深度知识库_v7` |
| `mcp/core.mjs` + `platforms/*.json` | 平台规则卡（五渠道） |

## 运行

```bash
cd app
npm run server   # 8787
npm run dev      # 3000，/api 代理到 8787
```

环境变量见 `app/.env.example`。生产环境必须配置 `HC_SESSION_SECRET` 与 `ADMIN_PASSCODE`。

## 生成模式

- 有 `DEEPSEEK_API_KEY`：`HC_GENERATION` 未设为 `rules` 时，五渠道文案走模型（`model:deepseek-chat`）；单渠道失败自动回退规则稿并在任务里标记。
- 没有密钥或 `HC_GENERATION=rules`：全部规则稿，界面显示 `rules-v1`，不伪装成模型生成。
- 模型输出仍经过 `verifier.mjs` 确定性核验；被拦版本不可复制/导出。

## 测试

```bash
npm test   # node --test server/refactor/*.test.mjs
```
