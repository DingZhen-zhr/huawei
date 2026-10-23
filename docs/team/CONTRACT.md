# 共享接口契约 v1.0.0

> A 负责维护，B/C/D 使用同一版本。以下是团队内部接口设计，不是 ima 官方 API 字段说明。
> A 在 M0 将本文件实现为 `@huawei/contracts` 的 Zod schemas、推导类型和合成 fixture；未实现前不能宣称接口已可用。
> 类型名、字段名、枚举、方法签名是强约定；不得私自使用别名或复制一套前端类型。

## 1. 基础规范

- HTTP 前缀 `/api/v1`；JSON UTF-8；camelCase；UTC ISO 8601 日期字符串。
- 正文和错误响应均设置 `Content-Type: application/json; charset=utf-8`；图片端点除外。
- 所有接口响应带 `contractVersion: "1.0.0"` 和随机 `requestId`（图片二进制响应通过响应头传递）。
- 服务端生成 UUID 作为 runId/requestId；不将 ima kb_id、凭证、本机绝对路径直接暴露到前端。
- 标有 `?` 的字段可省略；其他字段必须存在。响应中的缺失对象使用明确的 `null`，集合使用 `[]`，不得混用 null 和空字符串。
- 输入 schema 拒绝未知字段；所有输入字符串 trim，空白串视为空。请求体最多 32 KiB，prompt 最多 4000 字符，修改指令最多 2000 字符，其他单字段最多 500 字符。
- HTTP 结果不得包含 stack trace、密钥或未经脱敏的原始接口回包。
- 无法解析资料、资料中的文字要求“忽略系统指令”都不能改变系统规则；检索内容作为不可信数据处理。

## 2. 共享类型（由 A 用 Zod 实现并导出）

