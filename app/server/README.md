# 服务端只读接入

复制 `app/.env.example` 为未提交的 `.env.local`，填写 ima 只读网关及 OpenAI-compatible 模型环境变量。运行 Vite 开发或预览服务，同端口提供 `/api/status` 与 `/api/generate`。仅上传 dist 的静态托管没有此 API，生产部署需运行服务端。凭证只能在服务端使用，禁止 VITE_* 密钥或浏览器存储。

此实现是可配置的自有网关协议，**没有假设存在官方 ima HTTP API**。账号持有人需实现/配置能访问指定库的只读网关。所有返回值必须源于账号实际可见原文。未配置诚实阻断；测试 fixture 不能作为正式资料。

网关端点均使用 Bearer 服务端密钥：

- GET `/status` 返回 `{knowledgeBase:"任德耀新建华为PC知识库",authenticated:true,readOnly:true}`，须真实验证账号与知识库权限。
- POST `/search` 接收 `{knowledgeBase,task,readOnly:true}`；零命中调用同请求体的 POST `/browse` 做目录回退。
- 检索及目录返回 `{knowledgeBase,readOnly:true,facts:[],images:[],conflicts:[]}`。facts/images 字段见 `contracts.ts`，verifiedAt 由工作台添加。每条事实必须有 claim、原文 quote、资料 title、entryId、原文 location、date、完整 identity 和 conditions；没有附加条件请明确填写。image 还需 filename/url。identity 必须与用户确认的完整身份逐字一致；不能仅给搜索摘要。图片 URL 必须用户可访问且不含密钥。conflicts 非空阻断。
- `/api/status` 的 verified 仅表示连接探测通过，模型探测产生一次真实调用；不表示内容核验通过。
- `/api/generate` 只输出带事实 ID 映射的草稿。逐句语义、限定条件、图片访问/画面身份/使用权仍需人工复核。图片不足会明确标为不可发布草稿。
- 冲突结构为 `conflicts:[{reason,left:{quote,title,entryId,location,identity,date},right:{同左}}]`（也支持 `sources:[甲方,乙方]`）。阻断结果 issues 保留双方限长安全原文片段、身份、日期与标题定位，供人工核对；含凭证的上游结果整体拒绝，不转发密钥。缺失字段明确标记需补充。
- 模型输出另需 `titleFactIds` 和 `ctaFactIds`。标题要求非空有效事实编号，CTA 仅明确纯行动短语允许空数组；返回 claimChecks 包含标题、正文和 CTA 的独立待人工核对记录。编号有效只能证明映射存在，不能证明语义成立，仍需人工逐句核对。
- 含价格任务必须返回 `priceQuote`（结构见 contracts.ts）：同身份、P1/08 原文定位、SKU、单价、整数数量、CNY、渠道/地区与条件，原文须包含该SKU及单价；currentVerified 为 true 且 currentVerifiedAt 是北京时间当日。缺失、旧复核、错身份均阻断。当前复核由网关根据实际原文完成；不能自行填写 true 冒充。服务计算单价×数量，并把价源加入模型事实包及正文算式；仍待人工复核。

错误不转发上游响应正文、地址或凭证。服务仅绑定本机，同源校验拒绝跨站调用。只返回任务引用的证据片段，不向浏览器公开整个库。

测试（Node 24）：`node --experimental-strip-types --test server/service.test.ts`。fixture 显式标记 TEST ONLY，仅由测试导入，服务不会加载。
