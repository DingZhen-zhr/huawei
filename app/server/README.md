# 智能体服务端（RAG + DeepSeek）

把原 demo 的「正则规则引擎 + 硬编码模板」升级为真正的 Agent：

- **本地向量化 RAG**：`@xenova/transformers` 本地跑 `Xenova/bge-m3`（1024 维，中文友好），走 hf-mirror 镜像
- **DeepSeek 生成**：调用 `deepseek-chat`（实测路由 `deepseek-flash`），密钥从 `.env` 读取
- **Agent 编排**：系统提示词骨架（8 模块）+ RAG 检索上下文 → DeepSeek 生成 → 返回 `{ reply, evidence }`

## 文件

| 文件 | 作用 |
|---|---|
| `index.mjs` | Express 服务端：`/api/free-chat`、`/api/retrieve`、`/api/kb-file`、`/api/prompt`、`/api/health` |
| `rag.mjs` | 本地 embedding + 知识库分块 + 混合检索（余弦 + 意图加权 + 型号覆盖 + 多样性） |
| `vectorize.mjs` | 知识库向量化（遍历 md → 分块 → 嵌入 → 存索引），支持 `--boards` / `--reset` / `--limit` |
| `deepseek.mjs` | DeepSeek 调用封装 |
| `data/` | 运行时生成的向量索引（已 gitignore，勿提交） |

## 检索增强（针对业务场景）

1. **多样性**：每个文件最多 2 块，避免上下文全挤在同一文档
2. **型号覆盖**：问题提到多个型号时，保证每个型号的「产品事实」关键小节都进入上下文（防混淆）
3. **意图加权**：问价格时提升「价格卡」权重；问平台时提升「平台模板」权重
4. **价格表完整**：价格类问题会把命中价格卡的其余分块带上，避免具体 SKU 行被切掉

## 运行

```bash
cd app
cp .env.example .env        # 填 DEEPSEEK_API_KEY
npm run vectorize           # 构建向量索引
npm run server              # 启动服务端（端口 8787）
```

前端 `npm run dev` 时 Vite 会把 `/api` 代理到 8787。

## 索引范围（当前默认）

`vectorize.mjs` 的 `CORE_BOARDS` 默认只索引核心业务板块（全库 1363 个 md，CPU 上需 1 小时以上）：

- `P1-产品参数库`（产品事实 / 卖点 / 型号检索卡 / 官方价格快照）
- `P6-营销素材库`、`P8-客户场景库`、`P2-卖点话术库`、`P7-常见问题库`、`P4-价格政策库（机密）`

也可指定具体目录（支持二级目录），增量追加（不加 `--reset` 会跳过已完成文件）：

```bash
# 只补平台模板 + 智能体规则 + 零售话术（快速）
npm run vectorize -- --boards "P6-营销素材库/02-平台模板,00-建库规范/06-智能体规则,P2-卖点话术库/01-零售"

# 全库（较慢）
npm run vectorize -- --boards ""
```

## 已知限制

- bge-m3 为 CPU 推理，实测约 7 段/秒；全库索引耗时较长
- 单文件 embedding 超过 120 秒会被跳过并打印警告（防止整批卡死），可重跑补齐
- 索引 JSON 较大（约 70MB+），服务端按 mtime 缓存在内存，避免每次请求重复解析

## API

- `GET /api/health` → `{ ok, model }`
- `GET /api/prompt` → 系统提示词全文
- `GET /api/kb-file?path=<相对知识库根路径>` → 知识库文件原文（防目录穿越）
- `POST /api/retrieve` `{ query, topK }` → 检索到的知识块
- `POST /api/free-chat` `{ messages }` → `{ reply, evidence[] }`