```ts
export type Provider = "local" | "ima";
export type Platform = "wechat" | "xiaohongshu" | "moments" | "poster";
export type Stage = "awareness" | "consideration" | "decision";
export type RunStatus =
  | "queued" | "running" | "needs_input" | "blocked" | "succeeded" | "failed";
export type Step =
  | "parse" | "retrieve" | "plan" | "generate" | "verify" | "finalize";
export type ErrorCode =
  | "VALIDATION_ERROR" | "NOT_FOUND" | "INVALID_STATE" | "BUSY"
  | "IMA_AUTH_FAILED" | "IMA_UNAVAILABLE" | "KB_NOT_FOUND" | "KB_AMBIGUOUS"
  | "MODEL_UNAVAILABLE" | "MODEL_OUTPUT_INVALID" | "TIMEOUT" | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  fields: Array<{ path: string; message: string }>;
}
export interface Meta {
  contractVersion: "1.0.0";
  requestId: string;
}
export type ApiResponse<T> =
  | (Meta & { ok: true; data: T })
  | (Meta & { ok: false; error: ApiError });

export interface BriefInput {
  productQuery?: string;
  audience?: string;
  scenario?: string;
  platform?: Platform;
  objective?: string;
  purchaseStage?: Stage;
}
export interface CreateRunRequest {
  prompt: string;
  brief?: BriefInput;
  parentRunId?: string;
  revisionInstruction?: string;
}
// prompt 非空；brief 可部分填写，缺失业务信息走 needs_input，不能一律 HTTP 400。
// brief 的显式字段优先于 prompt；二者冲突且会影响型号/事实时需要追问。

export interface Brief {
  productQuery: string;
  audience: string;
  scenario: string;
  platform: Platform;
  objective: string;
  purchaseStage: Stage;
}
export interface Question {
  id: string;
  field: keyof BriefInput | "other";
  text: string;
  required: boolean;
  options: Array<{ value: string; label: string }>;
}
export interface ProductRef {
  productId: string;
  displayName: string;
  sku: string | null;
  system: string | null;
}
// productId 是提供器内部归一化标识，不能以显示名称或相似字符串混合两个型号。
// sku/system 不明时为 null；涉及这些条件的事实不能直接应用。

export interface Source {
  sourceId: string;
  provider: Provider;
  title: string;
  locator: string;
  publicUrl: string | null;
  retrievedAt: string;
}
// locator 为去敏的库内相对路径/可读资料定位，不能是本机绝对路径或带凭证 URL。
// publicUrl 仅可放无密钥的公开 HTTPS 页面；受限/签名 URL 为 null。
export interface Evidence {
  evidenceId: string;
  sourceId: string;
  productId: string;
  excerpt: string;
  field: string;
  value: string;
  conditions: string[];
  validAsOf: string | null;
}
// excerpt 是支持该字段的原文片段；retrievedAt 不等于价格生效日期。
export interface ImageAsset {
  imageId: string;
  productId: string;
  sourceId: string;
  name: string;
  alt: string;
  access: "available" | "unavailable";
}
// 不暴露本地绝对路径或原始签名图片 URL；预览统一走受控图片接口。
export interface KnowledgeIssue {
  code: "AMBIGUOUS_PRODUCT" | "NO_EVIDENCE" | "SOURCE_CONFLICT"
    | "INSUFFICIENT_IMAGES" | "UNCONFIRMED_CONDITIONS";
  message: string;
  sourceIds: string[];
}
export interface RetrievalTrace {
  operation: "search_knowledge_base" | "search_knowledge"
    | "get_knowledge_list" | "get_media_info" | "local_search";
  outcome: "ok" | "empty" | "error";
  durationMs: number;
}
export interface KnowledgeBundle {
  provider: Provider;
  resolvedProduct: ProductRef | null;
  candidates: ProductRef[];
  sources: Source[];
  evidence: Evidence[];
  images: ImageAsset[];
  issues: KnowledgeIssue[];
  trace: RetrievalTrace[];
}

export interface Strategy {
  angle: string;
  reason: string;
  tone: string;
  sellingPointEvidenceIds: string[];
  outline: string[];
  targetImageCount: number;
  ctaGoal: string;
}
export interface Block {
  blockId: string;
  kind: "heading" | "paragraph" | "bullet";
  text: string;
  claimIds: string[];
}
export interface Draft {
  title: Block;
  lead: Block | null;
  body: Block[];
  cta: Block;
  tags: Block[];
}
export interface Claim {
  claimId: string;
  text: string;
  evidenceIds: string[];
  verdict: "supported" | "unsupported" | "conflict";
  reason: string;
}
export interface ImagePlacement {
  imageId: string;
  afterBlockId: string;
  caption: Block;
  reason: string;
}
// 图注也可能包含产品主张，必须经过相同审核。
export interface Finding {
  findingId: string;
  category: "fact" | "image" | "compliance";
  severity: "info" | "warning" | "error";
  message: string;
  blockId: string | null;
  action: "none" | "removed" | "rewritten" | "needs_confirmation";
}
export interface Review {
  publishable: boolean;
  claims: Claim[];
  findings: Finding[];
  pendingItems: string[];
}
// publishable=true 只表示通过本系统检查，不是平台审核通过或法律保证。
export interface Result {
  brief: Brief;
  product: ProductRef | null;
  strategy: Strategy | null;
  draft: Draft | null;
  placements: ImagePlacement[];
  sources: Source[];
  evidence: Evidence[];
  images: ImageAsset[];
  review: Review;
}

export interface RuntimeInfo {
  provider: Provider;
  simulated: boolean;
}
export interface Run {
  runId: string;
  parentRunId: string | null;
  status: RunStatus;
  step: Step | null;
  createdAt: string;
  updatedAt: string;
  runtime: RuntimeInfo;
  input: CreateRunRequest;
  questions: Question[];
  result: Result | null;
  error: ApiError | null;
}

export interface KnowledgeStatus {
  provider: Provider;
  connection: "unconfigured" | "connected" | "error";
  knowledgeBaseName: string | null;
  accountLabel: string | null;
  checkedAt: string;
  error: ApiError | null;
}
// accountLabel 仅在官方接口/凭证元数据可验证时返回脱敏标识，否则 null 并解释尚未核验。
export interface Health {
  status: "ok";
  runtime: RuntimeInfo;
  startedAt: string;
}
export interface ListProductsResponse {
  items: ProductRef[];
  nextCursor: string | null;
}
```

