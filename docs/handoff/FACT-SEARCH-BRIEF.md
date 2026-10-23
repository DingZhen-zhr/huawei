# 事实搜索与价格确认：给搭档的一页说明

> 先看这个文件，不用从头读全仓库。
> 当前分支：`zhr`
> 当前提交：`e5ed585`
> 仓库：https://github.com/DingZhen-zhr/huawei

## 你接的是哪一段

你负责“找官方资料 + 把没依据的内容拦住 + 让管理员确认价格冲突”。

现在销售端已经能选任务、补真实细节、生成五个渠道、看预览和证据。具体在：

- 今日任务台：`app/src/pages/Today.tsx`
- 追问与真实细节门槛：`app/src/pages/Create.tsx`
- 五渠道工作台：`app/src/pages/Workbench.tsx`
- 事实账本：`app/server/refactor/ledger.mjs`
- 数字核验：`app/server/refactor/verifier.mjs`

你不需要重做这些页面。你要做的是把底层“事实来源”和“价格冲突确认”补硬。

## 现在已知的真实情况

- `HUAWEI MateBook 14（鸿蒙版）` 有两个价格记录：
  - `¥5,899`：知识库里的官方商城页面快照
  - `¥6,599`：官网参考起价
- 这两个价格现在处于冻结状态，正文不写具体价格。
- 已有核验能拦住无依据数字。比如写 `¥4,999`，会被标记为 blocked。
- 但目前还缺三件事：
  1. 缺资料时自动去华为官方页面搜
  2. 搜到的网页只作为候选，不直接变成事实
  3. 管理员确认 SKU、地区、日期、来源后，价格才能解冻

## 你要做的四件事

### 1. 去官网找资料

用 Tavily 搜索，但只接受华为官方域名。

- 最多 3 次查询
- 总等待不超过 20 秒
- 只存 URL、标题、抓取时间、正文摘要和 hash
- 抓不到正文就不生成事实
- 第三方测评、媒体、社区只能作为线索，不能单独作为事实

### 2. 搜到的内容先当“候选”

不要直接把搜索结果写进事实账本。

先进入 `proposed` 状态，和现有事实比对：

- 型号是否一致
- SKU 是否一致
- 单位是否一致
- 日期是否一致
- 是否存在价格/参数冲突

冲突时保留双方证据，不自动选边。

### 3. 价格冲突继续冻结

`5,899 / 6,599` 这条冲突不能被自动解决。

管理员确认时必须填写：

- SKU
- 适用地区
- 生效日期
- 来源
- 结论

确认后写入审计记录。没有审计记录的“已确认”不算完成。

### 4. 把拦截做实

以下内容必须 blocked：

- 没有同型号事实的价格
- 没有同型号、同单位事实的规格数字
- 无来源的赠品、补贴、库存、保修、活动期限
- 极限词和绝对化承诺
- 竞品贬低或无来源比较

blocked 的内容不能复制、不能导出。

## 你可以改的文件

```text
app/server/refactor/ledger.mjs
app/server/refactor/verifier.mjs
app/server/refactor/tavily.mjs          （新建）
app/server/refactor/fact-import.mjs     （新建）
app/server/refactor/admin-facts-routes.mjs（新建）
app/server/refactor/routes.mjs          （只加 P2 路由，不改已有接口形状）
```

测试可以放：

```text
app/server/refactor/fact-search.test.mjs
app/server/refactor/verifier.test.mjs
```

## 你不要改的文件

这些是共用部分，改了容易和主线冲突：

```text
app/src/pages/Workbench.tsx
app/src/pages/Today.tsx
app/src/components/AppShell.tsx
app/src/index.css
app/src/App.tsx
app/server/refactor/tasks.mjs
app/server/refactor/generator.mjs
app/server/refactor/auth.mjs
app/server/refactor/store-repo.mjs
```

如果你觉得必须改，先在 PR 里说明原因，不要直接大改。

## 验收只看这四件事

1. 稿子里写 `¥4,999`，但账本没有依据 → 被拦
2. `5,899 / 6,599` 价格冲突 → 仍然冻结
3. Tavily 搜到页面 → 只是候选，不自动放行
4. 管理员确认具体 SKU、日期、来源 → 价格恢复，并留下审计记录

## 怎么交付

从最新 `zhr` 开自己的分支：

```bash
git fetch origin
git switch -c feat/fact-search origin/zhr
```

完成后：

```bash
git add <你负责的文件>
git commit -m "feat: 官方事实搜索与价格冲突确认"
git push -u origin feat/fact-search
```

在 GitHub 发 PR：`feat/fact-search` → `zhr`。不要直接推 `zhr`。

## 一句话边界

**搜到网页不等于事实；模型说通过不等于通过；价格必须同型号、同 SKU、同日期、同来源。**
