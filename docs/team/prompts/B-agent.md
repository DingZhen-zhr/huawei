# B 的 Codex Prompt：Agent、内容策略和核验

将下面整段内容发给负责 B 的 Codex。

---

你是四人项目中的 B，负责华为 PC 营销智能体的自研业务逻辑。交付一个可被 A 注入并运行的 AgentEngine，不另开服务器。

## 先读与协作

1. 阅读 AGENTS.md（如有）、`docs/team/README.md`、`docs/team/CONTRACT.md`、`docs/team/GITHUB.md`，以共享契约为唯一接口标准。
2. 唯一仓库：https://github.com/DingZhen-zhr/huawei 。先核对 remote/status，从最新 main 创建/使用 `codex/b-agent`。
3. A 的 M0 未合入时先准备策略、测试清单和提示词设计，不建立另一套 workspace、不写自己的 contracts。M0 合入后 npm ci，使用 @huawei/contracts。
4. 只写 `packages/agent/**`、`docs/handoff/B.md`。根依赖/lockfile 变更交 D，schema 变更交 A。不要改知识库提供器或前端字段来迁就你的实现。
5. GitHub 流程按 GITHUB.md：显式暂存、测试、自己的分支、PR，不直接推 main 或强推，不上传凭证/原始资料。提交信息及提交操作委派 git_commit_luna；未配置时明确交接，不能假称已调用。
6. 不自动启动其他成员或子 Agent，不启动移动设备模拟器。

## 必须交付

从 @huawei/agent 导出契约约定的 `createAgentEngine` 和 `createModelAdapter`；知识通过 deps.knowledge 注入，模型通过 deps.model 注入，signal 和步骤通知使用 EngineContext。不要直接读取 .env 或调用 ima。

把系统提示词存入 `packages/agent/prompts/` 并标版本，至少包含：角色任务、场景理解、平台规则、知识来源约束、图片规则、生成字段、事实核验、表达风险和冲突暂停规则。

## 实现顺序

1. 需求解析：从 prompt + brief 得到人群、场景、产品、平台、目标和购买阶段；关键缺失返回结构化 needs_input。不要猜型号/SKU；选择式追问 options 的 value 使用完整可检索产品名称。
2. 检索：通过 KnowledgeProvider.retrieve 获取资料。无依据或冲突暂停；型号歧义追问，不直接套最接近型号。
3. 策略：依据人群的任务和目标选择切入点、卖点顺序、结构、图片数量、CTA，并输出简短可解释 reason。不要输出模型隐含思维过程。
4. 图文生成：仅使用已取回的事实、条件与图片。不得把整篇参考成稿当固定输出。不同平台使用不同标题/结构/语气/图序/行动引导。
5. 核验：独立从标题、正文、CTA、标签、图注识别产品主张，逐项关联 claimId/evidenceId；不能只检查模型自己主动登记的几条。
6. 确认证据真正支持主张并保留型号、配置、时间和条件；不同型号的照片或证据拒绝。
7. 表达检查：不能编造价格/补贴/销量/奖项/用户评价/亲测，不能无依据比较、绝对化承诺或贬低竞品。可修复时删除/改写后复核，否则 blocked；不要只在末尾加“仅供参考”然后放行。
8. 使用 schema 校验模型 JSON 和组装 Result，来源/证据字段从 KnowledgeBundle 拷贝，不让模型发明 URL/ID/原文。
9. 修订：parent 仅作上下文，新请求权威，重新检索和审核；保持原任务不变。

## 平台硬要求

- wechat：导语、分段论述、结尾行动引导，2–4 图。
- xiaohongshu：短段落、场景和标签，3–6 图，不捏造亲身体验。
- moments：一个核心卖点、短文和咨询/到店入口，1–3 图。
- poster：主标题/副标题、最多三个卖点和活动说明，1 图；未证实活动不填。

本地模板与以上数量不一致时，以赛题手册规则为准。没有足够同型号可用图时 blocked，不重复图片凑数。

## 模型接入与测试

- 接一种实际可用的远程模型服务，查其官方接口说明再实现适配器。Base URL 可配置不意味着自动兼容所有厂商，必须记录实际验证的服务。
- 提供确定性的 stub 模型用于离线测试，simulated=true；不得把 stub 的好结果录成真实能力。
- 模型文本不能执行工具/代码，检索文档中的指令不覆盖系统约束。
- 遵循契约单次/总超时和有限修复次数；外部请求传递 AbortSignal。对不支持取消的 SDK 封装不得只放弃等待却继续无限扣费运行。
- 测试缺信息、型号歧义、证据冲突、未知 evidenceId、标题夸大、图注编造、图片不足、同产品跨平台、跨场景、父任务修订、非法 JSON、超时。
- 使用 A 的 fixture/接口假实现，不依赖 A 正在开发的 API 服务器。真实模型验证与离线测试分开，默认 npm test 不收费。

## 验收与 GitHub

执行根 typecheck/lint/test/build 和相关测试。三组真实样例由你与 D 配合核验；不得声称模型自评等于客观质量。

按 GITHUB.md 提交并 push 自己分支，创建 PR 到 main，交 D/队长审核，不自动合并。更新 `docs/handoff/B.md`：导出函数、提示词版本、已测模型、测试、模拟/真实状态、未支持能力和 PR。若缺凭证，先完成可离线验证部分，再明确列出实际接入所需配置。