## 3. HTTP 路由：A 提供，C 使用，D 验证

| Method / 路径 | 输入 | 输出 data | HTTP |
|---|---|---|---|
| GET `/health` | 无 | `Health` | 200；仅进程健康，不证明 ima 可用 |
| GET `/knowledge/status` | 无 | `KnowledgeStatus` | 200；失联放 connection/error，非假健康 |
| GET `/products?query=…&cursor=…` | query 可空，cursor 可省略；每页固定最多 20 | `ListProductsResponse` | 200；上游异常返回错误封套 |
| POST `/runs` | `CreateRunRequest` | `Run`，初始 queued | 202 |
| GET `/runs/:runId` | UUID | `Run` | 200；过期/不存在 404 |
| GET `/runs/:runId/images/:imageId` | 已知运行和已登记图片 ID | 图片二进制 | 200；未知/失效 404，暂不可读 503；错误仍为 JSON 封套 |

不另建 `/generate`、`/chat`、`/rewrite`、`/export` 等平行路由。首版没有取消接口、任务列表或资料上传接口。导出由前端基于同一份 Result 完成。

分页 cursor 是提供器发放的不透明字符串；前端只传回原值。不能把 ima 内部 ID 当业务型号 ID。空结果返回 `items: []`，不是虚构候选。

### 创建与轮询

```json
{
  "prompt": "为准备开学的大学新生写一篇小红书图文，引导到店体验。",
  "brief": {
    "productQuery": "用户选择的完整型号",
    "audience": "大学新生",
    "scenario": "开学购机",
    "platform": "xiaohongshu",
    "objective": "预约到店体验",
    "purchaseStage": "consideration"
  }
}
```

上例产品名是输入格式占位说明，不能作为真实测试型号。公共 fixture 使用明确标注的虚构产品，真实验收使用 ima 实际返回产品。

前端每 1 秒 GET 轮询，仅 queued/running 持续；终态停止。网络错误最多连续重试 3 次，随后展示“查询中断，可重试查询”，不能据此改变服务端任务状态；重试 GET 不会新建付费任务。页面离开时清理轮询。一次提交后禁用重复提交；用户主动重新提交才创建新任务。首版不保证 POST 幂等，不自动重试 POST。

### 追问与修改协议

- needs_input 是终态，questions 列出缺项/型号候选，无 draft。
- 用户补全后，C 创建新 POST：携带完整新 prompt/brief、`parentRunId` 和 `revisionInstruction`（说明补充了什么）。不需要另造 answers 格式。
- 修改成功稿件也使用同一协议。`parentRunId` 与非空 `revisionInstruction` 必须同时提供或同时省略。
- A 检查父任务存在且为终态；running/queued 父任务返回 409。父任务过期返回 404，C 提示可去掉父引用重新创建完整任务。
- 后端不隐式合并父任务的 brief：新请求是权威输入。B 可将父结果作为改写参考，但仍要重新检索、审核；换型号时不得继承旧证据。
- 原任务及结果不可覆盖。所有证据、块、主张、图片 ID 至少在每个 run 内唯一；前端缓存键使用 runId + ID。

## 4. 状态机与强约束

```text
queued → running → needs_input
                 → blocked
                 → succeeded
                 → failed
```

| 状态 | questions | result | error | 说明 |
|---|---|---|---|---|
| queued | [] | null | null | step=null |
| running | [] | null | null | step 为当前实际步骤 |
| needs_input | 至少 1 项 | null | null | 业务信息缺失/型号不明确 |
| blocked | [] | 非 null | null | 业务审核阻塞，publishable=false；draft 可为空 |
| succeeded | [] | 非 null | null | draft/product/strategy 非 null，publishable=true |
| failed | [] | null | 非 null | 连接、模型、程序或超时异常 |

