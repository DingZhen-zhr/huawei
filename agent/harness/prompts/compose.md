# compose.md 提示词装配约定

本文件是 `tools/prompts.mjs` 的装配说明,也是他人接手提示词时的入口。内容与 `docs/spec.md` §4(阶段与字段)、§5.4(文件格式)、§10.7(装配接口)保持一致;冲突时以 spec 为准,并在 `docs/progress.md` 追加记录。

## 1. 总体约定

- 8 个模块文件各管一个主题,**按阶段拼接**,不是每次全拼。模块文件只放"判断口径、规则、示例",**不放**具体平台图数、卖点列表、违禁词清单(这些在 `harness/rules/*.json`,经占位符注入)。
- 模型调用的两段文本:
  - `system`:被选中的模块正文,按固定顺序拼接(去掉 front-matter);模块之间用一行 `\n\n---\n\n` 分隔。
  - `user`:阶段数据块(见 §4),每块用 XML 式标签包裹、内容为紧凑 JSON。**数据不放进 `system`。**
- 每次调用的 `req.stage` 取值为:`task`(任务补全:追问润色)、`insight`(洞察)、`strategy`(策略)、`reco_text`(型号推荐文案)、`draft`(生成)、`verify_claims`(核验补充抽取)、`compliance_review`(合规复查)、`rewrite`(合规改写后备)。`retrieval`、`verification`、`export` 本身是代码阶段,没有独立的模型调用,模型只经过 `reco_text`/`verify_claims` 参与。
- 面向用户的输出一律简体中文,JSON 严格符合该阶段 Schema(`harness/schemas/<stage>.json`);`verify_claims`、`compliance_review`、`rewrite`、`reco_text` 的 Schema 随同文件落地,字段见各模块的"任务"节。

## 2. 阶段 → 模块 对照表

`●` = 拼入;`—` = 不拼。顺序即拼接顺序(自左至右)。

| 阶段(`req.stage`) | 01 角色与任务 | 02 场景理解 | 03 平台规则 | 04 知识库约束 | 05 图片规则 | 06 生成要求 | 07 核验规则 | 08 合规规则 |
|---|---|---|---|---|---|---|---|---|
| 1 任务补全 `task`(追问润色) | ● | ●(A 节) | — | — | — | — | — | — |
| 2 客户洞察 `insight` | ● | ●(B 节) | — | — | — | — | — | — |
| 3 内容策略 `strategy` | ● | ●(C 节) | ● | — | — | — | — | — |
| 4 型号推荐文案 `reco_text`(仅 `product=未定`) | ● | — | — | ● | — | — | — | — |
| 5 内容生成 `draft` | ● | — | ● | ● | ● | ● | — | — |
| 6 核验补充 `verify_claims`(可选) | ● | — | — | ● | — | — | ● | — |
| 7 合规复查 `compliance_review` | ● | — | — | — | — | — | — | ● |
| 7 合规改写 `rewrite`(代码替换不足时) | ● | — | — | ● | — | — | — | ● |

要点:

- **01 永远第一个**:它带全局红线 G1–G11,其他模块引用而不重复。
- **阶段 5 不拼 07、08**:07 是核验器行为的说明(阶段 6 由代码执行),08 是合规复查口径(阶段 7)。阶段 5 的出稿自检清单在 06 的"判断流程"中,合规底线在 06 的"禁止"中。这样每次调用只带必要的约束,减少互相稀释。
- **阶段 2 与阶段 3 共用 02**,但 `<stage>` 标签不同,模块 02 的 A/B/C 节按 `<stage>` 选用。
- 阶段 1 主要由代码完成,没有模型也能产出追问;模型调用失败时用规则内置固定追问文案(spec §4.1)。
- 阶段 4 的资料检索是纯代码;只有 `product=未定` 的型号推荐才调用 `reco_text`。
- 阶段 6 核验以代码为主;`verify_claims` 只补抽代码漏掉的功能性断言。
- 阶段 8 导出是代码,不调模型。

### 2.1 阶段 → 输入输出摘要(与 spec §4 对应)

