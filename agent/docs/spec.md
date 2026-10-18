# 技术规格 spec.md

状态:设计阶段制品,待用户确认后冻结。上游:`docs/intent.md`、`docs/acceptance.json`、`设计书.md`。已确认要求不改动;与验收清单有出入之处只记在 `docs/progress.md`,不改清单。

## 0. 读法

- §1–§5 是**契约**:术语、约定、各阶段数据模型、规则库/提示词/Schema 的文件格式。规则、提示词、Schema 三类文件按这几节落地。
- §6–§12 是**行为规格**:流水线、ima 层、LLM 层、核验、合规、HTTP/SSE、错误与重试。
- §13–§14 给前端定位点和验收映射。附录 A 是型号种子表,附录 B 是样例。
- 凡写"代码"的环节不得交给模型;凡写"模型"的环节必须有代码兜底(降级)。

## 1. 范围与前提

| 项 | 约定 |
|---|---|
| 产出 | 六个分区:一 场景判断、二 知识库依据、三 图文软文、四 核验结果(手册四分区),另加 洞察卡、方案(报价 + 演示脚本 + 下一步动作) |
| 事实与图片来源 | 只来自 ima 共享知识库"任德耀新建华为PC知识库"(官方 `ima_api.cjs`)。凭证缺失或接口失败时回退本地镜像,界面与结果标"本地镜像" |
| 自研边界 | 软文由 stage 5 的模型调用生成;ima 不生成任何成稿。ima 调用只限 4 个读接口 |
| 模型 | 任意 OpenAI 兼容服务,适配器统一;Codex CLI 只是可选内层驱动;提供 mock 模式 |
| 报价 | 只引用带 SKU 与核验日期的官方公开价;补贴、以旧换新、分期、赠品、库存、返利一律"待确认" |
| 运行环境 | Node.js ≥ 20(本机 v24),无第三方运行时依赖为目标;如需校验库,精确锁版本 |
| 不做 | 自研基础模型;改 Codex 源码;向 ima 写入;用外部图片补位;估算价格 |

### 1.1 术语

| 术语 | 含义 |
|---|---|
| 型号 `model_id` | 知识库内可唯一定位资料的产品身份,如 `matebook-pro-s`。见附录 A |
| SKU | 带内存、存储、屏幕款式、颜色等的具体配置,以价格快照的"精确款式"表达 |
| 事实点 Fact | 一条可引用的产品事实,绑定型号、资料、限定条件 |
| 段 Segment | 成稿的最小核验单位,一句话,带 `fact_ids` |
| 待确认 | 知识库无依据或不得自行生成的信息;进入核验分区与下一步动作 |
| origin | 数据来源标记:`ima` 或 `local_mirror` |

## 2. 总体架构与目录结构

```
Web UI ⇄ server(HTTP/SSE) ⇄ pipeline ─ stages/1..8
                                 ├─ tools/ima        (live: 官方 ima_api.cjs;mirror: 本地只读镜像)
                                 ├─ tools/llm        (http-chat | http-responses | codex | mock)
                                 ├─ tools/verify     (代码核验器)
                                 └─ tools/compliance (词表扫描 + 改写)
规则与提示词是数据文件:harness/rules、harness/prompts、harness/schemas
```

```
agent/
  harness/
    pipeline.mjs              编排、重试、降级、事件
    stages/  01-task.mjs 02-insight.mjs 03-strategy.mjs 04-retrieval.mjs
             05-draft.mjs 06-verification.mjs 07-compliance.mjs 08-export.mjs
    tools/
      ima/   index.mjs client-live.mjs client-mirror.mjs models.mjs parse-facts.mjs
             parse-images.mjs parse-prices.mjs quote.mjs
      llm/   index.mjs http-chat.mjs http-responses.mjs codex.mjs mock.mjs json.mjs
      verify/      index.mjs claims.mjs numbers.mjs images.mjs quote-check.mjs
      compliance/  index.mjs scan.mjs rewrite.mjs
      schema.mjs  prompts.mjs  rules.mjs  redact.mjs  log.mjs
    rules/    scenes.json platforms.json forbidden-words.json
    prompts/  01-role-task.md … 08-compliance.md  compose.md
    schemas/  _common.json task.json insight.json strategy.json retrieval.json
              draft.json verification.json compliance.json export.json
  server/     index.mjs routes.mjs sse.mjs runs.mjs
  web/        index.html app.js style.css
  scripts/    init.mjs  selfcheck.mjs  ima-check.mjs(已有)
  docs/       intent.md spec.md acceptance.json progress.md plan.md …
  out/        运行产物(runs/、logs/),不入库
```

模块边界:`tools/*` 不依赖 `stages/*`;`stages/*` 只通过 `ctx` 取依赖,不直接读环境变量;只有 `server` 与 `scripts` 读环境变量并构造 `deps`。
## 3. JSON 与通用约定

1. 编码 UTF-8;时间一律 ISO 8601 带偏移(`2026-10-18T14:30:00+08:00`);金额为数字,单位人民币元,不带符号;缺失用 `null`,**不得用 0 或空串代表未知**。
2. 命名:字段 `snake_case`;枚举小写英文;`id` 前缀见下表。所有对象 `additionalProperties:false`(Schema 严格),模型输出多出字段视为不合格并重试。
3. 每个阶段输出 = `{ "stage": "<name>", "schema_version": 1, ...字段 }`,由 `harness/schemas/<name>.json` 校验。`schema_version` 变更须同次提交更新 spec。
4. **待确认**统一对象 `Pending`:`{ "id":"pd1", "topic":"price|subsidy|trade_in|installment|stock|gift|rebate|policy|spec|image|model|other", "text":"…", "reason":"no_evidence|conflict|user_request_rejected|out_of_kb|image_missing", "next_owner":"store_manager|authorized_channel|content_reviewer|user", "source_stage":"…" }`。
5. **来源引用**统一对象 `Cite`:`{ "fact_id":"f3", "doc_title":"…", "media_id":"…|null", "origin":"ima|local_mirror" }`。`media_id` 仅存在于后端 run 记录;**对前端的响应中一律剔除**(见 §11.6)。
6. 引用 id 前缀:`f` 事实点、`i` 图片、`q` 报价行、`s` 段、`pd` 待确认、`v` 核验项、`c` 合规命中、`st` 演示步骤、`na` 下一步动作、`ev` 判断依据。
7. 凭证永不进入任何 JSON、日志、事件、导出。所有出站字符串经 `redact()`(§6.5)。
8. 语言:面向用户的字段为简体中文;型号、SKU 保留官方原文写法(如 `HUAWEI MateBook Pro S`)。

### 3.1 通用类型(`schemas/_common.json` 的 `$defs`)

| 类型 | 字段 |
|---|---|
| `Platform` | 枚举 `wechat_mp`(公众号) `xiaohongshu`(小红书) `moments`(门店朋友圈) `poster`(门店海报) |
| `SceneId` | 枚举 `back_to_school` `business_office` `content_creation` `home_upgrade` `enterprise_procurement` `store_visit` `new_launch` `festival` |
| `Stage` | 枚举 `task insight strategy retrieval draft verification compliance export` |
| `Degraded` | `{ "stage":Stage, "reason":"llm_failed|schema_invalid|timeout|no_data|fallback_model|mirror|mock|conflict", "detail":"…", "fallback":"…" }` |
| `Fact` | `{ id, model_id, model_name, topic, text, qualifier|null, doc_title, doc_path, media_id|null, origin, verified_on:"YYYY-MM-DD"|null, conflict_with:[fact_id] }` |
| `ImageRef` | `{ id, file_name, model_id, model_name, doc_title, doc_path, media_id|null, origin, caption_src, width|null, height|null, suggested_use, source_page_url|null }` |
| `PriceRecord` | `{ id, record_id, model_name, sku_text, price_type, amount|null, ref_amount|null, conditions, stock_text, region_text, verified_at, doc_title, doc_path, origin, official_url }` |
## 4. 数据模型:各阶段输入输出

`RunContext`(`ctx`)贯穿全程,只增不改:`{ run_id, started_at, task, insight, strategy, retrieval, draft, verification, compliance, export, degraded:[Degraded], stage_log:[StageLog], mode:{llm, ima}, revision:int }`。每阶段读前序字段、写自己的字段。`mode.ima` 取 `live|mirror`,`mode.llm` 取 `http-chat|http-responses|codex|mock`。

`StageLog = { stage, status:"pending|running|done|degraded|failed|blocked", started_at, ended_at, ms, attempts, model_used|null, degraded:Degraded|null, note }`。

### 4.1 task(阶段 1:任务补全)

**输入**:`TaskInput = { product, audience, scene, platform, description, constraints:[string], revision_request|null }`
- `product`:型号文本 / `"未定"` / 空;`audience`:自由文本;`scene`:`SceneId` 或中文场景名(代码映射);`platform`:`Platform` 或中文名;`description`:客户描述(≤2000 字);`constraints`:销售临时要求(如"加上国补立减2000")。

**输出** `task.json`:
```
{ stage:"task", schema_version:1,
  status: "ready" | "need_info" | "need_model_choice",
  normalized: { product:{ kind:"model|undecided|ambiguous", model_ids:[string], raw:string },
                audience, scene:SceneId|null, platform:Platform|null, description, quantity:int|null, budget:{min|null,max|null}|null },
  missing: [ { field:"product|audience|scene|platform", reason } ],
  questions: [ { id, field, question, type:"single|multi|text|number|model_pick", options:[string], why } ],
  model_candidates: [ { model_id, model_name, matched_on, note } ],
  rejected_requests: [ { text, kind:"price|subsidy|stock|gift|installment|trade_in|sales_volume|award|review|absolute|comparison|other", reason } ],
  degraded: Degraded|null }
```
**判定(代码)**
1. 型号解析见 §6.3。结果 `kind=model` 且唯一 → 通过;`ambiguous`(如只写"MateBook"、"Pro"、"D 16")→ `need_model_choice` + 候选清单;`undecided` → 继续(阶段 4 做型号推荐,见 §6.4);空 → `need_info`(缺 `product`)。
2. 平台、场景、人群按字典映射;缺任一 → `need_info`,`missing` 点名字段。
3. "想买轻薄本"类描述缺口:`description` 命中购买意图词但**同时**缺预算 / 用途 / 携带频率 / 多设备时,即使四必填字段已填,也追加追问(`why` 说明会影响哪个卖点)。完全空任务 + 仅描述时:四必填全部进 `missing`,并生成下列固定追问骨架(模型只润色措辞,字段由代码给定):预算区间(单选)、主要用途(多选)、携带频率(单选)、是否需要手机/平板/耳机多设备协同(单选)。
4. `constraints` 与 `description` 中的价格、补贴、国补、立减、赠品、库存、分期、以旧换新、销量、奖项、好评、最低价等表述,由代码正则 + 词表初筛后写入 `rejected_requests`(此时尚不删除原文;阶段 5 的提示词会收到"禁止写入"清单)。
5. 模型仅用于生成追问措辞与 `why`;模型不可用时用 `rules` 内置的固定追问文案。**阶段 1 不依赖模型也能完成**。

**失败降级**:模型失败 → 固定追问文案;解析失败 → `need_info`。该阶段永不抛错。

**修改场景**(`revision_request` 非空):复用上次 `task.normalized`,按请求覆盖字段(换渠道改 `platform`、换卖点写入 `constraints` 的 `focus:`前缀项,删减写入 `edits`)。见 §10.4。

### 4.2 insight(阶段 2:客户洞察卡)

