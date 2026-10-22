# 华采智营 · 门店内容副驾驶

> 浙客松 · 华为产业进阶赛道参赛项目
> 定位：帮门店销售把一句话、一条真实场景，变成五个渠道能发的内容；发之前先拦住没依据的数字。

## 现在能做什么

- **今日任务台**：3 张有真实资料与官方图的选题卡，点开即可写。
- **内容工坊**：真实细节是硬门槛；一次生成 5 个渠道、11 个版本（小红书 ×3、朋友圈 ×3、视频号 ×3、公众号 ×1、海报 ×1）。
- **模型写作**：有 `DEEPSEEK_API_KEY` 时由 DeepSeek 生成；失败自动回退规则稿，任务里如实标记，不伪装。
- **事实账本**：10 个型号、官方商城价/参考价/冲突三种状态；冲突与“仅参考价”一律不写进内容。
- **确定性核验**：价格、规格、商业承诺、极限词逐项核对；被拦版本禁用复制与导出，并给出精确理由。
- **配图**：官方产品图 + Canvas 确定性排版，生成封面/事实卡/到店清单/海报/视频封面，可单张下载。
- **整包导出**：ZIP 内含 `copy/`（仅通过核验的渠道）、`images/`、`sources.json`、`manifest.json`；手机支持系统分享。
- **顾客问答**：预算、场景、Windows/鸿蒙、否定表达都能识别；结果可一键转成内容任务，不会静默换型号。
- **门店与后台**：门店码 + PIN、门店资料、价格冲突确认、来源与候选事实管理（`/admin`）。

## 快速运行

前置：Node 20+；知识库目录 `华为PC全板块深度知识库_v7/` 放在仓库根目录（与 `app/` 同级）。

```bash
cd app
npm install
cp .env.example .env        # 填 DEEPSEEK_API_KEY；数据库可选
npm run db:migrate          # 首次使用 Supabase 时
npm run server              # 终端 1：API，8787
npm run dev                 # 终端 2：前端，3000
```

数据默认写 Supabase（`HC_PERSISTENCE=supabase` + `SUPABASE_POOLER_URL`）；不配置数据库则回退本地 JSON。

打开 <http://localhost:3000>，点「进入演示门店」；或使用门店码 `HUAWEI-001` / PIN `246810`。
本地开发默认开启演示模式；生产环境必须配置 `HC_SESSION_SECRET`（≥32 字符）和 `ADMIN_PASSCODE`，否则服务拒绝启动。

## 生成模式

| 条件 | 行为 |
|---|---|
| 有 `DEEPSEEK_API_KEY`，`HC_GENERATION` 未设为 `rules` | 五渠道走模型（`model:deepseek-chat`） |
| 没有密钥，或 `HC_GENERATION=rules` | 全部规则稿，界面显示 `rules-v1` |
| 某个渠道模型失败/超时 | 该渠道回退规则稿，任务记录 `fallbacks`，界面提示 |
| 模型写了没依据的数字 | 确定性核验拦下；可自动尝试修复一次，仍不过就 blocked |

模型只负责表达，事实与价格由账本提供；核验代码有最终否决权。

## 目录

```
app/
  src/pages/        Today / Create / Workbench / Ask / Settings / Admin
  src/lib/          api / render-images / export-pack / zip / chat / speech
  server/refactor/  ledger / model-writer / generator / verifier / tasks / ask / routes
  server/mcp/       平台规则卡（五渠道）
docs/               重构执行规格、交接说明
华为PC全板块深度知识库_v7/   事实与图片来源（不入库）
```

## 测试

```bash
cd app
npm test      # node --test server/refactor/*.test.mjs
npm run build # tsc + vite build
```

## 事实与合规

- 事实基准：华为官方公开页面快照，2026-10-17；价格只认「官方商城页面价」。
- MateBook 14 鸿蒙版价格冲突（5,899 / 6,599）冻结，管理员按 SKU 确认后才恢复。
- 只有「官网参考起价」的型号（如已下架的 GT 14）标记为参考价，不写进内容。
- 没有销售提供的真实细节，不生成内容。
- 只使用官方产品图或门店实拍；AI 不生成产品外观、不画二维码；二维码未配置就留白。
- 演示门店、顾客与场景为虚构，产品事实与价格来自官方公开资料。

## 已知限制

- 已支持 Supabase Postgres（门店、任务、版本、价格确认、候选事实）；未配置数据库时回退本地 JSON（换机器会丢数据）。
- 部署：Vercel 函数最长 60 秒，五渠道默认内联生成；超时单渠道回退规则稿。见 `docs/部署.md`。
- 尚未接原生 ima OpenAPI：当前从 v7 本地快照读取事实与图片，ima 适配层是下一步。
- 配图目前覆盖 3 个有官方产品图的型号；其余型号会提示「官方产品图未就位」，文案与导出不受影响。
- 暂无 PWA、CI 与浏览器端到端测试。
- 任务保存 30 天，暂无自动清理；Supabase Storage 未使用，二维码只支持外链。
