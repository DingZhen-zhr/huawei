# zxt 整分支魔搭部署

部署基线为 GitHub `origin/zxt@18b0219`，包括 `app/` 原界面、创意工作流、分支内提示词和说明材料。没有合并 `agent-dev`，没有上传本地知识库或图片。

## 生产运行

Node.js 22：进入 `app` 执行 `npm ci`、`npm run build`、`npm start`，访问 `http://127.0.0.1:7860/`。生产服务器监听 `0.0.0.0:7860`，不依赖 Vite 开发服务。`npm run dev` 复用同一后端路由。

Docker 构建上下文为仓库根目录：`docker build -t huawei-zxt .`；运行 `docker run --rm -p 7860:7860 huawei-zxt`。魔搭创空间选择 Docker 与可用免费 CPU 资源，使用根目录 Dockerfile。仓库不含许可证声明，部署时不应擅自附加新的开源许可。

## 配置与边界

- 可选 Secret `DEEPSEEK_API_KEY`：仅服务端读取，工作台和自由对话自动使用；也保留原界面填写个人 DeepSeek Key 的入口。浏览器改用 `X-Model-Key`，服务端仅向固定 DeepSeek 官方上游添加 Authorization，兼容魔搭平台头限制。已有界面文案和布局保留；“已连接”旧文案不代表进行过真实联网验收。
- 不配置模型时，软文保持原来的规则预览模式，不能将预览当作真实模型创作结果。服务器代理错误不回传提供方原始响应或凭证。
- 可选私有挂载 `KB_ROOT`：仅提供该目录内 Markdown/CSV 的只读检索，不提供整目录下载或任意文件读取。**公开服务上的该只读接口也可被访客访问，只能挂载已经明确允许公开的精选资料，不能直接挂载指定 ima 私有库。** 默认未配置，返回 404 并如实显示缺少证据；不假装完成 ima 真实接入。
- 系统提示词直接读取本分支 `系统提示词骨架.md`。`/@fs/system-prompt` 仅是原界面按钮的受限别名；其余 `/@fs/` 请求全部拒绝。
- 镜像只包含构建产物、生产服务和本分支公开提示词；`.env`、知识库、图片和 Git 历史均不进入镜像。文件忽略规则禁止提交真实环境文件。
- 公共服务不预置共享付费模型凭证；如管理员自行添加 Secret，请自行按账号额度管理用量。代理限制并发、请求大小、生成长度和等待时间。

健康检查：`/healthz`；配置存在性：`/api/runtime`，不返回任何 Secret。魔搭账号登录、阿里云绑定及实名状态、实际构建和访问状态均以平台验证为准，文件准备不等于部署成功。

## 官方依据

- [魔搭官方创空间部署说明](https://modelscope.cn/skills/modelscope/modelscope-studio)
- [Docker 创空间文档](https://www.modelscope.cn/docs/studios/docker)

官方要求 Docker 监听 `0.0.0.0:7860`，凭证使用 Secret，不能使用平台保留的前端 Authorization 及 `X-modelscope-*`、`X-studio-*` 头。只选择免费资源，付费配置需要另行授权。
