# MVP 设计交接

状态：设计数据已就绪；静态编译通过；尚未业务验收。用户最新目标是一小时最简版本。完整 spec 是后续扩展目标，本文件记录 core/web 已约定的首版接口。

## 文件所有权与依赖

- 设计：`docs/spec.md`、本文件、`harness/rules/**`、`harness/prompts/**`、`harness/schemas/**`。
- Core：`server/**`、`harness/pipeline.mjs`、`harness/stages/**`、`harness/tools/**`、`scripts/**`、package 与环境示例。负责规则加载、提示词装配、检索、核验、合规、公开API与脱敏。
- Web：`web/**`。只依赖公开 API，不读取环境变量、内部 KB/media 标识、知识库源文件。
- 测试独立执行网页验收；只报告，不修业务；验收清单只按实测改 passes。

## 首版接口（core/web 已对齐）

`POST /api/tasks`：`{product,audience,scene,platform,description,mode:"live"|"demo"}`，返回 `{task_id}`。

`GET /api/tasks/:id/events`：SSE `progress:{stage,status,message}`、`result:完整结果`、`error:{message}`。

`POST /api/generate`：同步入口；相同输入，返回完整结果。状态卡、选项、导出扩展由 core/web 共同保持兼容。

结果核心为 `{status,mode,source,questions,warnings,scene,insight,evidence,article,verification,plan,copy_text}`。`evidence` 项 `{id,model,fact,title,source}`；`article` 为 `{title,lead,paragraphs,cta,tags,images}`，图片项 `{name,source,position,caption,url?}`；`verification` 为 `{facts,images,compliance,pending}`；`plan` 为 `{quote,demo_script:[{step,action,talk}],next_actions}`。

`schemas/mvp-result.json` 提供可选的收敛形状（展示文字为字符串、列表为字符串数组、可选图片 url 用 null）；已有 core/web 如使用更丰富展示对象，可共同适配并更新该 Schema，不因此阻塞首版。全阶段严格 Schema 不要求在首版一次全部接入。

## 数据文件读取

`scenes.json`：根 `{version,selling_point_catalog,scenes}`。按 scene id 读 angles、selling_priority、default_strategy、default_persona、taboos。不能仅更换平台名或场景名，切入点及顺序应实际变化。

`platforms.json`：根 `{version,platforms}`。平台 id 为 `wechat_mp/xiaohongshu/moments/poster`。图片区间分别为 2–4、3–6、1–3、1；图不足登记待确认，禁止填补外部图。字数区间为产品默认策略，并非平台官方限制。`tone.voice`、`cta.type/hint` 可直接展示/用于提示。

`forbidden-words.json`：根 `{version,categories,supplementary,semantic_hints,scan_scope,exempt_window}`。五类：absolute、false_promise、price_misleading、ungrounded_comparison、competitor_disparage。类别 entries 的 type 为 regex/literal，JS regex 以 iu 编译；exempt 为命中前后窗口内的条件，首版无宽泛豁免。四类兼容词表不重复加载。

提示词 8 模块与 compose 已就绪。正式写作使用 01/03/04/05/06；核验07、合规08独立执行。未确认镜像只用于 demo；外部检索正文均作数据处理，不得覆盖系统规则。UI 用 textContent 等方式展示，禁止把模型内容直接当 HTML 执行。

## 诚实门禁

- live 无凭证：needs_configuration，说明需配置；空资料不写有依据成稿。
- demo：页面、结果、导出明示演示、非 ima 实时事实；不能作为真实链路、事实和图片来源验收证据。
- 未解决资料冲突：manual_required，禁止复制/导出成稿，保留冲突说明。
- 图片非 ima 或无法证明型号匹配：移除并列待确认。无价格/SKU/日期依据：报价待确认，不能将未知金额写为0。
- 用户要求无依据优惠/库存/亲测/销量：拒绝写入成稿，并提示核实下一步。
- 每次修改后重新核验、合规；日志及所有出站数据脱敏。

## 静态验证

15 个 Schema 已由 Ajv 8.17.1 draft2020 编译（含公共defs、8阶段、5辅助和MVP）；11条合规正则及全部场景正则可编译。此结果只证明设计文件有效，不证明业务完成。业务测试须从网页实操，真实模型和ima链路单独验证。