模型调用(`stage=insight`)。输入:`task.normalized` + `scenes.json[scene]`(典型人群、切入点候选、禁忌)+ 提示词模块 01/02。

**输出** `insight.json`:
```
{ stage:"insight", schema_version:1,
  persona:string, usage_scene:string,
  purchase_stage:"awareness|consideration|comparison|decision|post_purchase",
  core_situation:string, concerns:[string],
  empathy_anchors:[ { id, text, detail_tags:[string] } ],   // 具体细节,如"背电脑赶早八""出差带两个充电器"
  evidence:[ { id:"ev1", claim_ref:"persona|usage_scene|purchase_stage|core_situation|concerns[0]|empathy_anchors[0]…", basis:"user_input|scene_rule|inference", quote:string|null, rule_id:string|null } ],
  content_goal: "inquiry|visit|compare|decide|refer",
  source: "model" | "rule_default",
  degraded: Degraded|null }
```
**硬规则(校验器检查)**
- 七字段齐全非空:`persona usage_scene purchase_stage core_situation concerns empathy_anchors evidence`。
- 每个判断(persona、usage_scene、purchase_stage、core_situation、每条 concern、每个 anchor)至少对应一条 `evidence`;`basis=user_input` 时 `quote` 必须是 `task.description / audience / constraints` 的**子串**(代码校验,不是模型自证)。
- `empathy_anchors[*].detail_tags` 至少 1 个具体细节词,代码用泛词黑名单("满足需求""提升效率""高效办公")拒绝纯泛词锚点。
- 输入过短(无描述)时,anchor 的 `basis` 只能是 `scene_rule`/`inference`,并在 `evidence.quote=null` 处明示"由场景规则推断"。

**降级**:2 次失败后用 `scenes.json[scene].default_persona` 构造,`source="rule_default"`,`degraded.reason="llm_failed"`,洞察卡显示"规则库默认画像"。

### 4.3 strategy(阶段 3:内容策略)

代码取规则骨架,模型只在骨架内选择与排序(`stage=strategy`)。

**输出** `strategy.json`:
```
{ stage:"strategy", schema_version:1,
  scene:SceneId, platform:Platform,
  angle:{ id, title, rationale },                           // 从 scenes[scene].angles 中选 1 个
  selling_points:[ { rank:int, key, label, why, need_topics:[fact_topic] } ],   // 排序后的卖点,key ∈ scenes[scene].selling_priority
  platform_plan:{ structure:[string], image_count:{min,max,target}, tone, cta_type, cta_hint, title_rule_ids:[string], length:{unit,min,max} },
  taboos:[ { id, text, source:"scene|platform|global" } ],
  rule_basis:[ { rule_file:"scenes.json|platforms.json", path:string, summary } ],   // 差异可解释
  query_plan:{ keywords:[string], topics:[fact_topic], want_images:{ min, max, roles:[string] }, want_price:boolean },
  single_selling_point: boolean,                            // store_visit / moments / poster 取 true 或限制 ≤3
  source:"model"|"rule_default", degraded:Degraded|null }
```
**硬规则**:`angle.id` 必须存在于 `scenes[scene].angles`;`selling_points[*].key` 必须在 `scenes[scene].selling_priority` 内;`image_count` 必须落在 `platforms[platform].image_count` 内;`rule_basis` 非空。校验不过即视为 schema 不合格重试。

**降级**:取 `scenes[scene].default_strategy` 与 `platforms[platform]` 直接拼装,`source="rule_default"`。

### 4.4 retrieval(阶段 4:资料检索)

纯代码(型号推荐的"候选理由"文字可选用模型,失败则用规则文案)。

**输出** `retrieval.json`:
```
{ stage:"retrieval", schema_version:1,
  origin:"ima"|"local_mirror",
  kb:{ name:"任德耀新建华为PC知识库", status:"connected|fallback_browse|mirror|unavailable", detail:string },   // 无 kb_id
  models:[ { model_id, model_name, role:"primary|candidate|recommended", why|null } ],
  facts:[Fact], images:[ImageRef], prices:[PriceRecord], quote:Quote|null,
  conflicts:[ { id, model_id, topic, values:[ { fact_id, value, doc_title } ], resolved:false } ],
  pending:[Pending],
  call_log:[ { seq, api:"search_knowledge_base|search_knowledge|get_knowledge_list|get_media_info|mirror_read", ok:boolean, code:int|null, ms:int, summary:string } ],
  degraded:Degraded|null }
```
`Quote = { model_name, sku_text, unit_price:number, quantity:int, subtotal:number, formula:"7999 × 3 = 23997", price_type, verified_at, channel:"华为官方商城", region_text, official_url, doc_title, record_id, notes:[string] }`;无可引用价时 `quote=null`,`pending` 追加 `topic:"price"`。

**不变量**:`call_log` 只出现 4 个读接口名与 `mirror_read`;任何 `Fact`/`ImageRef` 的 `model_id` 必须属于 `models`;一个 `Fact` 绝不跨型号。

**冲突**:同一 `model_id`+`topic`+数值类字段出现两个不同值 → 写入 `conflicts`;**存在未解决冲突时流水线在阶段 5 前进入 `blocked`**(§7.3)。

### 4.5 draft(阶段 5:内容生成)

模型调用(`stage=draft`),输入:`strategy + insight + facts + images + quote + rejected_requests + taboos`,提示词模块 01/03/04/05/06。

**输出** `draft.json`:
```
{ stage:"draft", schema_version:1, platform:Platform,
  article:{
    title_options:[string] (3),  title:string,
    lead:string|null,                                    // 公众号必有;小红书/朋友圈/海报按平台规则
    segments:[ { id:"s1", role:"lead|body|cta|caption|slogan|subtitle|selling_point|event_note", heading:string|null, text:string, fact_ids:[string], image_ids:[string], is_fact_claim:boolean } ],
    cta:{ type:"consult|visit|comment|dm|scan", text:string },
    tags:[string],                                       // 小红书话题标签;其他平台可空
    poster:{ main_title, subtitle, points:[{ text, fact_ids }], event_note, qr_hint }|null
  },
  image_plan:[ { image_id, insert_after:"segment_id|top|cover", role:"cover|scene|detail|evidence|cta", caption:string, on_image_text:string|null } ],
  quote_block:{ quote_id|null, lines:[ { text, quote_ref:"q1", fact_ids:[] } ], footnote:string, pending_notes:[string] }|null,
  demo_script:{ goal:string, duration_min:int, prep:[string], steps:[ { id:"st1", seq:int, action:string, say:string, highlight_fact_ids:[string], checkpoint:string, pitfall:string|null } ], objection_handling:[ { objection, reply, fact_ids:[] } ] },
  next_actions:[ { id:"na1", seq:int, action:string, when:string, script:string, owner:"sales|store_manager|customer", depends_on_pending:[pending_id] } ],
  fact_digest:[ { fact_id, text } ],                    // 降级输出用
  degraded:Degraded|null }
```
**硬规则**
- 所有事实性句子 `is_fact_claim=true` 且 `fact_ids` 非空;无法找到依据的叙述性句子(共情、过渡、行动邀请)才允许 `is_fact_claim=false`。
- `image_plan[*].image_id` 必须来自 `retrieval.images`;数量落在平台区间内;**可用图不足时,允许少于下限并产生 `Pending(topic:"image")`,不得补外部图**。
- 报价只通过 `quote_block` 表达,数字必须与 `retrieval.quote` 完全一致;`quote=null` 时 `quote_block.quote_id=null`,正文不得出现价格数字。
- 不得写入 `rejected_requests` 中的任何内容。

**降级**:2 次失败后只输出 `fact_digest`(取 `strategy.selling_points` 对应 `facts` 前 N 条,每条附出处),`article.title` 使用"{型号}要点清单",`degraded.fallback="fact_digest"`;`demo_script` 与 `next_actions` 使用 `scenes.json[scene].default_demo_outline` 的骨架(仅含步骤和话术框架,**不含未经核验的事实**)。

### 4.6 verification(阶段 6:事实与图片核验)

代码核验(§8),可选模型补充"语义事实抽取"(`claims` 抽取失败不影响代码路径)。

**输出** `verification.json`:
```
{ stage:"verification", schema_version:1,
  facts:[ { id:"v1", segment_id, claim:string, claim_type:"number|model|spec|feature|price|image_caption|other",
            value:string|null, status:"supported|unsupported|conflict|pending|removed", fact_id:string|null, doc_title:string|null, note:string, action:"keep|delete|mark_pending|rewrite" } ],
  images:[ { image_id, file_name, image_model, text_model, status:"match|mismatch|unknown|origin_invalid", action:"keep|remove|pending", reason } ],
  prices:[ { quote_ref, status:"match|mismatch|no_evidence|rejected", recomputed:{ formula, result:number }|null, note } ],
  removed_segments:[ { segment_id, reason } ],
  pending:[Pending],
  conflicts:[ …retrieval.conflicts…],
  final_article:{ …同 draft.article,已删改后的版本… },
  final_image_plan:[ …同 draft.image_plan,已剔除后的版本… ],
  verdict:"pass"|"pass_with_pending"|"blocked",
  blocked_reason:null|"conflict"|"all_facts_removed"|"model_mismatch",
  stats:{ claims_total, supported, unsupported, removed, pending },
  degraded:Degraded|null }
```
**规则**:`unsupported` 且所在段 `is_fact_claim=true` → `action:"delete"`(若段内仅部分句无依据,则 `rewrite` 删句保段);数字/型号/参数类 claim 必须逐条出现在 `facts` 中(AC-020 抽查口径);`final_article` 中**不得**残留 `unsupported`/`conflict` 的 claim。

### 4.7 compliance(阶段 7:合规检查)

**输出** `compliance.json`:
```
{ stage:"compliance", schema_version:1,
  rounds:[ { round:int(1..3), scan:{ ran:true, hits:[Hit] }, review:{ ran:boolean, source:"model|skipped", findings:[Finding] }, rewrite:{ applied:boolean, changes:[ { segment_id, before, after, hit_ids:[] } ] }, recheck:{ verification_passed:boolean, scan_hits_left:int } } ],
  hits_total:int,
  by_category:{ absolute:int, false_promise:int, price_misleading:int, ungrounded_comparison:int, competitor_disparage:int },
  verdict:"pass"|"pass_after_rewrite"|"needs_manual",
  manual_items:[ { id, text, category, why } ],
  final_article:{ …最终稿… }, final_image_plan:[…],
  degraded:Degraded|null }
```
`Hit = { id:"c1", category, word, pattern_id, segment_id, span:[start,end], text_excerpt, suggestion }`;`Finding = { id, category, segment_id, text_excerpt, reason, suggestion }`(语义复查发现的暗示性夸大、隐含对比等)。

**流程**(§9):词表扫描(代码,必执行)→ 模型语义复查(可降级为 `skipped`)→ 命中则改写(代码优先,必要时模型)→ **回到阶段 6 核验器重验** → 再扫描。最多 2 轮改写;第 3 次扫描仍命中 → `needs_manual`。

### 4.8 export(阶段 8:导出)

纯代码,生成六个分区的展示/复制/导出数据。