| 阶段 | 输出 Schema | 模块要求的关键字段 |
|---|---|---|
| `task` | `questions.json`:`{stage:"task",schema_version,questions:[{id,question,why}]}` | 题数与 `id` 与骨架一致 |
| `insight` | `insight.json` | `persona usage_scene purchase_stage core_situation concerns empathy_anchors evidence content_goal`;每个判断有 `evidence`;`quote` 为输入子串 |
| `strategy` | `strategy.json` | `angle`(id 在 `scenes[scene].angles` 内)、`selling_points`(key 在 `selling_priority` 内)、`platform_plan`(`image_count` 在平台区间内)、`rule_basis`、`query_plan` |
| `reco_text` | `{stage,schema_version,items:[{model_id,why,fact_ids}],degraded}` | `why` 无数字 |
| `draft` | `draft.json` | `article`(标题 3 选 1、导语、`segments` 带 `fact_ids`/`is_fact_claim`、`cta`、`tags`、`poster`)、`image_plan`、`quote_block`、`demo_script`、`next_actions`、`fact_digest` |
| `verify_claims` | `{stage,schema_version,extra_claims:[…],degraded}` | 只抽取,不改稿 |
| `compliance_review` | `{stage,schema_version,findings:[…],degraded}` | `text_excerpt` 逐字 |
| `rewrite` | `{stage,schema_version,article,changes,degraded}` | `before` 逐字;`hit_ids` 存在 |

> 辅助模型 Schema 已落地:`questions.json`(stage 标签仍为 task)、`reco_text.json`、`verify_claims.json`、`compliance_review.json`、`rewrite.json`。完整 task 输出由代码组装，不能用完整 task.json 约束仅润色追问的模型调用。

## 3. 占位符约定

### 3.1 规则注入占位符(双花括号,出现在**模块文件**里)

| 占位符 | 出现在 | 来源 | 注入内容 |
|---|---|---|---|
| `{{scene_rules}}` | 02 | `harness/rules/scenes.json` | 当前 `scene` 的条目:`label audiences angles selling_priority taboos single_point max_points purchase_stage_default content_goal_default default_persona`,以及被引用到的 `selling_point_catalog` 项。**只注入当前场景**,不注入全部 8 个 |
| `{{platform_rules}}` | 03 | `harness/rules/platforms.json` | 当前 `platform` 的条目:`structure image_count length tone cta title tags image_roles_order first_person_experience price_policy`。**只注入当前平台** |
| `{{forbidden_summary}}` | 08 | `harness/rules/forbidden-words.json` | 五类的 `label`、`description`,以及每类各取 ≤3 条 `example_bad / example_good`。**不注入完整词表**(词表由代码扫描) |
| `{{semantic_hints}}` | 08 | `forbidden-words.json` 的 `semantic_hints` | 各类暗示性表达线索清单 |
| `{{kb_name}}` | 01、04 | 配置常量 | 知识库名称"任德耀新建华为PC知识库" |
| `{{origin_label}}` | 04 | `ctx.retrieval.origin` | `ima` 或 `本地镜像` |
| `{{today}}` | 01 | `deps.clock()` | `YYYY-MM-DD` |

规则:

1. **单次替换**:每个占位符按字面 `{{name}}` 全局替换为对应字符串,替换结果**不再递归解析**占位符。
2. **缺失即报错**:正文里出现了没有提供值的占位符 → `prompts.compose` 抛 `DOMAIN_INVALID`(不静默留空,不输出 `{{...}}` 原文给模型)。
3. **不得在模块文件里写死规则内容**:`harness/prompts/*.md` 中不出现平台图数区间、字数区间、违禁词条目、卖点清单。测试 `prompts-no-hardcode` 用正则检查(图数/字数区间写法、`forbidden-words.json` 的词条、`selling_point_catalog` 的 key 等);检查范围排除每个模块的 `## 反例与正例` 小节,以及模块 01 的 G10(它需要举例说明"什么要求不能执行")。
4. 模块中的**示例**允许出现演示用的数字与词(如 798 g、1600 尼特、"全网最低"),但示例内一律标明"演示用/不得照抄"。
5. front-matter 的 `variables` 列出该模块使用的占位符,`blocks` 列出该模块依赖的 user 数据块;`prompts.mjs` 以此做装配前检查(缺块告警)。

### 3.2 数据块标签(单花括号尖括号,出现在**模块文件的说明文字**与 **user 消息**里)

模块文字里的 `<facts>`、`<images>` 等是**指代 user 消息中同名块**,不是要替换的占位符。

## 4. user 消息格式