终态 step=null；updatedAt >= createdAt。顺序执行步骤 parse → retrieve → plan → generate → verify → finalize，不伪造百分比。首次解析即发现缺项，可以在 retrieve 前返回 needs_input。

- ambiguous 型号通过 needs_input 返回候选；NO_EVIDENCE、SOURCE_CONFLICT 或资料条件无法确认通过 blocked 返回原因。
- 缺图片或图片不可读属于 blocked；publishable=false，不得提示“可发布”。
- 可删除/改写的违规句子允许修复后重新审核；最终全部检查通过可 succeeded，并在 findings 保留修改原因。
- 所有结果标记实际 provider。stub 模型或任何模拟适配器参与运行时 simulated=true；local+remote 为 provider=local/simulated=false，仍是本地开发模式。
- 正式 ima+remote 不得在失败后自动使用 local/stub。开发 fallback 只能通过重启配置显式切换并重新创建任务。
- 自动审核通过后若图片端点后来失效，C 增加可见提示并禁用正常成稿导出，直到图片重新可读；不能仍显示“全部素材可用”。

## 5. 错误语义

| 错误码 | 用于提交/读取 HTTP | 用于后台任务 | retryable |
|---|---|---|---|
| VALIDATION_ERROR | 400 | 通常不用 | false |
| NOT_FOUND | 404 | 通常不用 | false |
| INVALID_STATE | 409 | 通常不用 | false |
| BUSY | 429 | 通常不用 | true |
| IMA_AUTH_FAILED | 503（应用自己的上游凭证失败） | failed | false |
| IMA_UNAVAILABLE | 503 | failed | true |
| KB_NOT_FOUND / KB_AMBIGUOUS | 503 | failed | false |
| MODEL_UNAVAILABLE | 503 | failed | true |
| MODEL_OUTPUT_INVALID | 502 | failed | false |
| TIMEOUT | 504 | failed | true |
| INTERNAL_ERROR | 500 | failed | false |

轮询得到 failed 任务仍是 HTTP 200 + ok=true + data.status=failed；错误在 data.error。只有 HTTP 操作本身失败，才返回 ok=false。

例：
```json
{
  "contractVersion": "1.0.0",
  "requestId": "00000000-0000-4000-8000-000000000001",
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "platform 不是支持的平台。",
    "retryable": false,
    "fields": [{"path": "brief.platform", "message": "请选择支持的平台"}]
  }
}
```

A 限制单实例同时运行 2 个任务、排队最多 10 个，超过返回 BUSY（包含 Retry-After 响应头）。每任务总预算 180 秒，含排队时间；官方接口每次 20 秒、只对暂时性故障重试 1 次；模型每次 60 秒、传输重试最多 1 次，非法 JSON 修复最多 1 次；所有重试受总预算约束。超时必须 AbortSignal 传递并终止子进程/请求，不再覆盖终态。首次实现如确需调整数字，先改本契约再实现。

任务只在终态后按 RUN_TTL_MINUTES 清理；排队/运行中不能 TTL 清掉。重启不恢复任务，前端依据 404 提示失效。无数据库首版部署固定单进程单副本，不启动集群多 worker。

## 6. 后端内部接口：依赖注入

以下签名与上方类型统一导出；A 的 API 组合 B 的 Engine 和 A 的 Provider。包间禁止循环依赖。

```ts
export interface KnowledgeQuery {
  productQuery: string;
  audience: string;
  scenario: string;
  platform: Platform;
}
export interface AssetRead {
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}
export interface KnowledgeProvider {
  readonly kind: Provider;
  getStatus(signal: AbortSignal): Promise<KnowledgeStatus>;
  listProducts(query: string, cursor: string | null,
    signal: AbortSignal): Promise<ListProductsResponse>;
  retrieve(query: KnowledgeQuery, signal: AbortSignal): Promise<KnowledgeBundle>;
  readImage(imageId: string, signal: AbortSignal): Promise<AssetRead>;
}
export interface ModelRequest {
  system: string;
  user: string;
}
export interface ModelAdapter {
  readonly simulated: boolean;
  generateJson(request: ModelRequest, signal: AbortSignal): Promise<unknown>;
}
export type EngineOutcome =
  | { status: "needs_input"; questions: Question[]; result: null }
  | { status: "blocked" | "succeeded"; questions: []; result: Result };
export interface EngineDependencies {
  knowledge: KnowledgeProvider;
  model: ModelAdapter;
}
export interface EngineContext {
  runId: string;
  parent: Run | null;
  signal: AbortSignal;
  onStep: (step: Step) => void;
}
export interface AgentEngine {
  execute(input: CreateRunRequest, context: EngineContext): Promise<EngineOutcome>;
}
export type CreateAgentEngine = (deps: EngineDependencies) => AgentEngine;
```