**输出** `export.json`:
```
{ stage:"export", schema_version:1,
  status:"complete"|"complete_with_pending"|"manual_required"|"incomplete_info",
  mirror_notice: string|null,                           // origin=local_mirror 时必有:"本地镜像"
  sections:{
    s1_scene:   { audience, usage_scene, user_problem, content_goal, platform, scene_label, strategy_basis:[…] },
    s2_basis:   { models:[…], facts:[ { fact_id, model_name, text, qualifier, doc_title, origin } ], doc_titles:[string] },
    s3_article: { title, lead, body:[ { id, heading, text, images:[image_id] } ], cta, tags, poster, images:[ { id, name, source_doc, insert_position, caption } ] },
    s4_verify:  { facts:[…], image_models:[…], compliance:{ …摘要… }, pending:[Pending] },
    s5_insight: { …insight 展示化… },
    s6_plan:    { quote_block, demo_script, next_actions, price_notes:[string] }
  },
  progress:[StageLog], degraded:[Degraded],
  copy_text:string,                                     // 纯文本,可粘贴
  files:[ { name, mime, bytes:int } ] }                 // GET 导出时生成
```
分区命名与前端对应:`s1_scene`=场景判断,`s2_basis`=知识库依据,`s3_article`=图文软文,`s4_verify`=核验结果,`s5_insight`=客户洞察卡,`s6_plan`=演示脚本与下一步动作(含报价)。
`status` 规则:有 `blocked`/`needs_manual` → `manual_required`(**`copy_text` 不输出成稿**,只输出阻塞说明);有 `pending` 但通过 → `complete_with_pending`。
## 5. 规则库、提示词、Schema 的文件契约

### 5.1 `harness/rules/scenes.json`

```
{ version, selling_point_catalog:{ "<key>": { label, need_topics:[fact_topic], proof_hint } },   // 全局卖点目录,key 唯一
  scenes:{ "<SceneId>": {
    label, aliases:[string],
    audiences:[string],                          // 典型人群
    angles:[ { id, title, when, rationale } ],   // 切入点候选(≥3),id 在全场景范围内唯一
    selling_priority:[ { key, weight, note } ],  // key ∈ catalog;按 weight 降序为默认顺序;策略阶段只能在此集合内选择与重排
    taboos:[ { id, text, check } ],
    single_point:boolean, max_points:int,
    purchase_stage_default, content_goal_default,
    default_persona:{ persona, usage_scene, core_situation, concerns:[string], empathy_anchors:[ { text, detail_tags } ] },
    default_strategy:{ angle_id, point_keys:[string] },
    default_demo_outline:[ { action, say_frame } ],     // say_frame 中 {{fact:<topic>}} 由代码用首条 supported 事实填充;无事实则整步丢弃
    next_action_templates:[ { action, when, script_frame, needs_pending } ],
    recommended_models:[ { model_id, fit_topics:[fact_topic], note } ]   // 型号推荐用,model_id 必须在附录 A;note 只写选型方向,不含任何参数
} } }
```
`taboos[*].check` 取值(代码实现):
- `{ "kind":"forbid_regex", "patterns":[string], "except_near":string|null }`:成稿文本命中即违规;`except_near` 为附近出现则豁免的正则(如"待确认")。
- `{ "kind":"require_groups", "groups":{ "<g>":[fact_topic] }, "min":int }`:成稿所覆盖的事实主题须至少落在 `min` 个组内。
- `{ "kind":"max_points", "n":int }`:核心卖点数上限。
- `{ "kind":"pending_if_requested", "triggers":[string], "topic":"policy|price|subsidy|stock|gift|installment|trade_in|other", "next_owner":"store_manager|authorized_channel" }`:任务描述/修改要求命中触发词时,不写入成稿,转 `rejected_requests` 与 `Pending`。

`fact_topic` 枚举:`identity os weight thickness dimensions display_size display_type resolution refresh brightness color_gamut processor memory storage battery charging ports keyboard camera audio wireless apps_collab accessories package privacy pen limitation`。

### 5.2 `harness/rules/platforms.json`

```
{ version, platforms:{ "<Platform>": {
    label, aliases,
    structure:[ { slot, required:boolean, desc } ],
    image_count:{ min, max, target },
    length:{ unit:"chars", min, max, lead_min, lead_max },
    tone:{ voice, do:[string], dont:[string] },
    cta:{ type, hint, examples:[string], forbidden:[string] },
    title:{ count:3, min_chars, max_chars, rules:[ { id, text } ] },
    tags:{ required:boolean, min, max },
    image_roles_order:[string],
    first_person_experience:"forbidden",         // 全平台一致,小红书重点
    price_policy:"quote_block_only|footnote|none"
} } }
```

### 5.3 `harness/rules/forbidden-words.json`

```
{ version,
  categories:{ "<cat>": { label, description, entries:[ { id, pattern, type:"literal|regex", severity:"block|warn", suggestion, example_bad, example_good, exempt:[ { when_context } ] } ] } },
  supplementary:{ "<id>": { label, description, report_as:"<cat>", entries:[…同上…] } },   // 虚构体验、虚构销量/奖项/评价:归并上报到五类之一
  semantic_hints:{ "<cat>":[string] },                                                   // 给模型复查的暗示性表达线索
  scan_scope:[string], exempt_window:12 }
```
`cat` ∈ `absolute false_promise price_misleading ungrounded_comparison competitor_disparage`(绝对化、虚假承诺、价格误导、无依据对比、竞品贬低)。`exempt.when_context` 是正则,只在命中位置**前后各 `exempt_window` 个字符**内检验,窗口内匹配则豁免该命中(例:技术参数"最高 1600 尼特"中的"最高"后紧跟数字,不按绝对化拦截)。`literal` 条目比较前对文本与词条做全半角、大小写、空白归一化。

**与 AC-031 的出入**:验收清单写"`harness/rules/forbidden-words` 下四类独立词表",而本次任务要求为单文件 `forbidden-words.json` 且含五类(含"无依据对比")。设计按任务要求落地:一个文件、五个顶层类键各自独立维护。出入已记入 `progress.md`,不改验收清单。

### 5.4 `harness/prompts/*.md`

每个文件 front-matter:
```
---
module: 01-role-task
used_by: [insight, strategy, retrieval-reco, draft, verification, compliance]
variables: [ ... 运行时由 prompts.mjs 注入的变量名 ... ]
---
```
正文固定小节:`## 角色`、`## 任务`、`## 必须`、`## 禁止`、`## 判断流程`、`## 输出要求`、`## 反例与正例`。`compose.md` 描述每阶段拼接哪些模块、顺序、变量与模型调用参数。**提示词中不得出现任何具体平台图数、卖点列表、违禁词清单**——这些由 `prompts.mjs` 从规则库注入占位符 `{{platform_rules}}`、`{{scene_rules}}`、`{{forbidden_summary}}`,保证修改规则文件无需改提示词(AC-053)。

### 5.5 `harness/schemas/*.json`

JSON Schema draft 2020-12 子集:`type properties required enum items minItems maxItems minLength maxLength pattern additionalProperties $ref($defs) oneOf(仅限 null 联合) const`。`tools/schema.mjs` 自带最小校验器(不引入依赖),并导出 `strictify(schema)`:给 `--output-schema`/`response_format` 使用时补全 `required` 与 `additionalProperties:false`(OpenAI strict 模式要求)。可选字段用 `["type","null"]`,不使用缺省。

## 6. 数据层:tools/ima

### 6.1 对外接口(`tools/ima/index.mjs`)

```js
createImaTool(opts) => ImaTool
// opts: { env, mirrorRoot, apiScript, cacheDir, logger, forceMode?: 'live'|'mirror' }

interface ImaTool {
  status(): Promise<KbStatus>                  // 状态卡用:不含 kb_id、不含完整密钥
  resolveModels(text: string): ModelResolution // 纯函数,见 §6.3
  retrieve(req: RetrieveReq): Promise<RetrievalResult>
}
type KbStatus = { name, state:'connected'|'no_credential'|'not_joined'|'error'|'mirror', origin:'ima'|'local_mirror',
                  account:{ client_id_tail:string|null, api_key_tail:string|null }, last_api:{ name, code, msg }|null, root_items:int|null, checked_at }
type RetrieveReq = { model_ids:string[], topics:string[], keywords:string[], want_images:{min,max,roles:string[]}, want_price:boolean, quantity:int|null }
type RetrievalResult = Omit<RetrievalOutput,'stage'|'schema_version'>   // 即 §4.4 的字段
```

### 6.2 live 客户端(`client-live.mjs`)

- 通过 `createRequire` 加载官方 `../ima-skills-1.1.10/ima-skill/ima_api.cjs` 的 `imaApi(path, body, { lastCheckFile })`(与现有 `scripts/ima-check.mjs` 同法);**不自写 HTTP 调用,不改官方脚本**。
- **只允许 4 个路径**:`openapi/wiki/v1/search_knowledge_base | get_knowledge_list | search_knowledge | get_media_info`。封装层白名单,其他路径抛 `IMA_FORBIDDEN_API`(AC-048)。
- 检索流程(单型号,按序):
  1. **A** `search_knowledge_base{query:IMA_KB_NAME,cursor:"",limit:20}` → 取 `data.info_list[0]`;`kb_id` 兼容字段名 `id` / `kb_id`,名称 `name` / `kb_name`(实测文档与手册字段名不一致,均要兼容)。kb_id 缓存到 `.cache/kb-meta.json`,**仅内存与缓存使用,永不进入响应/日志/事件**。
  2. **C** `search_knowledge{query,knowledge_base_id,cursor:""}`,`query` 取"{型号全名} {主题词}",对每个主题分别检索(并发 ≤ 3)。
  3. 命中过滤:`title` 或 `highlight_content` 必须包含目标型号的**精确别名**之一(附录 A),且不包含"更长同族型号"的别名(见 §6.3 排他规则);不满足的命中丢弃并记 `call_log`。
  4. **D** 对保留命中调用 `get_media_info{media_id}`:`data.url_info.url`(+`headers`)→ 用内置 `fetch` 取原文文本(只读 GET;`headers` 原样透传;禁止其他方法)。`media_type=11`(笔记)不支持,标 `pending`。取文失败 → 该资料记 `pending`,不终止。
  5. **B(回退)**:`search_knowledge` 空结果,或 D 全部失败 → `get_knowledge_list` 分页浏览根目录,按目录名前缀 `P1-` 进入"产品参数库",再逐级按 `folder.name` 精确匹配型号目录(去除空格大小写比较),列出该型号下条目;优先取标题含 `产品事实`/`article`/`卖点与限制` 的条目,调用 D 读取。分页遵循 `cursor/is_end`,上限 20 页。**"搜索无结果"绝不当作无权限而中断**。价格同理走 `P1-产品参数库/08-官方公开价格快照`。
  6. 仍无 → 写 `pending(reason:no_evidence)`,继续。
- 每次调用写 `call_log`(接口名、`ok`、`code`、耗时、摘要);摘要不得含 `media_id`/`kb_id` 值(用序号替代)。
- 错误分类(`IMA_NO_CREDENTIAL` `IMA_UPDATE_AVAILABLE(-200)` `IMA_API_ERROR(code≠0)` `IMA_NETWORK` `IMA_NOT_FOUND_KB` `IMA_PARSE`)。`-200`(技能有新版本)**不是失败**:官方脚本已输出更新信息到 stdout 并抛错,封装层捕获后以 `forceCheck:false` + 当日已检查标记重试一次,仍抛则视作可忽略并继续使用 `lastCheckFile` 写入当天日期。
- 超时:单次调用 15s,最多重试 2 次(指数退避 500ms/1500ms)。全局检索阶段预算 40s;超预算立刻走镜像。

### 6.3 型号解析(代码,`models.mjs`)

目标:相近型号**精确**匹配,歧义时追问,绝不猜。