```
<stage>draft</stage>
<task>{…task.normalized 紧凑 JSON…}</task>
<description>…客户描述原文,转义后…</description>
<constraints>["…", "…"]</constraints>
<insight>{…}</insight>
<strategy>{…}</strategy>
<platform_plan>{…}</platform_plan>
<facts>[{…}, …]</facts>
<images>[{…}, …]</images>
<quote>{…}|null</quote>
<rejected_requests>[…]</rejected_requests>
<pending>[…]</pending>
<taboos>[…]</taboos>
<revision>{…}|null</revision>
<disabled_segments>["s2"]</disabled_segments>
<retry_hint>["上次输出的问题:…请修正"]</retry_hint>
```

约定:

1. 首行固定 `<stage>…</stage>`,值等于 `req.stage`。
2. 块内容为**紧凑 JSON**(无缩进),字符串字段保留原文;`<description>`、`<audience>`、`<constraints>` 不做改写,仅转义 `<` `>` 为全角或实体,防止被误认为标签。
3. 块的出现与否由下表决定;**不适用的块不输出**(不用空块占位),适用但值为空的输出 `null` 或 `[]`。
4. 数据体积控制:`<facts>` 只放与 `strategy.query_plan.topics` 和主型号相关的事实点(上限由 `config.maxFactsInPrompt` 控制,默认 60),其余留在 `ctx`;`<images>` 只放主型号且 `model_name` 非空的图;`<prices>` 只在 `want_price=true` 时放。
5. 前端可见字段以外的内部 id(`media_id`、`kb_id`、`folder_id`)**永不进入 user 消息**(spec §11.6)。事实点、图片使用后端内部的 `f*`/`i*` id 即可。
6. `<retry_hint>` 仅在阶段重试时出现,内容来自 schema/domain 校验错误文本(spec §7.2),每条一句。

### 4.1 各阶段 user 块

| 块 | task | insight | strategy | reco_text | draft | verify_claims | compliance_review | rewrite |
|---|---|---|---|---|---|---|---|---|
| `<stage>` | ● | ● | ● | ● | ● | ● | ● | ● |
| `<task>` | ● | ● | ● | ● | ● | — | — | — |
| `<questions_skeleton>` | ● | — | — | — | — | — | — | — |
| `<description>` `<audience>` `<constraints>` | — | ● | — | — | ● | — | — | — |
| `<insight>` | — | — | ● | — | ● | — | — | — |
| `<strategy>` / `<platform_plan>` | — | — | ● (草稿骨架) | — | ● | — | — | — |
| `<facts>` | — | — | — | ● | ● | ● | ● | ● |
| `<images>` | — | — | — | — | ● | — | — | — |
| `<prices>` | — | — | — | — | ● (want_price) | ● | — | — |
| `<quote>` | — | — | — | — | ● | ● | ● | ● |
| `<conflicts>` `<pending>` | — | — | — | — | ● | — | — | — |
| `<rejected_requests>` | — | — | — | — | ● | — | ● | ● |
| `<taboos>` | — | — | — | — | ● | — | — | — |
| `<revision>` `<disabled_segments>` | — | — | — | — | ● (有修改时) | — | — | — |
| `<previous_platform>` | — | — | — | — | ● (换平台修改时) | — | — | — |
| `<segments>` | — | — | — | — | — | ● | — | — |
| `<code_claims>` | — | — | — | — | — | ● | — | — |
| `<article>` | — | — | — | — | — | — | ● | ● |
| `<hits>` | — | — | — | — | — | — | ● | ● |
| `<findings>` | — | — | — | — | — | — | — | ● |
| `<retry_hint>` | 重试时 | 重试时 | 重试时 | 重试时 | 重试时 | 重试时 | 重试时 | 重试时 |

说明:`strategy` 阶段的 `<platform_rules>`、`insight`/`strategy` 阶段的 `<scene_rules>` 已通过模块里的 `{{platform_rules}}`/`{{scene_rules}}` 注入 `system`,不再在 user 里重复出现;模块文字里的 `<scene_rules>`、`<platform_rules>` 即指这两处注入内容。

## 5. 模型调用参数