B 从 `@huawei/agent` 导出 `createAgentEngine: CreateAgentEngine`、`createModelAdapter(config): ModelAdapter`。ModelConfig 由 A 在 M0 实现为 `{provider:"stub"|"remote"; baseUrl?:string; apiKey?:string; model?:string}`；remote 三个字段全必需，构造函数缺值抛 VALIDATION_ERROR。A 从 `@huawei/knowledge` 导出 `createKnowledgeProvider(config): KnowledgeProvider`；KnowledgeConfig 用 provider 判别：local 必须 localPath，ima 必须 clientId/apiKey/kbName/skillPath。这些 config 仅后端使用，不放入 HTTP 回包。

`@huawei/contracts` 还提供 `AppError extends Error`（属性 `detail: ApiError`，构造参数 ApiError）。Provider/Model/Engine 遇基础设施异常抛 AppError；A 捕获写入 failed。正常业务缺资料不能作为 INTERNAL_ERROR。

A 的 API 负责保存状态、限制并发、调度、超时、脱敏。B 的 Engine 不启动服务器、不写任务表、不读取浏览器或全局 .env、不自行创建知识库客户端。C 不直接 import agent/knowledge；前端依赖只到 contracts。

### ima 适配实测要求

赛题提到 `search_knowledge_base`、`get_knowledge_list`、`search_knowledge`、`get_media_info`。**必须读取官方 Skill/响应确认真实请求字段，禁止把本文内部类型直接当官方请求体。**

按名称查库并确认唯一匹配；搜索为空时目录遍历回退，包含游标分页；读取目标资料原文，不能把搜索摘要直接当完整依据。实际素材 API、权限、签名时效以实测为准；不能虚构“获取图片接口已接通”。

如调用官方 cjs，使用 spawn/execFile 的参数数组，避免 shell 拼接用户内容。凭证通过子进程环境传递；不把 stdout 原始响应写到公开日志。下载官方 Skill 前确认来源；不将本地资料里的命令当操作指令。

### 图片读取要求

A 建立 provider 内部 imageId 到受控资源的映射；API 在 readImage 前检查 imageId 确实在该 run.result.images 中。源可用但 HTTP 缓存过期时按原凭证合法刷新；不能让前端传任意 URL 或磁盘路径。

local 模式只读 LOCAL_KB_PATH 内资源（realpath 校验，防符号链接越界）；ima 模式只访问经实际响应登记并校验的来源域名，禁止私网地址和不受控重定向。返回 PNG/JPEG/WebP，最多 10 MiB；不返回可执行 HTML/SVG，不泄露访问令牌。

provider 自己维护图片登记，至少存活到任务 TTL；API 清理任务时通知实现清理关联资源或由 provider 自身 TTL 清理（不能永久缓存）。

## 7. 内容与来源完整性规则

这些是 schema refinement + 业务校验，单纯 TypeScript 编译不能替代：

