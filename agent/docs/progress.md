# progress.md

只追加,不覆盖。每条格式:`## [序号] 角色 | 日期` + 做了什么 / 当前状态 / 下一步 / 未完成项。

## [001] 需求 Agent | 2026-10-18

做了什么
- 在 `_download/agent` 初始化 Git,local 配置 user.name/user.email 为占位值(sdlc-agent),未动全局配置。
- 补全 `.gitignore`:`.env`、`.cache/`、`node_modules/`、`.npm-cache/`、`.codex-home/`、`out/`、`codex-src/`。
- 写 `docs/intent.md`(问题、期望结果、约束、待决问题)。
- 写 `docs/acceptance.json`,55 条,全部 `passes: false`,覆盖设计书全部评分点。

当前状态
- 计划阶段制品已就绪,等待用户在关口确认。

下一步
- 用户确认 intent.md,并提供模型接口与 ima 凭证。
- 随后进入设计阶段(`docs/spec.md`、规则库、提示词、Schema)。

未完成项(待决,详见 intent.md 第 4 节)
- 模型接口:请求地址、模型名、Key 未提供;是否支持 `/v1/responses` 未知。
- ima Client ID / API Key 未填入 `.env`。
- 本地镜像与 ima 库是否同源未确认。
- 现场场景卡格式未知。
- 魔搭账号、手册与投影口径冲突以哪个为准,均未确认。

## [002] 设计 Agent(场景规则修复) | 2026-10-18

做了什么
- 修复 `harness/rules/scenes.json`:删除被中断写入的尾部多余两行(原第 452–453 行),原 8 类场景内容全部保留。
- 调整八类卖点顺序,使第一卖点互不相同:开学季 portability、职场办公 multi_device、内容创作 color_creation、家庭换新 migration_ease、企业采购 deployment_manage、门店到访 display_comfort、新品首发 performance_memory、节日营销 design_look。随之调整职场办公/门店到访/新品首发/节日营销的 `default_strategy` 与演示骨架(新品首发增加"并排对照规格页"一步)。
- 对齐 spec §5.1:`recommended_models[*].fit_topics` 由卖点 key 改为 `fact_topic`;`note` 只写选型方向。
- 内容创作禁忌正则增加英文字母边界,避免 "PR/AE/PS" 误伤普通英文单词;客户要求软件跑分类的 `pending_if_requested.topic` 由 `spec` 改为 `other`(spec 的 topic 枚举无 `spec`)。
- 说明字段 `doc` 改名为 `_doc`(规则加载器应忽略下划线开头字段,不属于契约)。
- 已用 node 与 python 解析,并用脚本核对:8 类齐全、切入点每类 ≥3 且全局 id 唯一(共 29 个)、卖点 key 均在目录内且权重降序、默认策略合法、正则可编译、topic/model_id 均在枚举内。

当前状态
- `scenes.json` 合法并已提交,待开发 Agent 的 `rules.mjs` 加载与 `selfcheck` 接入。

未完成项 / 与 spec 或验收清单的出入(不改 acceptance.json,仅记录)
- spec §5.1 的 `pending_if_requested.topic` 枚举无 `spec`,也无 `model`/`image`,若后续需要请 spec 增补。
- `taboos[].check` 的 `forbid_regex` 的 `patterns` 在 JSON 中为字符串,含 `(?<!…)`、`(?!…)` 断言,要求加载器用 JS `RegExp(...,'u')`;换用其他正则引擎需重写。
- `bts_no_single_perf` 的 `require_groups` 用 study/carry/battery 三组、min=2,组内 topic 取自 fact_topic;是否满足由代码在草稿后按事实主题覆盖判定,尚未实现。
- 触发词与禁忌正则为首版,未用真实样本回归;测试 Agent 应以 spec §14.3「八场景」用例补测。
- 型号 `recommended_models` 中下架型号(D14、D16、14 Ultra、GT 14、X Pro)报价必为待确认,已在 note 中标注;阶段 4 须按知识库实际可读性再剔除。