| 阶段 | temperature | maxOutputTokens | timeoutMs | 说明 |
|---|---|---|---|---|
| `task` | 0.4 | 800 | 3000(阶段预算) | 超时直接用固定文案 |
| `insight` | 0.4 | 2000 | 45000 | |
| `strategy` | 0.3 | 1800 | 30000 | 在骨架内选择,偏低 |
| `reco_text` | 0.3 | 600 | 20000 | |
| `draft` | 0.5 | 6000 | 90000 | 需要写作空间;须含方案部分,故较大 |
| `verify_claims` | 0.1 | 1200 | 10000 | 固定低温 |
| `compliance_review` | 0.1 | 1500 | 20000 | 固定低温 |
| `rewrite` | 0.2 | 4000 | 20000 | |

数值为默认值,以 `PipelineConfig` 与 `LLM_TEMPERATURE` 为准(spec §10.1、§7.1);核验与合规阶段**固定 0.1**,不随环境变量变动。

## 6. 装配流程(`compose(stage, ctx, extras)`)

1. 按 §2 表取该阶段的模块列表;读文件,**去掉 front-matter**。
2. 从规则库取当前 `scene`、`platform` 的条目,生成 §3.1 的注入字符串。
3. 替换占位符;若发现未提供值的占位符,抛 `DOMAIN_INVALID`。
4. 拼接 `system`:`模块1 ---- 模块2 ---- …`。
5. 按 §4 组装 `user`。
6. 取该阶段 Schema(`harness/schemas/<stage>.json`)作为 `schema`。
7. 记录 `stage_log.note`:`prompts=01,02,03;rules=scenes.json@v{version},platforms.json@v{version}`,供追溯(AC-052)。**不记录提示词全文。**
8. 返回 `{ system, user, schema, params }`。

### 6.1 重试与修改

- **阶段重试**:`extras.retryHint` 非空 → 追加 `<retry_hint>`,其余不变(spec §7.2)。
- **修改再生成**(spec §11.2 `revise`):
  - `change_platform`:从阶段 3 重来;阶段 5 追加 `<previous_platform>` 供模块 03 做"五项差异"自检;
  - `change_selling_point`:从阶段 3 重来,`strategy` 已按新焦点重排;
  - `delete_segment` / `regenerate` / `edit_constraints`:从阶段 5 重来,`<revision>` 与 `<disabled_segments>` 出现;
  - 所有修改后的结果必须再次经过阶段 6、7(AC-049)。

### 6.2 降级时不用模型的产物(与提示词无关)

阶段 2/3/5 失败 2 次后的规则默认产物由代码构造(spec §4.2/§4.3/§4.5);其内容也受同样的核验与合规检查,不因"不是模型写的"而放宽。

## 7. 他人接手清单

- 想改**平台规则**(图数、字数、标题长度、标签个数、行动引导):改 `harness/rules/platforms.json`。不要改提示词。
- 想改**场景切入点/卖点顺序/禁忌**:改 `harness/rules/scenes.json`。
- 想改**违禁词**:改 `harness/rules/forbidden-words.json`。
- 想改**判断口径、示例、红线**:改对应模块 `.md`;改红线 G1–G11 须同时检查 02–08 对其引用是否仍成立。
- 想新增一个模型调用:① 新增 Schema;② 在 §2 表加一行;③ 决定拼哪些模块、需要哪些 user 块(§4.1);④ 在 `PipelineConfig.stageBudgetMs` 与 §5 表加参数。
- 改完执行:`node --test`(提示词装配测试:未解析占位符、模块缺失、front-matter 与本表一致、示例未被当成规则)。

## 8. 模块一览

| 文件 | 管什么 | 对应手册模块 |
|---|---|---|
| `01-role-task.md` | 服务对象、交付物、全局红线 G1–G11 | 角色与任务 |
| `02-scene-understanding.md` | 人群/场景/购买阶段/处境/锚点/判断依据;切入点与卖点选择 | 场景理解 |
| `03-platform-rules.md` | 如何使用平台规则、平台适配的五项差异 | 平台规则 |
| `04-kb-constraints.md` | 事实只来自 ima;一句一依据;限定条件;价格与补贴;冲突停止 | 知识库约束 |
| `05-image-rules.md` | 图片只来自 ima;型号一致;来源、说明、插入位置 | 图片规则 |
| `06-generation.md` | 标题/导语/正文/配图/引导/标签;报价、演示脚本、下一步动作 | 生成要求 |
| `07-verification.md` | 逐 claim 判定;无法确认不生成;冲突停止输出并提示人工确认 | 核验规则 |
| `08-compliance.md` | 五类违规口径、语义复查、改写约束 | 合规规则 |
