# Task1: 产品承接与问答约束

- Create 使用既有 `GET /api/products` 的完整产品目录和 taskCards。显式 productId 优先于 taskCardId；任何显式无效 ID 都阻止生成。无产品参数时才使用默认选项。
- 无今日任务卡的型号使用前端 CreateChoice；提交真实 productId，不提交合成的 `product:*` taskCardId。同型号无素材时展示“暂无该型号官方图”。选择其他型号同步 URL，因此刷新保持选中产品。
- Ask 按 user 消息顺序更新槽位，后续明确预算和用途优先，未提及字段保留。否定用途会撤销对应用途；否定 Windows 取消 Windows 硬约束。
- 明确“14 英寸以内”按真实尺寸 <=14；“14 寸左右/级别”按 14–14.9 范围，不包含 16 英寸。折叠产品的全部已知屏幕形态均需符合限制。
- Windows 筛选只接受同型号系统事实中的肯定 Windows 支持；混合 OS 产品提醒选择 Windows 配置。
- 预算判断要求 active 价格、同型号同价格带 SKU 的账本价格事实，且采集时间不超过七天。conflict/missing/stale 或缺少可核对价格证据时 budgetFit=unknown、overBy=null。先推荐符合硬约束的预算内型号；没有时明确列出超预算备选。
- 缺少 HIGHLIGHTS 的真实型号使用同型号 active 非价格 facts 生成通用内容；不补造参数。后续场景策略属于 Task2，媒体与发布属于 Task3。

验证：19 项原基线全部保留；新增回归后共 29 项通过。覆盖全 10 型号五渠道生成、D14 真实 HTTP 创建/完成/重复读取/进程重载，以及纯函数型号选择。Create 浏览器跳转和实际提交 payload 由独立验收补充，不以源码匹配替代。

Task3 接口衔接：现有 Ask `followupHref` 使用 `/create?productId=...&scene=...&budget=...&audience=...&target=...`；Create 已读取并承接全部这些参数。若改用 `/api/ask/to-content`，需由该接口保留这些参数；本任务未修改 routes、api.ts、队列或事实来源政策。
