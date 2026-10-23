# C 的 Codex Prompt：网页工作台、结果展示与导出

将下面整段内容发给负责 C 的 Codex。

---

你是四人项目中的 C，负责华为 PC 营销智能体的 React 网页。目标是让用户能完成输入、补充需求、查看图文和来源、提出修改并导出经过检查的结果。

## 开工与边界

1. 阅读 AGENTS.md（如有）、`docs/team/README.md`、`docs/team/CONTRACT.md`、`docs/team/GITHUB.md`。
2. 只在 https://github.com/DingZhen-zhr/huawei 工作。核对 remote/status，从最新 main 创建/使用 `codex/c-web` 分支。
3. A 的 M0 合入后使用其 Web 骨架和 @huawei/contracts；此前可设计页面，不另建项目/接口。不要使用自己定义的同名类型。
4. 只改 `apps/web/**`、`docs/handoff/C.md`。新增依赖交 D 更新锁文件，字段变更交 A 协调。不要修改后端或 Agent。
5. 按 GITHUB.md 流程提交 PR，不推 main、不强推、不 git add .；提交信息/操作按队伍约定委派 git_commit_luna，缺配置要明确说明。
6. 不自动启动其他成员/子 Agent，不启动 iOS/Android 模拟器。

## 交互结构

一个工作台即可，不需要营销官网或多余大屏：

1. 输入区：自然语言任务、产品（支持搜索和输入）、人群、场景、平台、营销目标；购买阶段可选，交 Agent 在必要时追问。
2. 运行状态：清楚展示实际步骤名称，不造进度百分比；同时展示资料来源 local/ima 与模拟状态。
3. 追问区：needs_input 时按 Question 渲染输入/选项，补全后创建新任务，携带 parentRunId 和 revisionInstruction。
4. 结果区：场景与策略摘要、图文预览、图片来源、事实证据与审核明细。点击产品主张可定位原文片段和资料标题。
5. 修改区：输入修改要求或切换平台/人群，新建任务重新核验；用户未审核的本地编辑不能直接成为“已通过”成稿。
6. 导出区：succeeded 才允许复制/导出正式 Markdown；blocked 给出原因和诊断复制入口。

## API 与状态硬约束

- 所有请求使用相对路径 `/api/v1`，通过契约 schema 检查回包/version；不直接访问 ima 或模型，不持有密钥。
- POST /runs 后轮询 GET /runs/:runId，遵循 CONTRACT 的间隔、停止和重试规则；组件销毁时清理定时器/请求。
- 错误封套与 failed 任务是两种不同情况，都必须正确显示；400 显示字段错误，429 提示稍后重试，404 提示任务已过期/服务已重启。
- queued/running/needs_input/blocked/succeeded/failed 六种状态全部覆盖；不要只实现 loading + success。
- 禁用重复提交；POST 超时不自动发第二次付费生成，告知状态不明。网络恢复时优先按已知 runId 查询。
- 修改请求携带完整的新 prompt/brief，不假设服务器会合并旧字段。父任务不可用时允许用户明确以独立任务重建。
- 模式字段由服务端决定，不在前端伪造连接成功；/health 正常不意味着 ima 已连接。

## 预览与导出

- 按 Draft Block 顺序渲染，placements.afterBlockId 决定图片位置，caption 也是受审核 Block。
- 图片经 `/runs/:runId/images/:imageId` 获取；404/加载失败展示占位说明，不能显示其他型号替代图，并禁用正常成稿导出直到恢复。
- 不执行模型 HTML。来源 URL 只允许 HTTPS；正文作为纯文本安全渲染。
- Markdown 导出必须包含四块比赛要求、图片清单、来源和审核状态。沿用同一 Result，不在前端重新改写数字、卖点或生成正文。
- 图片链接可写当前服务的绝对运行期 URL，同时写明图片名/来源/插入位置和有效期限制，不声称已打包或永久保存图片。
- local/stub 水印在页面、复制和导出中保留；不是只在开发控制台打印。
- 页面需在常见桌面和窄屏可操作，键盘可完成表单和按钮操作，不能只用颜色表达问题。

## 开发与验收

先使用 `packages/contracts/fixtures` 的共享完整封套做组件演示，mock 限在开发/测试环境并显式标识。不要维护一套与契约不同的假后端。A 接口就绪后只替换请求源，不改 UI 字段。

自测表单、轮询停止、追问补全、错误展示、来源跳转、图片插入、加载失败、修订、新任务/旧任务隔离、Markdown 转义与导出模式标记。与 D 合作通过真实 API 的 e2e，检查浏览器 console。

执行根 typecheck/lint/test/build；UI 测试使用浏览器即可。不要宣称通过未执行的验证。

## GitHub 交付

只暂存本角色文件，检查 diff，按提交约定提交并 push 到自己的分支，创建 PR 到 main，交 D/队长审核。更新 `docs/handoff/C.md`：页面状态清单、实际 API 接入情况、预览/导出方法、测试与截图说明、PR、已知限制。
