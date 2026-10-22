# Workflow quality 验收记录

2026-10-22，代码 `383ed63`，基线 `4967250`。独立完整差异复审与本地浏览器验收均 Ready yes，无阻断缺陷。

## 自动验证

在 `app` 执行 `node --test server/refactor/*.test.mjs`：75/75 通过，0 失败、0 跳过。Create 的实际测试为 `create-selection.test.mjs`、`create-flow.test.mjs`，包含于该 glob；不存在的 `src/lib/create-context.test.mjs` 不计入验证。

`npm run build` 通过。7 个改动 TS/TSX 文件的 eslint 通过：ExportDelivery、ImageDelivery、api、chat、create-selection、Create、Workbench。全量 lint 保留 18 个既有错误。`AppShell.tsx`、`index.css`、`tasks.mjs` 相对基线零差异，`git diff --check` 通过。

回归覆盖预算和否定条件合并、真实型号接续、所有型号事实归属、场景差异、动作依赖、媒体权限和失效、并发及清理、下载和导出核验、渠道重试后选稿回退。失败渠道重试回退来自自动化回归，未声称浏览器手点失败重试。

## 独立浏览器与下载

Edge 手机 390×844、桌面 1440×1000 实际操作：6000 元、Windows、上课且否定视频游戏的输入保持 D14；Create 与任务刷新保持型号、预算和场景，无官方图不借用其他型号。4500→9000→轻一点的连续对话保持最新预算9000。

GT14 导卡/硬盘与通勤/只改脚本各 11 稿，逐稿文案均有实际差异。导卡全部角度保持先连接、核对识别，再打开目录。

手机和桌面均实际点击生成/重新生成、单图下载与五渠道 ZIP 下载，确认文件落盘并打开 PNG、解包 ZIP。手机单图109350字节、桌面单图122537字节；两份 ZIP 各669740字节。每包含5份所选文案、7张真PNG、manifest、sources、README，0缺图；小红书/朋友圈/视频的非默认故事角度与正文、来源一致。三张小红书图的字节哈希各异，封面、证据和CTA内容不同；PNG实际尺寸与计划一致，中文、CTA及限定脚注可读。产品保持官方源图范围，不宣称局部源图呈现完整机身。

桌面刷新恢复已生成图片；角度选择刷新后回到默认，未宣称跨刷新持久化。浏览器走下载 fallback，未验证系统原生分享或取消分享。D14真实请求无可用官方图时明确 unavailable，文字包如实记录缺图。

真实 HTTP 验证匿名 assets/export 为401、未知图片404、合法编辑后旧图409；伪造价格、重量、赠品后生成/旧图下载/ZIP全部409。跨门店404与进程重载等由自动化真实临时HTTP/服务层回归覆盖，不宣称使用第二个门店账号做浏览器操作。

## 边界与非阻断偏差

- 合法编辑后旧图返回HTTP409及可读错误，但通用错误响应未携带计划中的 `ASSET_STALE` code 字段；失效阻断有效。
- 视频故事封面的长标题尾部“核对”被省略，正文CTA与限定脚注完整；不宣称所有标题逐字无截断。
- 本次验证为 `rules-v1` 内容与 `official-layout` 官方图排版；未验证真实LLM、联网检索、AI图片服务、Linux字体或生产部署。Windows实际字体检查已通过；Linux要求见 [媒体运行说明](../app/server/refactor/CONTENT-MEDIA.md)。

IMA与事实来源政策、任务引擎、全局样式和应用壳未修改。generator与Workbench仅按已授权范围接入场景策略和交付组件。