1. 规范化:全角转半角、统一空格、去除 `HUAWEI` 前缀与"华为"、大小写不敏感、`（鸿蒙版）`/`(鸿蒙版)`/`鸿蒙版` 视为同一后缀。
2. 对每个型号维护 `aliases`(附录 A)和 `excludes`(更长同族型号的特征片段)。匹配采用**最长别名优先 + 词边界**:
   - "MateBook Pro S" 命中 `matebook-pro-s`,**不**命中 `matebook-pro`。
   - "MateBook Pro" 只命中 `matebook-pro`(因为后接词边界,不是 `Pro S`)。若用户写"MateBook Pro",**仍视为 `matebook-pro`(鸿蒙版)明确**,但因相近型号 `Pro S`、`X Pro` 存在,`task.questions` 附一条"确认是否为 Pro 而非 Pro S/X Pro"的**只读确认**(不阻塞,单选默认 Pro)。
   - "D 16" 命中 `matebook-d-16`;"D 16 SE" 命中 `matebook-d-16-se`;二者互斥。
   - "MateBook"、"Pro"、"轻薄本"、"折叠" 等 → `ambiguous`,返回候选(同族全部)。
3. 一次任务允许多个型号(对比类);`product.kind=model` 且 `model_ids.length≥1`。主型号 = 第一个。
4. 核验期复用同一解析器检查**成稿文本**中出现的型号名,出现不属于 `models` 的型号即 `mismatch`(§8.4)。

### 6.4 型号推荐(`product=未定`)

1. 代码按 `scenes[scene].recommended_models` 取候选,再用 `platform`/`description` 关键词(预算、携带、屏幕、创作等)做加权筛选,取前 2–3 个;
2. 对每个候选**确认知识库中能读到资料**(live 读 P1,或镜像读取);读不到的候选剔除;
3. 候选理由 `why` 由规则文案 + 事实点拼成(模型可润色,不得新增事实);
4. 默认选第一个候选继续跑流水线(`role:"recommended"`),同时在 `s1_scene` 展示"推荐型号及理由",并允许用户在页面切换后重跑。**不得出现知识库找不到资料的推荐型号**(AC-003)。

### 6.5 凭证与脱敏(`redact.mjs`)

- 仅读 `IMA_OPENAPI_CLIENTID`、`IMA_OPENAPI_APIKEY`、`LLM_API_KEY`;`.env` 手动解析且**不覆盖**已有环境变量(与 `ima-check.mjs` 一致)。
- `tail(v)`:取末 4 位,`****a1b2`;短于 8 位全遮。
- `redact(str)`:精确替换已知凭证完整值与 `kb_id`、`media_id`,并用正则遮盖 `(Bearer\s+)\S+`、`sk-[A-Za-z0-9_-]{16,}`、`ima-openapi-(clientid|apikey)\s*[:=]\s*\S+`。所有日志、SSE 事件、错误信息、导出文件在写出前调用。
- 状态卡 `account` 仅含两个尾号。

### 6.6 本地镜像客户端(`client-mirror.mjs`)

根 `MIRROR_ROOT`(默认 `D:\vibe\aix\华为PC全板块深度知识库_v7`,环境变量 `KB_MIRROR_ROOT` 可覆盖),**只读**:模块不导入 `fs.write*`/`rm`/`rename` 等;所有路径经 `path.resolve` 后必须以根为前缀(防穿越)。

读取映射(相对根):

| 用途 | 路径 | 格式 |
|---|---|---|
| 事实 | `P1-产品参数库/{01-鸿蒙电脑\|02-MateBook-Windows}/{目录}/产品事实.md` | Markdown(见 §6.7) |
| 卖点与限制 | 同目录 `卖点与限制.md` | Markdown |
| 图片 | 同目录 `图片索引.csv` + `images/<文件名>`;全局 `P1-产品参数库/00-全库横向索引/全部图片联合检索表.csv` | CSV(UTF-8 BOM) |
| 价格 | `P1-产品参数库/08-官方公开价格快照/官方价格快照.csv`;逐产品 `01-消费级PC/{规范名}-价格卡.md` | CSV(UTF-8 BOM)/ Markdown 表 |
| 价格规则 | `…/08-官方公开价格快照/01-字段字典与调用规则.md` | 参考,不解析 |
| 来源清单 | 同目录 `来源清单.csv` | CSV |
| 平台模板 | `P6-营销素材库/02-平台模板/*.md` | 仅供人读/提示词参考,**不当事实** |
| 智能体规则 | `00-建库规范/06-智能体规则/{检索顺序,引用格式,拒答与转人工}.md` | 规则参考 |

镜像模式下 `origin="local_mirror"`,`media_id=null`,`doc_path` 为相对路径;`kb.status="mirror"`;**所有输出层(状态卡、分区二、导出文件头)必须显示"本地镜像"**(AC-042)。CSV 读取须去 BOM,处理含逗号的引号字段(自带最小 CSV 解析器)。