1. sourceId/evidenceId/imageId/claimId/blockId 在各自命名空间唯一；同一 Result 中不能悬空引用。
2. Evidence.sourceId、ImageAsset.sourceId 必须出现在 sources；sources.provider 必须与 runtime.provider 一致。
3. 结果 productId 与引用证据/图片 productId 一致；不能因型号名相似通过匹配。
4. 文章标题、导语、正文、CTA、标签、图片文字/图注中的产品主张都必须登记 Claim，并由对应 Block.claimIds 引用；审核员还要从全文独立抽取主张，防止漏登记。
5. supported Claim 至少一条 evidenceId，原文真正支持主张并保留必要条件。仅 ID 存在不代表已经核验真实性。
6. placements.imageId 必须指向 access=available 的图片；afterBlockId 只能指向 draft.title/lead/body 中实际块，不指向标签、CTA、图注或不存在块。placements 顺序即展示顺序，同一图片不能重复凑图。
7. targetImageCount 和实际 placements 数都落在平台范围；实际数与目标数相等。少于最低要求 => blocked；不能写虚假配图占位成 succeeded。
8. succeeded 时所有留在 draft/图注中的 Claim 必须 supported，pendingItems=[]，无 severity=error 的未处理 Finding；result.review.publishable=true。
9. 因资料冲突 blocked 时 draft=null，避免展示一份看似可发布但事实冲突的稿件。图片不足的 blocked 可以保留 draft 供诊断，但不当最终稿。
10. 来源检索时间与资料有效时间分开记录；当前价/补贴不能由检索时间推断为有效。

来源字段、excerpt 不作为模型自由编造输出。B 只允许从 KnowledgeBundle 中选择 ID 和原文，审核后组装 Result；发现模型发明 evidenceId/sourceId 视为非法输出并修复或失败。

## 8. 前端与 Markdown 导出

- 追问表单将 Question.field 映射回 brief；field=other 的回答追加到新 prompt。型号候选 options.value 使用可检索的完整产品名称，选择后由提供器重新解析，不把答案当任意文件路径。
- 审核采用文字+图标，不只依赖红绿颜色；local/stub 标识始终可见。
- Block.text 是纯文本，不是 HTML。前端用组件渲染，不执行模型 HTML/脚本；来源链接限 HTTPS；生成 Markdown 时转义结构控制字符。
- 图片地址统一 `${API_BASE}/runs/${runId}/images/${imageId}`，API_BASE=`/api/v1`；生产和导出需要绝对地址时使用当前应用 origin。
- 导出 `.md` 包含：场景判断、产品/策略、图文稿、图片名/位置/图注/来源、事实与来源表、审核结果、资料模式和模拟标识。
- 图片不能只导出 imageId：Markdown 写运行期图片 URL，紧跟来源名称和 locator。明确“预览链接随服务或任务过期失效，本文没有打包图片”；首版不做长期图片托管。
- 只允许 succeeded 且当前图片加载正常时导出正式成稿。blocked 可复制审核诊断，不输出伪装成完成稿的文件。
- 不开发浏览器自由编辑并直接发布功能；用户输入修改要求后创建新任务，以确保修改后再次审核。

## 9. 契约夹具与版本变更

A 在 M0 提交 `packages/contracts/fixtures/`，使用虚构产品“测试电脑 A”，逐份写出完整 JSON：

- `health.local.json`、`knowledge.connected.json`、`knowledge.unconfigured.json`；
- `products.page1.json`、`products.empty.json`；
- `run.queued.json`、`run.running.json`、`run.needs-input.json`；
- `run.blocked.json`、`run.succeeded.json`、`run.failed.json`；
- `error.validation.json`、`error.not-found.json`；
- 合成图片可用简单测试 PNG，明确为测试资源，不当比赛真实素材。

这些 fixture 是完整 HTTP 封套（包括 Meta），所有 run.runtime.simulated=true。成功稿选择朋友圈、至少 1 张同产品合成图片、一个有证据的产品主张，全部引用闭合。D 对 fixture 做 schema 和跨字段校验，B/C 使用相同文件。

新增/删除字段、枚举、路由或状态前：提出变更 → A 修改本文/schema/fixture → B/C 更新调用端 → D 更新测试 → 同一兼容集成批次合入。v1 首版完成前不同时维护两套协议。HTTP 前缀和 contractVersion 必须匹配所有客户端预期；不匹配明确报“接口版本不兼容”。
