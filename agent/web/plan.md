# MVP 网页任务计划与交接

范围：独占 web/，对应任务输入、缺项追问、阶段进度、六分区、模式标识、修改与导出。保留 acceptance.json 全部条目与状态，由独立测试 Agent 验证。

实现：原生 HTML/CSS/JS，不引入依赖；固定 DOM 标识沿用 spec §13。与核心 Agent 协商采用 /api/config、POST /api/tasks、GET /api/tasks/:id/events，SSE progress/result/error。修改将现有输入与附加要求创建新任务，因此重新经过完整核验链。

风险控制：上游内容通过 textContent 创建；外链只接受 HTTP/HTTPS；凭证输入为 password，仅 POST 到本机后端，保存成功立即清空，不使用浏览器存储；真实缺配置不假装连接。演示模式显著提示非实时资料核验，演示导出附加相同标识。阻塞结果禁用成稿导出。

验证：对 app.js 执行 Node 语法检查；核心尚未合入时不能启动端到端冒烟，集成后须由独立测试 Agent 实际浏览器验证完整任务、缺项、四平台、连接设置、修改、复制与下载；还须检查窄屏布局与 SSE 失败后的重试。未宣称任何验收通过。