**镜像与 ima 库同源性未确认**(intent 待决 #4)。解析器针对 Markdown 文本编写,不依赖文件名;同一份 `parse-facts` 同时处理 ima 取回的原文与镜像文件(ima 文档标题若为 `产品事实`/`article`,按内容识别,而不是按路径)。

### 6.7 事实点解析(`parse-facts.mjs`)

输入:产品事实 Markdown;输出 `Fact[]`。

格式观察(已核对 Pro S、Pro、D 16、Fold、X Pro):
```
# {型号全名} - 产品事实
> 来源：…抓取日期：2026-10-17。配置可能因销售版本而异…
## 来源            (产品页/规格页 URL)
## 官方规格摘录
## 操作系统  → 行 "HarmonyOS 6.1"
## 尺寸与重量 → 键值对:单独一行的键("宽度") 后接值行;多版本值行带前缀 "HUAWEI MateBook Pro S 标准屏版：798 g"
## 屏幕 / 处理器 / 存储 / 内存 / 无线连接 / 电池 / 接口 / 键盘和触控板 / 摄像头 / 音频 / 特色应用 / 包装清单
   以 "*" 开头的行是脚注(限定条件),如 "*典型值，数据来源于华为实验室。需关闭防窥模式…"
```
算法:
1. 取 `# ` 标题得 `model_name`;`> 来源…抓取日期：YYYY-MM-DD` 得 `verified_on`。
2. 按 `## ` 分块得 `topic`(中文节名→`fact_topic` 映射表:操作系统→os、尺寸与重量→weight/thickness/dimensions、屏幕→display_*、处理器→processor、存储→storage、内存→memory、电池→battery、接口→ports、键盘和触控板→keyboard、摄像头→camera、音频→audio、特色应用→apps_collab、包装清单→package、无线连接→wireless)。
3. 块内行配对:短行(≤16 字且无句号)后接值行视为 `键 → 值`;每对生成一条 `Fact.text = "{键}：{值}"`(多版本值保留版本前缀,如"标准屏版 798 g")。无键的行(如"HarmonyOS 6.1"、"麒麟XE90 处理器")直接成条。
4. **限定条件**:同块内紧随的 `*脚注` 行归入 `qualifier`(挂到该块所有数值事实);`## 来源` 下的"配置可能因销售版本而异"作为全局 `qualifier` 附加到所有 `weight/memory/storage/battery/display_*` 事实。
5. 分号式条目(`全型号参数联合矩阵.csv` 风格 "尺寸；14.2 英寸；类型；…")**只用于定位,不作为事实源**;事实一律来自逐型号 `产品事实.md`。
6. `卖点与限制.md`:解析"六个沟通角度"下的 `支撑事实` 列表 → `Fact(topic 按角度归类)`;`表达边界` 列表 → `Fact(topic:"limitation")`(用于约束生成与核验);`不适合直接下结论的任务`、`发布或销售前必须追问` 同入 `limitation`。**限制类事实不可当作卖点输出,只用于约束与"需先追问"的提示**。
7. 事实 id 稳定:`f{序号}`,同一 run 内递增;`doc_title` = 文件内 H1;`doc_path` = 来源路径。
8. 冲突检测:同 `model_id`+`topic`+归一化键(如"重量"+版本前缀)若出现两个不同归一化数值 → `conflict_with` 互指,汇总到 `retrieval.conflicts`。同一文件内不同版本的不同数值(标准屏 798 g vs 典藏版 825 g)**不是冲突**,因为版本前缀不同。

### 6.8 图片解析(`parse-images.mjs`)

来源:型号目录的 `图片索引.csv`。字段(实测列名):`文件名, 产品型号, 来源页面, 原始图片URL, 官网图片说明, 宽度, 高度, 建议用途`(联合表列名为 `文件名, 产品型号, 画面说明, 原始图片URL, 页面来源, 本地目录`,字段名不同,两种都要处理)。

1. `ImageRef.model_name` = `产品型号` 列;**联合表中 `产品型号` 为空的 59 行(商城专区/B 站素材等)一律视为"型号未知",不得选用**(`status:"unknown"` → 剔除)。
2. 文件名命名规则 `hwpc_{型号短名}_{画面主题}_{序号}_{hash}.{ext}`,从文件名截取 `型号短名`,必须与目录型号的 `file_slug`(附录 A)一致,否则剔除——这是第二道型号闸门(CSV 列与文件名交叉校验)。
3. `caption_src` = `官网图片说明`/`画面说明`;`suggested_use` 读 `建议用途`("产品介绍配图，使用前核对画面与具体配置");`source_page_url` = `来源页面`。
4. 选择(`pickImages`,代码):按 `strategy.query_plan.want_images.roles` 与 `画面主题` 关键词(外观/屏幕/协同/续航/细节)打分,尊重 `platforms.image_roles_order`;去重;`n` 取 `image_count.target`,不足下限时只产出 `pending(topic:image)`。**不得用其他型号图补位**。
5. 图片只记引用(`file_name`、`doc_path`、原始 URL、说明),**不下载、不复制、不改尺寸**;前端展示时按比例缩放(`object-fit: contain`),海报主视觉保持原宽高比(AC-012)。镜像模式下可通过 `GET /api/image/:image_id` 读取镜像内的原图文件(只读),live 模式前端直接以 `source_page_url` 作为来源链接,图片预览以 `原始图片URL` 加载(若加载失败,显示文件名与说明占位)。

### 6.9 价格解析与报价(`parse-prices.mjs`、`quote.mjs`)

`官方价格快照.csv` 实测列(UTF-8 BOM):`记录ID, 规范产品名称, 原始产品名称, 分类, 精确款式, 型号或SKU, 价格类型, 页面金额（元）, 参考或划线金额（元）, 条件摘要, 库存状态, 地区上下文, 登录状态, 核验时间, 来源标题, 官方URL, 取证方式, 证据摘要, 核验状态, 映射备注, 原始记录ID`。141 行,`分类=消费级PC` 的 10 个规范产品名与附录 A 对应。

价格类型枚举(原样保留):`官方商城页面价, 当前商城页面价, 当前商城页面价（未扣优惠券）, 当前商城页面价（缺货）, 当前商城活动页价, 预估到手价, 搭配购/加购价, 官网参考起价, 官方询价, 当前商城状态, 无当前公开商城价, 未公开金额`。

**可引用报价的条件(全部满足)**:
1. `规范产品名称` 与主型号精确对应;
2. `精确款式` 能解析出 **SKU 要素**(内存/存储/屏幕款/颜色 至少含内存与存储),**"专区默认展示款"、"官网产品页对应版本"、空款式不得当 SKU 报价**;
3. `价格类型 ∈ {官方商城页面价, 当前商城页面价}` 且 `页面金额` 非空;
4. `核验时间` 非空;`核验状态` 含"已核验";
5. 库存状态不含"下架/无货/缺货"。
满足则可用于 `Quote`;其余(参考起价、预估到手价、搭配价、询价、下架)**只可作为"参考/说明"列示,标明类型,不得进 `unit_price`**。

**SKU 选择**:任务 `description`/`constraints` 中出现内存/存储/屏幕/颜色关键词时按其匹配;匹配 0 条 → 不报价并追问(`questions` 里补"内存/存储/屏幕版本");匹配 >1 条 → 取字面一致度最高者,并把其他列为"备选配置"。**不得"取最低价"代替用户选择**。

**算术**:`subtotal = unit_price × quantity`(整数元;`quantity` 缺省 1)。`formula` 形如 `7999 × 3 = 23997`。核验器独立重算(§8.5),不一致则整块 `quote_block` 删除并标待确认。

**条件展示**:`条件摘要` 里的赠品、分期、积分、晒单、赠送积分、券 **不参与算术,只以"页面当时展示的条件(待结算页确认)"逐字复述并标"待确认"**;不换算月供;不加减赠品价值。**已记载的优惠扣减**:仅当记录类型本身是"预估到手价/优惠券价"且条件完整时才可展示为"页面预估到手价(含条件)",且**不得与现价相减得出"立省 X 元"**(价格误导)。

**页脚模板(必填)**:`价格口径：{价格类型}；渠道：华为官方商城；地区：{地区上下文}；核验时间：{核验时间}；SKU：{精确款式}；出处：{来源标题}。库存、赠品、分期、补贴、以旧换新等以结算页及授权渠道为准,待确认。`

报价被用户要求"去掉条件"、"加国补"、"写最低价"时:写 `rejected_requests` + `pending(user_request_rejected)`,`next_actions` 加 `owner:store_manager` 的核实动作(AC-032)。

镜像模式下 CSV 直接取;live 模式下 `P1-产品参数库/08-官方公开价格快照` 目录进入后读取 `官方价格快照.csv` 或对应价格卡 Markdown 的表格(同一解析器按表头识别)。
## 7. 流水线:pipeline

### 7.1 接口

```js
// harness/pipeline.mjs
createPipeline(deps) => Pipeline
// deps: { ima:ImaTool, llm:LlmClient, rules:Rules, prompts:Prompts, schemas:SchemaRegistry, verify:Verifier, compliance:ComplianceTool,
//         clock:()=>Date, logger:Logger, config:PipelineConfig }
interface Pipeline {
  run(input: TaskInput, hooks: { onEvent(e: PipelineEvent): void, signal?: AbortSignal }): Promise<RunResult>
  revise(runId: string, revision: RevisionRequest, hooks): Promise<RunResult>
  resume(runId: string, answers: Answers, hooks): Promise<RunResult>      // 追问后继续
}
type RunResult = { run_id, status:'done'|'need_info'|'need_model_choice'|'manual_required'|'error', ctx:RunContext, export:ExportOutput|null }
type PipelineConfig = { maxAttempts:2, stageBudgetMs:{ task:3000, insight:45000, strategy:30000, retrieval:40000, draft:90000, verification:10000, compliance:40000, export:2000 }, maxComplianceRounds:2 }
```
`run()` **永不 reject**(除 `AbortSignal` 主动取消):任何异常在阶段层被捕获并降级;最外层再包一层 `try/catch`,极端情况下返回 `status:'error'` 并带可读 `reason` 与已完成阶段结果(而非空白)。

### 7.2 阶段包装(每阶段统一)

**重试口径**:设计书与 AC-040 写"重试最多 2 次"。本规格定义为**首次调用 + 最多 2 次重试 = 至多 3 次尝试**;`StageLog.attempts` 记录总尝试数,重试次数 = `attempts - 1`,不超过 2。进度条显示"重试 n 次"。

```
runStage(name, fn):
  emit stage_start
  for attempt in 1..3:
      if attempt>1: emit stage_retry{attempt, error}; wait(backoff)
      out = await fn(attempt)                    // 模型阶段在内部先主模型,失败再备用模型(§10.4),二者算同一次尝试
      errs = schema.validate(stage, out) ++ domainValidate(stage, out)
      if errs.empty: emit stage_done; return out
      lastErr = errs
  // 3 次均失败
  out = fallback(stage, ctx, lastErr)            // 每阶段有确定性降级函数,见 §4 各节"降级"
  ctx.degraded.push(...); emit stage_degraded
  return out
```
`domainValidate` 为代码校验(例:洞察 `quote` 必须是输入子串、策略 `angle.id` 合法、草稿 `image_id` 合法)。校验错误文本会追加进下一次尝试的提示("上次输出的问题:…请修正"),让重试有信息增量。

### 7.3 阶段顺序、闸门与阻塞

```
1 task ─ need_info/need_model_choice → 返回(流水线暂停,不报错)
2 insight ─ 3 strategy ─ 4 retrieval
        └ 若 retrieval.conflicts 未解决 → status=manual_required,跳到 8 export(只含冲突说明)
5 draft ─ 6 verification ─ 7 compliance(内含与 6 的回环) ─ 8 export
```
- 阶段 2、3 可并行吗?**不可**:3 依赖 2 的 `content_goal`/`concerns`。阶段 4 的检索关键词只依赖 `task` 与场景规则,**可与 2、3 并行启动以压缩时延**:推荐 `await Promise.all([runInsightAndStrategy(), prefetchRetrieval()])`,但 retrieval 的"按策略选图/选事实"部分在 3 完成后执行(`retrieval.fetch`(取全量候选)先行,`retrieval.select`(按 `query_plan` 筛选)后行)。该优化可选,默认串行,保证简单可靠;由 `config.parallelPrefetch` 控制。
- 闸门(门禁)判定见 §8.6、§9.4,不通过**不抛错**,而是把 `status` 标为 `blocked/needs_manual` 并让 export 输出阻塞说明。
- 资料冲突:阶段 4 → 5 之间硬阻塞。`export.status=manual_required`,`sections.s4_verify.conflicts` 列出冲突项、数值、来源标题;页面提示人工确认(AC-022)。

### 7.4 事件(`PipelineEvent`)

```
{ type:'run_start',    run_id, at, mode:{llm,ima}, mirror:boolean }
{ type:'stage_start',  stage, at }
{ type:'stage_retry',  stage, attempt, error_summary }
{ type:'model_switch', stage, from, to, reason }
{ type:'stage_degraded', stage, degraded:Degraded }
{ type:'stage_result', stage, status:'done|degraded|failed|blocked', ms, attempts, model_used, payload:<阶段输出的展示化精简版,已 redact 且无 media_id/kb_id> }
{ type:'need_info',    run_id, questions, missing }
{ type:'blocked',      run_id, reason, items }
{ type:'log',          level:'info|warn', text }          // 检索调用日志、合规轮次等(已 redact)
{ type:'run_done',     run_id, status, export_ref }
{ type:'error',        message }                          // 仅极端情况
```
事件即 SSE 事件载荷(§11.3),`payload` 逐阶段立即推送(AC-043)。

## 8. 核验器:tools/verify

### 8.1 接口

```js
createVerifier(deps) => {
  verify(input: { draft, retrieval, task, rules }): VerificationOutput      // 纯代码,同步,无网络
  recheck(article, retrieval): { passed:boolean, issues:Issue[] }            // 合规改写后重验用,同一实现
}
```

### 8.2 句级 claim 抽取(`claims.mjs`)

对 `draft.article.segments` 与 `poster/points/lead/cta/title`:
1. 按中文标点切句(`。！？；\n`),保留 `segment_id` 与偏移。
2. 代码抽取 claim 候选(**不依赖模型**):
   - **数字类**:正则捕获 `数值 + 单位`(`\d+(\.\d+)?\s*(mm|g|kg|英寸|寸|Hz|nits|尼特|Wh|W|GB|TB|%|小时|h|ppi|PPI|:|×|x|期|元)`)、`3:2`、`3120 × 2080`、年份+型号。
   - **型号类**:`models.mjs` 解析器在文本中找型号名;
   - **参数/功能类**:`facts` 的每条 `text` 先切出"关键词指纹"(型号、屏幕类型词、芯片名、接口名、功能名)——文本中出现指纹即视为涉及该事实;
   - **价格类**:`¥`、`元`、`起`、"到手"、"优惠"、"立减"、"补贴"、"国补"、"券"、"分期"、"赠"。
3. 可选模型补充抽取(`llm.verifyClaims`):仅用于发现代码漏掉的**功能性断言**(如"支持 X 功能");失败则跳过,标 `degraded:false`(非降级)。

### 8.3 与事实点比对(`numbers.mjs`、`index.mjs`)

- **数字归一化**:去空格、全半角、`×`/`x`/`X` 统一、`mm`↔`毫米`、`英寸`↔`寸`↔`"`、千分位;`1.6 kg`↔`1600 g` 通过单位换算比较;范围写成"约/左右"不放宽数值本身。
- **判定**:
  - `supported`:该 claim 的**每个数字**都能在**同一型号**的事实点(含其 `qualifier`)里找到等值/等价项,且关键词指纹至少命中一条同主题事实;
  - `conflict`:同主题事实中存在**不同**数值(例:文中"约 1.6 kg" 而事实为 "1.7 kg");或两个事实点互相冲突;
  - `unsupported`:找不到任何同型号事实支撑;
  - `pending`:claim 属于动态信息(价格/补贴/库存等)且无 `Quote` 支撑。
- **限定条件检查**:若事实 `qualifier` 含"典型值/实验室/需关闭防窥/依配置而异",而正文数字出现**未带任何限定语**("峰值亮度 1600 尼特"无"HDR/局部/实验室"等限定),则该 claim 判 `supported` 但 `action:"rewrite"`、`note:"缺限定条件"`,由 §9 的改写步骤/或 stage 5 重写时补限定。此条是为防"系列最高值冒充 SKU 值"。
- **跨型号混用**:若 claim 的数字仅存在于**另一**型号事实中 → `status:"conflict"`、`note:"数据来自 <另一型号>"`、`action:"delete"`(AC-018)。
- 每个 claim 在 `verification.facts` 中必有一行(AC-020):含 `claim`、`status`、`doc_title`、`note`。

### 8.4 图片与型号核验(`images.mjs`)

对 `final_image_plan` 的每张图:
1. `ImageRef.model_id`(来自 CSV 列并与文件名交叉校验)必须等于文案的主型号(多型号对比稿则必须是文中提及型号之一,且图注/配图位置与段落型号一致);
2. `origin` 必须是 `ima` 或 `local_mirror`;`media_id`/`doc_path` 至少一个存在(可追溯,AC-023);
3. 图片说明(`caption`)里出现的型号名需与图片 `model_id` 相同;
4. 不通过 → `status:"mismatch|unknown|origin_invalid"`、`action:"remove"`,从 `final_image_plan` 删除并写 `reason`,必要时 `pending(topic:image)`(AC-024、AC-025)。
5. 禁止的图片来源:外链、生成图、联合表中 `产品型号` 为空的行(见 §6.8)。

### 8.5 报价核验(`quote-check.mjs`)

1. `quote_block` 中每个金额必须 ∈ `retrieval.prices` 的 `amount` 或其乘积;`formula` 重算:`unit_price × quantity === subtotal`;
2. `quote_block.footnote` 必须包含:价格类型、渠道、地区、核验时间、SKU(页脚模板五要素);缺则 `rewrite` 补齐(由代码按模板写入);
3. 正文任意位置出现价格数字但不在 `quote_block` 中 → `price` 类 claim `unsupported`,删除该句(AC-028、AC-032);
4. 出现"补贴/国补/立减/以旧换新/分期/月供/赠品/库存紧张/限量"等词 → 视为动态信息:仅当 `retrieval.prices` 的 `条件摘要` 已记载**且**表达为逐字复述并带"待确认"时才允许,否则删除并加入 `pending`(AC-033);
5. 重算失败 → `prices[*].status:"mismatch"`,整个 `quote_block` 置空,`pending(topic:price)`。

### 8.6 闸门判定

```
blocked  : retrieval.conflicts 存在未解决项 | 删除后无任何 supported 事实(all_facts_removed) | 文案主型号与全部事实型号不一致(model_mismatch)
pass_with_pending : 通过但有 pending
pass     : 其余
```
`blocked` → 不进入合规,直接 export(manual_required),并提示"资料冲突/无法核验,请人工确认"。

### 8.7 `final_article` 生成规则

按 `facts[*].action` 逐段应用:`delete`→移除句子(段内全删则移除整段并写 `removed_segments`);`rewrite`→调用确定性改写器(补限定、去强度词、替换为 `fact.text` 原句);`mark_pending`→在文末"待确认"清单中列出,**正文中不留占位符**。改写不得引入新事实。

## 9. 合规:tools/compliance

### 9.1 接口

```js
createCompliance(deps) => {
  scan(article, rules): Hit[]                                   // 纯代码,词表扫描
  review(article, ctx): Promise<{ findings:Finding[], source:'model'|'skipped' }>   // 模型语义复查,失败返回 skipped
  rewrite(article, hits, findings, ctx): Promise<{ article, changes }>              // 先代码替换,仍不足再模型
  run(input, hooks): Promise<ComplianceOutput>                  // 包含 §9.3 的回环
}
```

### 9.2 词表扫描(代码,必执行)

- 对象:`title / title_options / lead / segments[*].text / cta.text / tags / poster.* / image_plan[*].caption / on_image_text / quote_block.lines`。**标题、图注、图上文字与正文同等对待**(P6 合规指南:标题与图片文字最易违规)。
- 匹配:literal 用 `includes`(先做全半角与空白归一化),regex 用 `u` 标志;`exempt.when_context` 命中时豁免(例:"最新"不属绝对化;"第一时间" 仅作 warn)。
- 输出 `Hit{ category, pattern_id, severity, suggestion }`。`severity=block` 必须处理;`warn` 进入模型复查再决定。
- 五类词表(见 `forbidden-words.json`):绝对化 / 虚假承诺 / 价格误导 / 无依据对比 / 竞品贬低。

### 9.3 回环(最多 2 轮改写)

```
round=0
loop:
  hits = scan(article)
  findings = review(article)            // 仅在 round 0 与最后一次复查各跑一次,不每轮都跑
  if hits.block.empty and findings.empty: break
  if round == 2: verdict="needs_manual"; break
  article = rewrite(article, hits, findings)      // 先按 suggestion 做确定性替换;模型改写作后备
  v = verifier.recheck(article, retrieval)        // 重验!改写不得引入新事实或破坏型号/限定
  if !v.passed: article = verifier.apply(v)       // 回退本轮引入的问题段
  round += 1
verdict = round==0 ? "pass" : (hits.left==0 ? "pass_after_rewrite" : "needs_manual")
```
- "最多 2 轮"口径:**至多 2 次改写**,第 3 次扫描(终检)仍命中则 `needs_manual`(AC-030)。`rounds[]` 记录每轮扫描、复查、改写前后对照、重验结果,页面按轮次展示。
- `needs_manual`:页面显示"需人工确认",`export.status=manual_required`,`copy_text` 输出阻塞说明与命中项,**不作为合格成稿放行**。
- `review` 的模型提示用提示词模块 08(合规规则);其 `findings` 与词表 `Hit` 合并后决定是否改写。

### 9.4 用户明确要求违规内容(干扰场景)

用户在 `constraints`/修改要求里写"全网最低""保证三年不坏""原价9999现价5999""比某品牌强太多"时:
- 阶段 1 已写入 `rejected_requests`(分类对应五类),阶段 5 提示词显式列出;
- 即使模型仍写入,阶段 7 词表命中 → 改写;
- 页面"合规"栏展示"拒绝了用户要求:…,原因:…"。

## 10. LLM 层:tools/llm

### 10.1 配置(环境变量)

| 变量 | 含义 | 默认 |
|---|---|---|
| `LLM_MODE` | `live` / `mock` / `codex` | `live`;无 `LLM_API_KEY` 且未设 `LLM_MODE` 时**自动 mock 并标注** |
| `LLM_BASE_URL` | 以 `/v1` 结尾的基地址 | — |
| `LLM_API_KEY` | 密钥 | — |
| `LLM_MODEL` | 主模型 | — |
| `LLM_FALLBACK_MODEL` | 备用模型(同一 base_url) | 空=无备用 |
| `LLM_WIRE_API` | `chat`(`/chat/completions`)或 `responses`(`/responses`) | `chat` |
| `LLM_TIMEOUT_MS` | 单次调用超时 | 60000 |
| `LLM_TEMPERATURE` | 温度 | `0.4`(核验/合规阶段固定 0.1) |
| `LLM_JSON_MODE` | `schema`(json_schema 严格)/`object`(json_object)/`prompt`(仅提示) | `schema`,收到 4xx 不支持时自动降级到 `object`→`prompt` |
| `CODEX_BIN` | codex 可执行 | `codex` |
| `CODEX_HOME` | 项目内目录,不入库 | `<agent>/.codex-home` |

`.env.example` 已有前四项;需追加 `LLM_WIRE_API=chat`、`LLM_MODE=`、`LLM_TIMEOUT_MS=` 三行(开发 Agent 在构建阶段随首个实现提交一并更新 `.env.example`,不在设计阶段改动)。

### 10.2 对外接口

```js
createLlm(env, deps) => LlmClient
interface LlmClient {
  mode(): { kind:'http-chat'|'http-responses'|'codex'|'mock', model:string|null, fallback_model:string|null }
  completeJson(req: LlmRequest): Promise<LlmResult>
  ping(): Promise<{ ok:boolean, ms:int, model:string, error?:string }>           // 自检用
}
type LlmRequest = { stage:Stage|'verify_claims'|'compliance_review'|'rewrite'|'reco_text',
                    system:string, user:string, schema:object,                    // schema 为该阶段 JSON Schema
                    temperature?:number, maxOutputTokens?:int, timeoutMs?:int, retryHint?:string[] }
type LlmResult = { json:object, model_used:string, switched:boolean, raw_text_len:int, usage:{prompt,completion}|null, ms:int, attempts_inner:int }
```
`completeJson` 内部**不校验业务 Schema**(只保证返回可解析 JSON);业务 Schema 校验与重试在 `pipeline.runStage`。内部仅在**网络错误/超时/5xx/429** 上做 1 次同模型快速重试,其后切备用模型。

### 10.3 协议适配

**http-chat**(`POST {base}/chat/completions`)
```json
{ "model": "...", "messages":[{"role":"system","content":"..."},{"role":"user","content":"..."}],
  "temperature":0.4, "max_tokens":4096,
  "response_format":{ "type":"json_schema", "json_schema":{ "name":"<stage>", "strict":true, "schema":{…strictify…} } } }
```
解析 `choices[0].message.content`;`finish_reason==="length"` 视作截断失败。

**http-responses**(`POST {base}/responses`)
```json
{ "model":"...", "instructions":"<system>", "input":"<user>",
  "text":{ "format":{ "type":"json_schema", "name":"<stage>", "strict":true, "schema":{…} } },
  "temperature":0.4, "max_output_tokens":4096, "store":false }
```
解析:优先 `output_text`;否则遍历 `output[*].content[*]` 取 `type==="output_text"` 的 `text`。

**共通**:`Authorization: Bearer <LLM_API_KEY>`;`Content-Type: application/json`;请求体、响应体、错误不落日志(日志只记 `stage/model/ms/usage/http_status`);`json.mjs` 的 `extractJson(text)` 兜底剥离 ```` ```json ```` 围栏与前后说明文字,再 `JSON.parse`;解析失败视为一次失败。

**json_mode 降级**:`schema` 模式遇 400/422 且错误信息含 `response_format|json_schema|unsupported`,同次调用自动改 `object`,仍失败改 `prompt`(在 system 末尾追加"只输出一个 JSON 对象,字段如下:<schema 摘要>");降级结果缓存到进程内,避免每次重复探测。

### 10.4 主备切换

```
try primary (含 1 次快速重试)
  失败类别(timeout | network | 5xx | 429 | 401/403? | 解析失败 | finish_reason=length)
→ emit model_switch{from:primary,to:fallback}
try fallback (含 1 次快速重试)
→ 仍失败 → throw LlmError(code) 交由 pipeline 的阶段重试/降级
```
401/403 **不切备用**(同一密钥,切换无意义)直接抛 `LLM_AUTH`,流水线降级并在状态卡提示"模型凭证无效"。备用模型成功 → `LlmResult.switched=true`,阶段日志 `model_used`,`degraded.reason="fallback_model"`(仅提示,不算失败)。AC-041。

### 10.5 mock 模式(`mock.mjs`)

目的:无密钥时跑通全链路与测试,**确定性**输出(同输入同输出,不含随机、时间)。
- 触发:`LLM_MODE=mock`,或缺 `LLM_API_KEY` 且未显式设 `live`。`mode().kind='mock'`,页面与导出头显示"演示模式(mock)",**避免被误当成真实模型结果**(诚实标注)。
- 实现:按 `req.stage` 分派到**模板函数**,用 `ctx` 中的 `facts/images/strategy/insight/quote` 机械拼装符合 Schema 的 JSON;不会编造事实(只引用 `facts`);用于测试时可注入故障:`MOCK_FAIL=stage:n`(前 n 次失败)、`MOCK_INVALID=stage`(返回不合 Schema 输出)、`MOCK_INJECT_UNSUPPORTED=1`(在草稿中注入无依据参数,测试 AC-021)、`MOCK_INJECT_VIOLATION=absolute,false_promise`(注入违规词测试合规)、`MOCK_SLOW=ms`。
- mock 草稿须:四平台结构各异、图数随平台变化、洞察 `quote` 来自输入子串——保证下游的校验代码路径(而非仅"能跑")被真实覆盖。

### 10.6 Codex 内层驱动(可选,`codex.mjs`)

不是唯一路径,默认关闭;`LLM_MODE=codex` 时启用。
```
codex exec --ignore-user-config --ephemeral --skip-git-repo-check \
  --sandbox read-only \
  --output-schema <tmp>/<stage>.schema.json \
  --output-last-message <tmp>/<stage>.out.json \
  --json  "<compose 后的提示>"
```
- 参数均已在本地源码 `codex-rs/exec/src/cli.rs` 核对存在:`--output-schema`、`--output-last-message`/`-o`、`--ephemeral`、`--ignore-user-config`、`--skip-git-repo-check`、`--json`。`--sandbox` 为通用选项,开发 Agent 落地前运行 `codex exec --help` 复核拼写。
- 环境:`CODEX_HOME=<agent>/.codex-home`,模型地址与 Key 经配置中的 `env_key` 读环境变量,**不写入文件**;子进程 `env` 白名单传递(`PATH, CODEX_HOME, LLM_API_KEY, SystemRoot` 等),不继承整个进程环境。
- 超时由外层 `AbortController` + `child.kill()`;临时目录放 `out/tmp/<run_id>`,运行后清理。
- Codex 当前只支持 Responses API;若所用服务仅支持 chat completions,则**不启用 codex 驱动**(用 http-chat)而不是引入代理。
- 失败语义同 http 驱动(抛 `LlmError`),不单独降级。

### 10.7 提示词装配(`tools/prompts.mjs`)

```js
compose(stage, ctx, extras) => { system:string, user:string, schema:object, params:{temperature, maxOutputTokens} }
```
按 `prompts/compose.md` 的表读取各模块文件,把规则库片段注入占位符(`{{platform_rules}}` 等),把 `ctx` 数据序列化为紧凑 JSON 放入 `user`(不放进 `system`)。每次调用把"被使用的模块清单"写进 `stage_log.note`(AC-052:各阶段实际使用的提示词可追溯)。
## 11. 服务:HTTP 接口与流式事件

### 11.1 总则

- `server/index.mjs`:Node 内置 `http`,默认监听 `127.0.0.1:${PORT:-8787}`;静态托管 `web/`。**无登录与鉴权**(本地演示工具):因此默认只绑定回环地址;若 `HOST` 设为非回环地址,启动日志必须打印"未启用鉴权"警告。凭证永不通过任何接口返回。
- JSON 请求 `Content-Type: application/json`,体积上限 64 KB;响应统一 `{ ok:boolean, data?:…, error?:{ code, message, hint? } }`。
- 所有响应与 SSE 载荷在写出前经 `redact()` 并**剔除** `media_id`、`kb_id`、`folder_id` 字段(`stripInternal()`)(AC-015、AC-048)。
- Run 记录保存在内存并落盘 `out/runs/<run_id>.json`(同样 redact + stripInternal;内部 id 单独存 `out/runs/<run_id>.internal.json`,不入库、不对外)。

### 11.2 路由

| 方法 路径 | 用途 | 请求 | 响应 `data` |
|---|---|---|---|
| `GET /api/health` | 存活 | — | `{ up:true, version, time }` |
| `GET /api/status` | 状态卡:账号 / 知识库 / 模型 | — | `{ kb:KbStatus, llm:{ kind, model, fallback_model, wire_api, mock:boolean }, mode:{ ima:'live'|'mirror', mirror_notice:string|null } }` |
| `GET /api/options` | 表单选项 | — | `{ scenes:[{ id,label }], platforms:[{ id,label }], models:[{ model_id, model_name, family, system }], undecided_label:'未定' }` |
| `POST /api/runs` | 创建任务并开始(异步) | `TaskInput` | `{ run_id }`,同时可 `?stream=1` 直接以 SSE 返回(见 11.3) |
| `GET /api/runs/:id/events` | SSE 订阅(含历史回放) | `Last-Event-ID` 可选 | SSE |
| `GET /api/runs/:id` | 当前快照 | — | `{ run_id, status, ctx_public, export|null }` |
| `POST /api/runs/:id/answers` | 追问表单提交,从阶段 1 继续 | `{ answers:{ [question_id]:string\|string[] } , patch?:Partial<TaskInput> }` | `{ run_id }`(同一 run 继续,SSE 同一连接续传) |
| `POST /api/runs/:id/revise` | 修改并重新生成 | `RevisionRequest` | `{ run_id, revision:int }` |
| `GET /api/runs/:id/export?format=txt\|md\|json` | 导出 | — | 文件下载(`Content-Disposition`) |
| `GET /api/image/:image_id?run=:id` | 镜像模式下读图 | — | 图片二进制(只读,路径校验);live 模式 404 |
| `POST /api/selfcheck` | 触发预热自检(可选) | — | `SelfcheckReport` |

`RevisionRequest = { kind:'delete_segment'|'change_platform'|'change_selling_point'|'edit_constraints'|'regenerate', segment_ids?:string[], platform?:Platform, focus_key?:string, note?:string, constraints_add?:string[] }`。所有修改类型**从阶段 3 或 5 重新开始并必须再次经过阶段 6、7**(AC-049):`change_platform` 从阶段 3(平台策略与图数改变);`change_selling_point` 从阶段 3;`delete_segment` 与 `regenerate`、`edit_constraints` 从阶段 5。`delete_segment` 的实现是把已删段 id 作为"禁用段"约束传入阶段 5 重写,并由 6/7 重检,不是直接字符串删除后绕过核验。

### 11.3 SSE 格式

响应头 `Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`。每 15s 发送 `: ping` 注释保活。

```
id: 12
event: stage_result
data: {"type":"stage_result","stage":"insight","status":"done","ms":8120,"attempts":1,"model_used":"<model>","payload":{…}}

```
事件名等于 `PipelineEvent.type`(§7.4)。`id` 为 run 内递增序号,支持 `Last-Event-ID` 断线续传(服务端保留事件缓冲)。`run_done`/`error`/`need_info`/`blocked` 后服务端继续保持连接 ≤ 5s 后关闭;`need_info` 之后客户端提交 answers,**沿用同一 run_id 重新订阅**。

### 11.4 `stage_result.payload` 展示化约定

| stage | payload 要点(前端据此渲染,字段名固定) |
|---|---|
| task | `{ status, normalized, questions?, model_candidates?, rejected_requests }` |
| insight | 全量 `insight`(去 `degraded` 内部项) |
| strategy | `{ angle, selling_points, platform_plan, taboos, rule_basis }` |
| retrieval | `{ origin, kb, models, facts(≤60 条完整),images(含 file_name、caption、model_name、doc_title,不含 media_id), prices, quote, conflicts, pending, call_log }` |
| draft | `{ article, image_plan, quote_block, demo_script, next_actions, degraded }` |
| verification | `{ facts, images, prices, removed_segments, pending, verdict, stats }` |
| compliance | `{ rounds, by_category, verdict, manual_items }` |
| export | 完整 `ExportOutput.sections` + `progress` + `degraded` + `mirror_notice` |

### 11.5 状态卡(`GET /api/status`)约定

`kb.state` → 前端文案:`connected`"已连接"、`no_credential`"未配置 ima 凭证(使用本地镜像)"、`not_joined`"账号未加入该知识库(使用本地镜像)"、`error`"接口返回异常(使用本地镜像)"、`mirror`"本地镜像"。`kb.last_api` 展示 `name/code/msg` 摘要(AC-014 "接口返回");`root_items` 展示条目数(手册实测 314)。`account.client_id_tail` / `api_key_tail` 为尾号。**不返回** `kb_id`。

### 11.6 反泄漏清单(测试可直接断言)

响应/事件/日志/导出文本中:不含 `IMA_OPENAPI_CLIENTID`/`APIKEY`/`LLM_API_KEY` 的值;不含 `kb_id`、`media_id`、`folder_id` 的值;不含 `Authorization` 头内容;`/api/runs/:id` 的 `ctx_public` 经 `stripInternal`。服务端异常信息只含错误码与脱敏消息,不回显上游原始响应体。

## 12. 错误与重试策略

### 12.1 错误码

`TASK_INVALID` `IMA_NO_CREDENTIAL` `IMA_NOT_FOUND_KB` `IMA_API_ERROR` `IMA_NETWORK` `IMA_FORBIDDEN_API` `IMA_PARSE` `MIRROR_MISSING` `LLM_AUTH` `LLM_TIMEOUT` `LLM_NETWORK` `LLM_HTTP` `LLM_PARSE` `LLM_TRUNCATED` `SCHEMA_INVALID` `DOMAIN_INVALID` `STAGE_BUDGET` `ABORTED` `INTERNAL`。结构 `{ code, message, retriable:boolean, detail? }`,`message` 面向用户、简体中文、无内部 id。

### 12.2 重试矩阵

| 层 | 触发 | 次数 | 间隔 | 之后 |
|---|---|---|---|---|
| ima 单次调用 | 网络/5xx/超时 | 2 | 500ms、1500ms | 该调用失败,走回退链(搜索 → 目录浏览 → 镜像) |
| ima 阶段 | 回退链全失败 | — | — | `retrieval` 用镜像;镜像也缺 → `pending(no_evidence)`,不中断 |
| LLM 单次调用 | 网络/5xx/429/超时 | 1(同模型)+ 切备用 | 800ms | 抛 `LlmError` |
| 阶段(模型阶段) | 调用失败或 schema/domain 不合格 | 2 重试 | 0、1000ms | 阶段降级函数(§4) |
| 阶段(代码阶段 4/6/8) | 内部异常 | 1 | 0 | 降级:4→pending;6→保守删除所有 `is_fact_claim` 句并出事实要点清单;8→纯文本导出 |
| 合规回环 | 命中 | 2 轮改写 | — | `needs_manual` |

### 12.3 降级矩阵(对应 AC-040)

| 阶段 | 降级产物 | 显式标注 |
|---|---|---|
| 1 task | 固定追问文案 / `need_info` | — |
| 2 insight | `scenes[scene].default_persona` | `source=rule_default`,洞察卡徽标"规则库默认画像" |
| 3 strategy | `scenes[scene].default_strategy` + `platforms[platform]` | `source=rule_default` |
| 4 retrieval | 目录浏览 → 本地镜像 → `pending` | `kb.status` 与"本地镜像"徽标 |
| 5 draft | 事实要点清单 + 默认演示骨架 | `degraded.fallback=fact_digest` |
| 6 verification | 保守删除全部事实性句子,只保留共情/过渡/CTA | `degraded.reason=…` |
| 7 compliance | 词表扫描(代码)独立完成,模型复查 `skipped` | `review.source=skipped` |
| 8 export | 纯文本 | — |

任何降级向 `ctx.degraded[]` 追加一条并随 `stage_result`/`stage_degraded` 事件推送,进度条显示原因。**降级不是失败**:流水线必须跑到 export。

### 12.4 超时与预算

阶段预算见 `PipelineConfig.stageBudgetMs`;整条链路软上限 4 分钟,超出后后续模型阶段直接取降级产物(保证有输出)。`AbortSignal`(客户端取消)是唯一允许提前结束的方式。

### 12.5 日志(`tools/log.mjs`)

NDJSON 写 `out/logs/<date>.ndjson`;字段 `{ t, run_id, stage, level, event, ms, attempt, model, code }`;**不记录**提示词全文、模型原始输出、ima 原文、凭证、内部 id。`GET /api/runs/:id` 的 `stage_log` 即进度条数据源。

## 13. 前端定位点(web/)

单页;左侧任务表单(产品、人群、场景、平台、客户描述,五项),顶部状态卡,中间阶段进度条,右侧六个可折叠分区。固定 DOM 标识,便于测试 Agent 按 id 断言:

| 元素 | `id` / `data-testid` |
|---|---|
| 状态卡 | `status-card`(子项 `kb-name`、`kb-state`、`kb-last-api`、`id-tail`、`key-tail`、`mirror-badge`、`llm-mode`) |
| 任务表单 | `task-form`(`f-product` `f-audience` `f-scene` `f-platform` `f-description` `btn-submit`) |
| 追问表单 | `ask-form`(每题 `q-<id>`,`btn-ask-submit`) |
| 进度条 | `progress`(每阶段 `stage-<name>`,含 `status`/`ms`/`attempts`/`degraded-reason`) |
| 六个分区 | `sec-scene` `sec-basis` `sec-article` `sec-verify` `sec-insight` `sec-plan` |
| 修改与导出 | `btn-copy` `btn-export` `revise-form`(`r-kind` `r-platform` `r-focus` `r-note` `btn-revise`) |
| 阻塞提示 | `blocked-banner`(资料冲突/需人工确认) |

分区顺序:洞察卡、场景判断、知识库依据、图文软文、核验结果、演示脚本与下一步动作(展示顺序按业务逻辑,标题名称按手册)。
## 14. 验收映射与启动自检

### 14.1 验收条目 → 规格落点

| AC | 落点 | AC | 落点 |
|---|---|---|---|
| 001–003 | §4.1、§6.3、§6.4 | 030–031 | §9.3、§5.3 |
| 004–005 | §4.2 | 032–034 | §6.9、§8.5、§9.4 |
| 006–008 | §4.3、§5.1 | 035 | §8.5、`forbidden-words.json`(销量/奖项/评价) |
| 009–013 | §4.3、§5.2、§4.5 | 036–037 | §4.8、§13 |
| 014 | §11.5、§6.5 | 038–039 | §4.5(demo_script、next_actions) |
| 015–017 | §6.2、§4.4 | 040–041 | §7.2、§12.3、§10.4 |
| 018–019 | §6.3、§8.3 | 042 | §6.2、§6.6 |
| 020–022 | §8.2、§8.3、§8.7、§7.3 | 043 | §7.4、§11.3 |
| 023–025 | §6.8、§8.4 | 044 | §14.2 |
| 026–029 | §9.2、`forbidden-words.json` | 045 | 整体;测试矩阵 §14.3 |
| 046–048 | §6.5、§11.6、§6.2 | 049–050 | §11.2、§4.8 |
| 051 | §1、§6.2(4 接口白名单) | 052–053 | §5.4、§5.5 |
| 054–055 | §14.2、§13 | | |

### 14.2 `scripts/init.mjs` 与 `scripts/selfcheck.mjs`

- `node scripts/init.mjs`:读取 `.env` → 打印脱敏后的配置摘要 → 运行 selfcheck(可 `--skip-selfcheck`)→ 启动 `server` → 打印访问地址。
- `selfcheck` 依次:① ima 连通(状态与根目录条目数;无凭证时报 `no_credential` 并说明将用本地镜像)② 本地镜像可读(`MIRROR_MISSING`)③ 模型连通(`llm.ping()`;mock 模式报 `mock`)④ 示例任务端到端跑通(固定任务:`HUAWEI MateBook Pro S / 大学新生 / 开学季 / 小红书`)并断言六分区非空、无凭证泄漏。每项输出 `ok|warn|fail` + 具体原因 + 耗时;**任一项失败不崩溃**,最终汇总并以非零退出码仅在 ① 与 ③ 均不可用且镜像缺失时返回。
- 拔掉任一凭证再跑,报告具体失败项(AC-044)。

### 14.3 开发期最小测试矩阵(mock 模式,零密钥可跑)

| 用例 | 断言 |
|---|---|
| 完整任务四平台 | 结构、图数、行动引导四项均不同;图数在区间内 |
| 八场景 | 切入点 id 互不相同;taboo 命中检查通过 |
| 相近型号 Pro vs Pro S | 事实集合无交叉;图片 `model_id` 一致 |
| 注入无依据参数 | 阶段 6 删除/标注,`copy_text` 无该参数 |
| 注入违规词 | 阶段 7 命中并改写,轮次 ≤ 2;构造不可改写 → `needs_manual` |
| 价格干扰 | `constraints` 含"国补立减2000、送鼠标" → `rejected_requests`,`pending` 列出,`next_actions` 含向店长核实 |
| 数量 3 台报价 | `formula` 与重算一致 |
| 阶段故障注入 | `MOCK_FAIL=insight:3` 等 → 降级但跑到 export |
| 冲突 | 两份事实对同型号同参数不同值 → `manual_required` |
| 反泄漏 | 搜索响应/事件/日志/导出,凭证与内部 id 零命中 |

## 附录 A:型号种子表(`harness/rules/` 之外,由 `tools/ima/models.mjs` 内置)

镜像与价格快照的实测对应关系(已逐目录核对)。`dir` 相对 `P1-产品参数库/`;`slug` 为图片文件名中的型号短名(`hwpc_{slug}_…`)。

| model_id | 规范型号名(图片索引 `产品型号` 列) | dir | file_slug | 价格表 `规范产品名称` | 系统 | 现价状态(2026-10-17) |
|---|---|---|---|---|---|---|
| `matebook-pro` | HUAWEI MateBook Pro | `01-鸿蒙电脑/HUAWEI MateBook Pro` | `matebook-pro-harmonyos` | HUAWEI MateBook Pro（鸿蒙版） | HarmonyOS 6.1 | 有商城页面价 |
| `matebook-pro-s` | HUAWEI MateBook Pro S | `01-鸿蒙电脑/HUAWEI MateBook Pro S` | `matebook-pro-s` | HUAWEI MateBook Pro S | HarmonyOS 6.1 | 有商城页面价 |
| `matebook-14-hm` | HUAWEI MateBook 14（鸿蒙版） | `01-鸿蒙电脑/HUAWEI MateBook 14` | `matebook-14-harmonyos` | HUAWEI MateBook 14（鸿蒙版） | HarmonyOS 6 | 有商城页面价 |
| `matebook-fold` | HUAWEI MateBook Fold 非凡大师 | `01-鸿蒙电脑/HUAWEI MateBook Fold 非凡大师` | `matebook-fold-ultimate-design` | HUAWEI MateBook Fold 非凡大师 | HarmonyOS 6.1 | 有商城页面价 |
| `matebook-14-ultra` | HUAWEI MateBook 14 酷睿 Ultra | `02-MateBook-Windows/MateBook 14 酷睿 Ultra` | `matebook-14-2024` | HUAWEI MateBook 14 酷睿 Ultra | Windows | 原商品页下架,无现价 |
| `matebook-d-14` | HUAWEI MateBook D 14 2024 | `02-MateBook-Windows/MateBook D 14` | `matebook-d-14-2024` | HUAWEI MateBook D 14 2024 | Windows | 下架,无现价 |
| `matebook-d-16` | HUAWEI MateBook D 16 2024 | `02-MateBook-Windows/MateBook D 16` | `matebook-d-16-2024` | HUAWEI MateBook D 16 2024 | Windows | 下架,无现价 |
| `matebook-d-16-se` | HUAWEI MateBook D 16 SE 版 2024 | `02-MateBook-Windows/MateBook D 16 SE 版` | `matebook-d-16-se-2024` | HUAWEI MateBook D 16 SE 版 2024 | Windows | 下架,无现价 |
| `matebook-gt-14` | HUAWEI MateBook GT 14 | `02-MateBook-Windows/MateBook GT 系列` | `matebook-gt-14` | HUAWEI MateBook GT 14 | Windows | 下架,无现价 |
| `matebook-x-pro` | HUAWEI MateBook X Pro 酷睿 Ultra 微绒典藏版 | `02-MateBook-Windows/MateBook X系列` | `matebook-x-pro-ultra` | HUAWEI MateBook X Pro 酷睿 Ultra 微绒典藏版 | Windows | 下架,无现价 |

**设计后果(开发与测试须知)**
1. 10 个重点型号中只有 4 个(Pro、Pro S、14 鸿蒙版、Fold)当前有可引用的商城页面价;另 6 个报价一律 `quote=null` + 待确认,这是**正确行为**而非缺陷。演示主推 Pro S / Pro,避开下架型号(现场前按价格问答测试集刷新核对)。
2. 图片:10 个型号共 53 张型号标注图(Pro 8、Pro S 6、14 鸿蒙 4、Fold 5、14 Ultra 8、D14 7、D16 2、D16 SE 5、GT 6、X Pro 2;联合检索表共 112 行,其余 59 行型号为空);**D 16 仅 2 张、X Pro 仅 2 张**,在朋友圈(1–3)可行,公众号(2–4)可行,小红书(3–6)会不足 → 按规则产生 `Pending(image)`,不得补外部图或他型号图。联合检索表另有 59 行 `产品型号` 为空的商城素材,**一律不可用**。
3. 别名与排他(`aliases` / `excludes`,不区分大小写,先做归一化):

| model_id | aliases | excludes(出现则不命中本型号) |
|---|---|---|
| `matebook-pro` | matebook pro、mate book pro、pro(仅当上下文已有 matebook) | `pro s`、`x pro` |
| `matebook-pro-s` | matebook pro s、pro s | — |
| `matebook-14-hm` | matebook 14 鸿蒙、matebook 14(鸿蒙版) | `酷睿`、`ultra` |
| `matebook-14-ultra` | matebook 14 酷睿 ultra、matebook 14 ultra | — |
| `matebook-fold` | matebook fold、fold、非凡大师、折叠本 | `企业版` |
| `matebook-d-14` | matebook d 14、d14 | — |
| `matebook-d-16` | matebook d 16、d16 | `se` |
| `matebook-d-16-se` | matebook d 16 se、d16 se | — |
| `matebook-gt-14` | matebook gt 14、gt 14、gt14 | — |
| `matebook-x-pro` | matebook x pro、x pro | — |

   只写"MateBook 14"→ 在 `matebook-14-hm` 与 `matebook-14-ultra` 间 `ambiguous`;只写"MateBook"/"轻薄本"/"华为电脑"→ 全部 10 个中按 `scene.recommended_models` 给候选。
4. 商用(擎云 HM740/HM940/L420、Fold 企业版)及扩展 55 项均仅有价格表中的"官方询价/未公开"记录与发现卡(`07-扩展产品目录`),**没有逐型号 `产品事实.md`**;任务指定这些型号时,事实只能取发现卡摘要与来源链接,规格类事实一律 `pending`,报价走"官方询价"路径(不输出数字)。

## 附录 B:样例(简化)

**B.1 阶段 1 追问**(输入只有 `description="想买轻薄本"`):
```json
{ "stage":"task","schema_version":1,"status":"need_info",
  "normalized":{"product":{"kind":"ambiguous","model_ids":[],"raw":""},"audience":"","scene":null,"platform":null,"description":"想买轻薄本","quantity":null,"budget":null},
  "missing":[{"field":"product","reason":"未指定型号"},{"field":"audience","reason":"未说明目标人群"},{"field":"scene","reason":"未选择场景"},{"field":"platform","reason":"未选择发布渠道"}],
  "questions":[
    {"id":"q_budget","field":"description","question":"预算大概在哪个区间?","type":"single","options":["6000 元以下","6000–8000 元","8000–10000 元","10000 元以上","暂不确定"],"why":"决定推荐哪个型号,以及是否需要报价"},
    {"id":"q_usage","field":"description","question":"主要拿它做什么?","type":"multi","options":["上课记笔记","办公文档与会议","设计/视频创作","出差携带","其他"],"why":"决定卖点顺序"},
    {"id":"q_carry","field":"description","question":"多久带出门一次?","type":"single","options":["每天","每周几次","偶尔","基本不带"],"why":"决定是否强调重量和续航"},
    {"id":"q_multi","field":"description","question":"是否需要和手机、平板、耳机协同?","type":"single","options":["需要","不需要","不确定"],"why":"决定是否突出多设备协同"}],
  "model_candidates":[],"rejected_requests":[],"degraded":null }
```
**B.2 报价行**:`{"model_name":"HUAWEI MateBook Pro S","sku_text":"24GB/512GB/烟云灰/HarmonyOS/麒麟XE90","unit_price":8999,"quantity":3,"subtotal":26997,"formula":"8999 × 3 = 26997","price_type":"当前商城页面价","verified_at":"2026-10-17T14:52:13-05:00","channel":"华为官方商城","region_text":"未主动选择地区","official_url":"https://item.vmall.com/product/comdetail/index.html?prdId=10086380895025","record_id":"PRICE-xxxx","notes":["页面当时另展示赠品、积分抵现、分期条件,均待结算页及授权渠道确认,不参与计算"]}`

**B.3 核验项**:`{"id":"v7","segment_id":"s3","claim":"重量约798克","claim_type":"number","value":"798 g","status":"supported","fact_id":"f21","doc_title":"HUAWEI MateBook Pro S - 产品事实","note":"限定:标准屏/防窥屏版;典藏版为825 g","action":"keep"}`

