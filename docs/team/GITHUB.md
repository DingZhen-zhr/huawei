# GitHub 与 Codex 协作手册（所有成员必读）

> 只使用 https://github.com/DingZhen-zhr/huawei 。成员需接受仓库邀请。
> 四个人各自拥有本地克隆；每个 Codex 任务只在自己的目录/分支工作。
> 本文是操作约定，不代表已执行提交、推送或部署。

## 1. 第一次开始：队长先处理空仓库

本地检查时仓库还没有提交，文件夹包含未跟踪的原始知识库和 PDF。远端状态可能变化，执行前先核查，不覆盖其他人的提交。

队长只需先发布 `docs/team/` 任务书，并建立默认 main。若已存在远程 main，先同步它，不重新初始化。

```bash
git status --short --branch
git remote -v
git ls-remote --heads origin
```

只有在本地无提交、远端无分支时，才重命名当前 unborn 分支为 main，然后显式暂存任务书：

```bash
git branch -M main
git add docs/team
git diff --cached --stat
git diff --cached --name-only
```

确认暂存区只有任务书，再按本队提交约定创建首次提交，之后执行：

```bash
git push -u origin main
```

**提交约定：生成 Git 提交信息、创建或改写提交必须委派给已配置的 `git_commit_luna`。** 若当前 Codex 没有这个 Agent，先完成文件、验证与暂存检查，明确告诉队长缺少配置，让队长手动提交或明确授权替代流程；不要冒充调用了该 Agent。人工提交可用 `git commit` 打开编辑器自行填写。

首个文档提交可直接用于建立 main；之后全部功能开发通过分支和 PR。不需要为建立分支重写任何现有历史。

## 2. 队员第一次拉取

在终端执行（已有克隆则不要重复克隆）：

```bash
git clone https://github.com/DingZhen-zhr/huawei.git
cd huawei
git remote -v
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
```

在 Codex 中把这个 `huawei` 文件夹作为项目打开，发送分配给你的 Prompt。若仓库仍为空或 main 不存在，等待队长首次发布，不自行建立另一套工程。

## 3. 各角色分支

| 角色 | 首个分支 | 自己主要修改的目录 |
|---|---|---|
| A | `codex/a-platform` | apps/api、packages/contracts、packages/knowledge |
| B | `codex/b-agent` | packages/agent |
| C | `codex/c-web` | apps/web |
| D | `codex/d-quality` | tests、deploy、.github、docs/submission |

从最新 main 建立自己的分支，例如 A：

```bash
git switch -c codex/a-platform
```

B/C/D 替换为表中对应分支。分支已存在且确实属于自己本次任务时 `git switch 分支名`；不要覆盖他人的分支。后续任务可加功能后缀，如 `codex/c-web-export`。

## 4. 开工前每次都做

```bash
git status --short --branch
git remote get-url origin
git fetch origin
```

- origin 必须是本仓库的 HTTPS 或 SSH 地址；不对错误项目执行 push。
- 工作区有别人或用户的改动时先保留，不执行 `git reset --hard`、`git clean -fd`。
- 已经在自己的分支时，同步 main 前先提交/保存好自己的工作。由 Codex 在理解冲突后合并 `origin/main`；不要强推，不用 rebase 改写已共享历史。
- 原始资料可以按授权放在本地，通过 `LOCAL_KB_PATH` 指定路径；不要因为 git status 显示它们未跟踪就顺手上传。

## 5. 开发结束后检查与提交

M0 已合入后，统一检查：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

修改 UI 或跨模块流程时再运行相关 e2e。纯文档修改检查链接、代码块和字段一致性即可，不需要跑无关测试。真实 ima/模型测试由负责人显式触发，默认 CI 不调用收费服务。

显式暂存自己修改的文件。下面是 B 的例子，不适用于 A/C/D：

```bash
git add packages/agent docs/handoff/B.md
git diff --cached --stat
git diff --cached
```

检查后按上述 `git_commit_luna` 约定提交；再推送自己的分支：

```bash
git push -u origin codex/b-agent
```

**不要用 `git add .`、`git add -A`、`git push --force` 或直接推 main。** 只有由负责人处理共享文件的 PR 才包含这些文件，不能夹带其他成员改动。

## 6. 创建 Pull Request（PR）

PR 是请求把自己的分支合并到 main。可以在 GitHub 仓库页面点击 “Compare & pull request”，base 选 main、compare 选自己的分支。

如果安装了 GitHub CLI，先 `gh auth status`；需要时用自己的账号 `gh auth login`，不使用别人的 token。将实际 PR 正文保存为本机文件（例如 `/tmp/huawei-pr-body.md`），不要把尖括号占位符原样执行：

```bash
gh pr create --repo DingZhen-zhr/huawei --base main --head codex/b-agent --title "B：Agent 生成与核验" --body-file /tmp/huawei-pr-body.md
```

替换为自己的角色/实际功能；上面的标题是 PR 标题，不是自动生成的 Git 提交信息。若 Codex 支持 attach_artifact，创建 PR 成功后把该 PR 关联到当前聊天。

PR 正文必须写：

```markdown
## 完成内容
- 实际实现的功能。

## 接口影响
- contractVersion；字段/路由是否变化；有变化时列出已经协调的调用方。

## 验证
- 实际运行的命令和结果；没运行的要说明原因。
- 使用了 local/stub 还是真实 ima/模型。

## 联调方法
- 如何启动、输入什么、预期看到什么。

## 已知限制
- 没完成的能力、缺少的凭证/权限、需要谁接手。
```

由 D 或队长审查并合并；未获合并授权的成员只创建 PR。PR 有冲突时先同步 main，逐个解决；合同字段冲突交 A 裁决，依赖锁文件交 D 处理，不能用“全部接受我的版本”覆盖队友工作。

## 7. A 首次骨架必须配置 .gitignore

下面是必须覆盖的类别，由 A 根据项目真实目录写入，不要忽略代码用的合成 fixture：

```gitignore
node_modules/
**/dist/
coverage/
playwright-report/
test-results/
.env
.env.*
!.env.example
.DS_Store
/华为PC全板块深度知识库_v7/
/华为·产业进阶赛道·赛题手册v4(1).pdf
/local-data/
/private-artifacts/
```

`.gitignore` 不能移除已追踪文件；若发现资料或密钥已经被提交，停止继续传播并交队长处理，不擅自重写历史。凭证泄露需要撤销/轮换，单纯删除文件不够。

知识库留在本地不影响通过 GitHub 协作代码。共享测试数据由 A 人工编写为合成 fixture；正式运行通过获授权的 ima 账号访问。不要在 PR、Issue、截图和日志中粘贴凭证、真实用户数据或完整内部接口回包。

## 8. 交接规则

每人维护 `docs/handoff/<角色>.md`，记录：分支与 PR、契约版本、完成项、如何验证、真实/模拟状态、剩余问题、需要哪位成员做什么。只有实际跑通才能标“完成”。

根配置/lockfile 的写入权：A 完成 M0 后交给 D。新增依赖先提交需求给 D，尽量一次处理一个依赖变更 PR。A 继续独占 contracts 的写入协调权。其他成员可以提出改动建议，不私自复制类型绕开契约。
