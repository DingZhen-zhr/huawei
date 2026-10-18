# MVP 网页任务计划与交接

范围：独占 web/，对应任务输入、缺项追问、阶段进度、六分区、模式标识、修改与导出。保留 acceptance.json 全部条目与状态，由独立测试 Agent 验证。

实现：原生 HTML/CSS/JS，不引入依赖；固定 DOM 标识沿用 spec §13。与核心 Agent 协商采用 /api/config、POST /api/tasks、GET /api/tasks/:id/events，SSE progress/result/error。修改将现有输入与附加要求创建新任务，因此重新经过完整核验链。

风险控制：上游内容通过 textContent 创建；外链只接受 HTTP/HTTPS；凭证输入为 password，仅 POST 到本机后端，保存成功立即清空，不使用浏览器存储；真实缺配置不假装连接。演示模式显著提示非实时资料核验，演示导出附加相同标识。阻塞结果禁用成稿导出。

验证：对 app.js 执行 Node 语法检查；核心尚未合入时不能启动端到端冒烟，集成后须由独立测试 Agent 实际浏览器验证完整任务、缺项、四平台、连接设置、修改、复制与下载；还须检查窄屏布局与 SSE 失败后的重试。未宣称任何验收通过。


## 本地版第二轮：阶段进度（AC-043）

独立 web-local-enhancement 分支，独占 web/。进度只展示服务实际返回的elapsed_ms/ms、attempt(s)、retries和主备角色，缺字段显示待返回；不根据UI刷新次数推算真实重试。连接摘要仅已配置/协议/host，不回显完整地址或凭证。保留SSE与原有编辑、预览及附件下载。验证先做语法与差异检查，待core进度字段合入由独立QA通过网页确认。


## 本地版第二轮：依据、图片与报价

事实卡保留public id并建立正文/逐判断fact_ids可点锚点；原始来源只接受HTTP/HTTPS且拒绝URL内用户名密码，没有链接显示待确认。图片卡展示自身型号、来源、位置和后端核验结果，不根据有图就标通过。报价以SKU明细表、服务返回的算式/金额/日期/渠道/地区展示，缺值待确认；fixture须有虚构样例标识。前端不发明价格或减免，不用真实产品事实填充demo。旧版字符串正文与新对象正文均兼容；编辑/文本预览/服务器附件保持。独立QA需覆盖点击引用、缺图/错图、缺价格、fixture标识及新旧结果形状。


## 完整版独立前端

工作区 full-web / feature/full-web，从develop/full派生；不得将变更合入release/lite。恢复正式任务数量/预算/独立约束、型号候选表单、八阶段公开摘要与失败后保留输入重试。保留既有真实/演示门禁；选项从/api/options返回，未取得不伪造候选。完整版与简易版本身份明显区分。新字段/修改请求待core确认契约，开发不改55项验收状态。


完整任务契约与core确认：保持/api/tasks与SSE，新增/api/options；quantity/budget/constraints独立，追问支持multi/number/model_pick和带来源的model_candidates。编辑只发送revision_request结构及previous_task_id，不把修改指令拼入客户处境；核心负责每次修改后重验。成稿导出仅complete/complete_with_pending白名单，其余禁止；pending草稿始终提示核对而非最终通过。
