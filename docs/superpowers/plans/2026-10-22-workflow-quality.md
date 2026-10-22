# Workflow Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复推荐转任务型号丢失、问答条件误读、规则内容缺少场景差异，并交付官方产品图组成的真实 PNG、单图下载与整包 ZIP。

**Architecture:** 保留现有 React/Express 应用与任务引擎，在问答侧加入逐轮条件合并，在生成器侧加入有事实依据的场景策略。图文以独立媒体服务负责服务器确定性 PNG 排版、来源与缓存、下载和 ZIP；工作台仅挂载独立组件。所有图文和导出接口重新执行门店授权与确定性事实核验。

**Tech Stack:** React 19、TypeScript、Vite、Express 5、Node 内置 test/assert、现有事实账本与 verifier；新增 sharp（真实 PNG 排版）及 fflate（ZIP），无 AI 图片服务调用。

---

## 基线、范围与授权

- 代码基线：`4967250f77b0983092713a79bcde284634745241`（origin/zhr4967250）。主工作树的其他 HEAD 不能替代本基线。
- 输入依据：项目根 `AGENTS.md`、`赛题要求总结.md`、`PRODUCT.md`、`docs/华采智营_重构执行规格.md`；复现依据：`D:/vibe/aix/_tmp/qa-evidence-4967250/REPORT.md`。
- 用户已经明确授权：允许 `app/server/refactor/generator.mjs` 与 `app/src/pages/Workbench.tsx` 两处最小接入，完成四项修复。前者仅接入场景策略和该策略所需的规则产物变化；后者仅挂载图片交付/导出组件和替换图片占位。
- `app/src/components/AppShell.tsx`、`app/src/index.css`、`app/server/refactor/tasks.mjs` 不修改；任务排队、恢复、重试与 SSE 引擎不修改。不创建 apps、第二套应用或设计系统。
- 19 个既有测试与 build 基线通过；全量 lint 有 18 处已记录的既有问题。实施需要区分新增问题与既有问题，不扩展任务修复不相关 lint。
- 固定保留五渠道与 3/3/1/1/3 候选。真实细节门槛、事实与合规硬阻断、原有渠道重试行为保留。
- 本轮完全不接 AI 图片服务；无 key 仍可官方图排版，界面与 manifest 明确 `official-layout`，不宣称 AI 成功。

## 文件归属与并行边界

| 负责人 | 新建文件 | 修改文件 | 职责 |
|---|---|---|---|
| 推荐开发 | `app/server/refactor/ask-slots.mjs`、`app/server/refactor/followup.mjs`、`app/src/lib/create-context.mjs`、对应 `.test.mjs` | `ask.mjs`、`ask.test.mjs`、`pages/Create.tsx`、`pages/Ask.tsx`、`lib/chat.ts` | 条件合并、筛选、型号接续；Create 与今日卡解耦 |
| 内容开发 | `app/server/refactor/scene-strategy.mjs`、`scene-strategy.test.mjs`、`generator-scenarios.test.mjs` | `app/server/refactor/generator.mjs` | 事实排序、标题、正文、分镜、配图策略 |
| 图文开发/集成 | `app/server/refactor/content-assets.mjs`、`image-compose.mjs`、`content-export.mjs`、各测试；`app/src/components/content/ImageDelivery.tsx`、`ExportDelivery.tsx` | `routes.mjs`、`lib/api.ts`、`pages/Workbench.tsx`、`app/package.json`、`app/package-lock.json` | 媒体存储、PNG、服务端 ZIP、接口与工作台最小接入 |
| 测试 | `app/server/refactor/workflow-http.test.mjs`；QA 证据文档 | 本计划中验收记录 | 自动回归与真实浏览器下载核验 |
| 发布 | 发布说明/必要部署说明 | 仅与本任务有关的说明文件 | 合并集成、检查、push、最终 PR |

三个开发任务可在接口锁定后并行。`routes.mjs` 与 `api.ts` 只由图文集成人员编辑；推荐开发提交独立 `followup.mjs`，集成者完成路由挂载。所有 Agent 完成后必须回复发起对话，简述结果、测试、commit 与未完成项。每个完成任务提交并推送 GitHub，不在开发中途发 PR；最后由发布负责人创建 PR。

## 共享契约

### 推荐与新建任务

`resolveAskSlots(messages)` 只读取 user 消息，顺序折叠，最新明确条件覆盖旧值。对外 slots 保持可序列化的标量，排除用途使用逗号分隔字符串，避免破坏现有 `Record<string,string|number|null>`。

```js
// app/server/refactor/ask-slots.mjs
export function resolveAskSlots(messages) {
  // Return contract; implementation is exercised in Task 1.
  return messages.reduce((slots, message) => message.role === 'user'
    ? mergeUserConditions(slots, String(message.content || '')) : slots,
    { budget: null, scenario: null, segment: null, os: null, excludedUses: '', preference: null });
}
// mergeUserConditions is a module-private function implemented in Task 1.
```

预算仍沿用快捷区间中点含义：4000–5000 => 4500。更新预算不得选中旧文本中的第一个数字；同一句“之前4500，现在9000元”取新的预算表述。用途按分句区分肯定与否定；“不剪视频不玩游戏”不成为创作者；“不做设计，但剪视频”保留剪视频。明确否定旧用途需要清除旧用途并回到已有其它肯定用途或继续追问。

筛选顺序：系统/兼容硬条件 => 具备依据的场景匹配 => 已知预算适配 => 用户偏好 => 截取最多两台。Windows/Linux共存型号注明 Windows 配置待按 SKU 确认；未核验软件不能承诺兼容。价格冲突/缺失 => `budgetFit:'unknown',overBy:null`；已知价超预算 => `budgetFit:'over'` 并明确超额；不得用15%容差将超预算表示为预算内。

`GET /api/products` 已返回全部真实产品与今日卡，Create 复用该接口。显式 `productId` 优先；不存在 => 显式错误、禁止创建；没有今日卡 => 使用所选产品的真实上下文，任务卡 ID 可省略；不退回首卡。没有 `productAsset` 时展示“缺少该型号已核验官方素材”，不显示其他型号的图片。

`POST /api/ask/to-content` 输出 `{prefill:{productId,budget,audience,scene,target,facts,realDetail}}`；无效型号返回400/`PRODUCT_NOT_FOUND`。仅传已确认细节，不自动将随意客户话语标记为销售确认。Ask 的现有 URL 路径也必须保留 `productId/scene/budget/audience/target`。

### 场景策略

```ts
type SceneStrategy = {
  key: 'media-import' | 'commute' | 'study-documents' | 'multitask' | 'general';
  problem: string;
  hook: string;
  orderedFactIds: string[];
  demoActions: string[];
  limitations: string[];
  imageBrief: string;
  nextAction: string;
  matchedSignals: string[];
};
// planScene({product, audience, scene, realDetail, target}) => SceneStrategy
```

具体动作与负担信号优先于人群标签。报告 B（创作者、通勤、肩膀酸、只改脚本）应该携带优先；报告 A（导卡和硬盘）应该接口优先。产品不自动替换，GT14通勤仍展示约1.49kg及取舍，不能夸成极轻。每个事实 ID 必须属于当前产品且不是冲突价格。

| key | 首要表达 | 事实顺序 | 可执行镜头 |
|---|---|---|---|
| media-import | 卡与硬盘同时用 | ports→performance/storage→screen | 展示SD卡、接硬盘、检查识别状态 |
| commute | 背包与随身负担 | portable→screen→必要ports | 装包拿取、展示官方重量口径、打开实际文档 |
| study-documents | 论文PPT与课堂连接 | screen→ports→portable | 开文档、接投影、核对软件与接口 |
| multitask | 项目工作集 | performance→storage→ports | 列软件/素材、打开真实项目、记录待核验项 |
| general | 先验证实际任务 | 按可用事实与明确限制 | 带常用文件到店逐项核对 |

三角度：pain展示阻碍后演示；avoidance按核对清单逐项验证；story按销售提供的任务动作顺序讲述。脚本与3–5镜头都变化，不只首3秒。五渠道引用同一策略，海报不能固定“32GB + SD卡槽”；图文叠字来自该候选的已核验标题/正文与策略。

### 图文 API、文件与导出

新增服务与任务引擎解耦，所有入口调用 `getTask(taskId, storeId)`；未知或跨门店404。只从任务当前候选和账本官方素材取数据，客户端不可传原始产品路径、任意图片URL或任意叠字。

```text
GET  /api/content/tasks/:id/assets
POST /api/content/tasks/:id/assets             body { variantId }
GET  /api/content/tasks/:id/assets/:assetId/download
POST /api/content/tasks/:id/export            body { selections: {xiaohongshu:id,moments:id,'wechat-mp':id,poster:id,video:id} }
```

POST assets验证当前候选ready及 `verifyContent(copyText, productId,{platform})`通过，再按当前 `imagePlan`逐张生成。返回201 `{assets:[...]}`；已有同指纹成功文件返回200复用；缺该型号素材返回422/`OFFICIAL_ASSET_MISSING`，保存unavailable状态，不创建伪PNG。导出包含五渠道各一份所选文案；某渠道尚无ready候选返回409/`CHANNEL_NOT_READY`；任一所选候选blocked返回409/`CONTENT_BLOCKED`，整包不返回可发布文件，不悄悄导出其它稿。

```ts
type ContentAsset = {
  id: string; taskId: string; variantId: string; productId: string; planIndex: number;
  status: 'planned'|'ready'|'failed'|'unavailable'; mode: 'official-layout';
  width: number; height: number; mimeType: 'image/png';
  sourceAsset: string; sourceIds: string[]; sourceTitle: string;
  contentHash: string; createdAt: string; downloadUrl?: string; error?: string;
};
```

`content-assets.mjs`独立存储于 `HC_RUNTIME_DIR`（或现有runtime默认目录）下 `content-assets/`，元数据JSON使用临时文件+rename，PNG以内部UUID命名；启动加载元数据，ready但文件缺失转failed。来源、文案、排版尺寸、门店配置、规则版本一起计算SHA256指纹；编辑后旧图不再匹配新版。下载时重新核验当前候选并检查指纹；旧图返回409/`ASSET_STALE`。GET列表不能暴露运行时磁盘路径。

PNG方案：sharp先生成纸色底，官方产品图用 `.resize({width,height,fit:'contain',background:...})`后composite，保持全貌、不拉伸、不裁切；中文由SVG确定性绘制，必须对 `& < > " '`逐项XML转义，按字符估宽换行并设定最大行数，不能任由文字溢出。省略正文可截断，条件/事实脚注不能截断掉限定条件；空间不足返回422/`LAYOUT_OVERFLOW`。服务器输出必须 `.png().toBuffer()`，不把SVG或JSON冒充PNG。官方素材路径只取账本asset并限制在 `app/public/media`；来源记录产品型号、知识库路径/官方引用，不把本地URL当完整来源。未找到真实来源则显示待确认，不能编造来源URL。

优先完全复用现有imagePlan尺寸：小红书1080×1440、朋友圈1080×1080、公众号封面900×383（正文以计划为准）、海报1242×1656、视频1080×1920。图片数量按候选计划，不询问固定张数。二维码、电话、地址仅来自门店配置，无配置则留白，补充提示只在界面显示。没有真实二维码就不创建像码的图形；不添加“限时到店”、活动日期、库存或优惠。

旧 `lib/imagegen.ts`只可借鉴纯绘字/换行思路，不直接复用成品模板：其drawCover裁切产品，海报含硬编码活动。旧 `server/images.mjs`提示词要求生成laptop，本轮不得调用。

导出服务器复核后读取最新选中稿与已生成且指纹匹配的PNG，用 `fflate.zipSync`生成 `application/zip`，Content-Disposition使用内部安全任务ID，不允许路径穿越。缺图不阻断已核验文字包，但manifest/README逐一列出missingImages，不能写“配图完成”。

```text
manifest.json
copy/xiaohongshu.txt
copy/moments.txt
copy/wechat-mp.txt
copy/poster.txt
copy/video.txt
images/<platform>/<variantId>-<index>.png
sources.json
README.txt
```

manifest包括任务/门店/型号、五渠道候选ID/角度/状态、事实与平台规则版本、generatedImages、missingImages、未解决冲突、生成时间、内容generationMode与图片mode。sources包含正文证据和图片真实来源。图文结果保留30天，按任务expiresAt拒绝过期读取；本轮不引入后台删除任务。PNG下载和ZIP下载均使用cookie授权，不走public静态目录。

## Task 1: 推荐上下文与问答

**Files:** 新建和修改文件见推荐开发归属；`followup.mjs`导出 `buildFollowupPrefill(body)`供集成者挂载现有路由。`create-context.mjs`导出 `resolveCreateContext({products,taskCards,productId,taskCardId,prefill})`，可由Node测试和Create共同引用；TS声明用同名 `.d.mts`定义返回值以保持build通过。

- [ ] **Step 1: 写预算更新与否定/系统筛选红测。** 在 `ask.test.mjs`追加真实顺序回归；添加 `ask-slots.test.mjs`覆盖逐轮保留、明确否定清除、混合肯定否定。

```js
test('latest budget and Windows survive follow-up', () => {
  const result = localAsk({messages:[
    {role:'user',content:'预算4500元，上课写论文，要Windows'},
    {role:'user',content:'现在预算提高到9000元，想轻一点'},
  ]});
  assert.equal(result.slots.budget,9000);
  assert.equal(result.slots.os,'windows');
  assert.ok(result.cards.every(c => !/鸿蒙|Pro S/.test(c.model)));
});
test('negative uses do not reverse a study request', () => {
  const result = localAsk({messages:[{role:'user',content:'预算6000元，上课写论文PPT，14英寸Windows，不剪视频不玩游戏'}]});
  assert.notEqual(result.slots.scenario,'剪视频');
  assert.notEqual(result.slots.segment,'创作者');
  assert.ok(result.cards.some(c=>c.id==='matebook-d-14'));
  assert.ok(result.cards.every(c=>c.budgetFit!=='within'||c.overBy===0));
});
```

- [ ] **Step 2: 运行红测。** `cd app`后 `node --test server/refactor/ask.test.mjs server/refactor/ask-slots.test.mjs`，现实现应因预算仍4500/无系统约束失败，记录失败断言而非宣称已修复。
- [ ] **Step 3: 实现纯条件合并及推荐。** 按共享契约逐轮解析，只在明确提及字段时覆盖；用途先拆分句与否定范围，再决定scenario/segment。预算可用原findBudget解析单轮明确预算片段；产品OS只从identity事实匹配。给AskCard增加budgetFit与nullable overBy；UI展示“价格待确认，预算适配未知”。
- [ ] **Step 4: 写接续红测。** `create-context.test.mjs`使用全部产品含D14、今日卡仅Pro S的fixture；断言显式D14保留、无效型号抛错、预算6000/scene上课保留。`followup.test.mjs`断言无效型号失败且未确认realDetail不升级确认。

```js
test('D14 without daily card keeps explicit identity', () => {
  const out = resolveCreateContext({
    products:[{id:'matebook-d-14',name:'HUAWEI MateBook D 14 2024',asset:null}],
    taskCards:[{id:'light',productId:'matebook-pro-s'}],
    productId:'matebook-d-14',taskCardId:'',
    prefill:{budget:'6000',scene:'上课',audience:'学生',target:'私聊问配置'},
  });
  assert.equal(out.productId,'matebook-d-14');
  assert.equal(out.budget,'6000');
  assert.equal(out.productAsset,null);
});
```

- [ ] **Step 5: 实现Create接续并绿测。** 使用api.products；有显式ID不fallback。展示与提交统一取resolved productId；无素材使用文字缺图状态。保持真实细节硬门槛。执行 `node --test server/refactor/ask*.test.mjs server/refactor/followup.test.mjs src/lib/create-context.test.mjs`，预期全部PASS；执行 `npm run build`预期通过。
- [ ] **Step 6: 提交并推送独立推荐变更。** 用本任务精确文件 `git add`，`git commit -m "fix: preserve recommendation context and latest customer constraints"`；`git push`，回复发起对话结果与未完成项。

## Task 2: 按场景改变规则内容

**Files:** `scene-strategy.mjs`、`scene-strategy.test.mjs`、`generator-scenarios.test.mjs`；修改 `generator.mjs`，不修改 `tasks.mjs`。

- [ ] **Step 1: 写报告A/C对照红测。** 使用真实账本GT14，固定人群与目标，分别提供导卡场景和通勤场景；覆盖所有五渠道，视频三角度镜头动作差异。

```js
import {getProduct} from './ledger.mjs';
import {generatePlatformVariants} from './generator.mjs';
test('same GT14 gets different evidence and shots by actual work',()=>{
  const base={product:getProduct('matebook-gt-14'),audience:'创作者',target:'私聊问配置'};
  const a=generatePlatformVariants({...base,platform:'video',scene:'剪视频 / 整理素材',realDetail:'每天拍完课程要从相机导入素材，SD卡和移动硬盘经常一起插。'});
  const c=generatePlatformVariants({...base,platform:'video',scene:'通勤 / 轻办公',realDetail:'每周背电脑坐地铁两小时，肩膀酸，只在咖啡店改课程脚本。'});
  assert.notDeepEqual(a[0].shotList,c[0].shotList);
  assert.match(a[0].shotList.join(' '),/SD|导卡|硬盘/);
  assert.match(c[0].shotList.join(' '),/背包|装包|拿取|重量/);
  assert.notDeepEqual(a[0].shotList,a[1].shotList);
  assert.notDeepEqual(a[1].shotList,a[2].shotList);
});
```

- [ ] **Step 2: 运行红测。** `node --test server/refactor/generator-scenarios.test.mjs`，预期旧版相同shotList触发FAIL。
- [ ] **Step 3: 实现场景策略。** 按共享契约和信号表生成策略，保留matchedSignals便于解释；使用产品事实ID而非为不同人群另写事实。无匹配信号使用general并明确待验证动作；缺事实不填入自造数字。
- [ ] **Step 4: 接入五渠道。** `generatePlatformVariants`计算一次strategy，传入各variant生成函数；标题/海报、卖点事实顺序、CTA与分镜从strategy取。保留当前平台字段、长度与候选数量；imagePlan带当前variant叠字与场景brief。三视频角度使用不同动作序列；不得虚构性能测量结果。
- [ ] **Step 5: 绿测与核验。** `node --test server/refactor/scene-strategy.test.mjs server/refactor/generator-scenarios.test.mjs`预期PASS。新测对全部11稿调用 `verifyContent`，确认无新增blocked；未知数字、虚假赠品仍blocked。增加相同产品不同scene、相同scene不同detail及纯否定信号对照，确认不是替换字符串产生的假差异。
- [ ] **Step 6: 提交并推送。** `git commit -m "feat: adapt rule content and video demonstrations to customer scenes"`；`git push`；回复发起对话含A/C差异证据与未完成项。

## Task 3: 官方图PNG、单图与ZIP交付

**Files:** 图文开发/集成归属全部文件。`routes.mjs`集成Task1的buildFollowupPrefill；现有任务GET返回值用 `{...snapshot,assets:listTaskAssets(...)}`补充，不改snapshot生成函数或任务引擎。

- [ ] **Step 1: 安装最小依赖。** 在 `app`执行 `npm install sharp fflate`；安装失败先记录平台原因，不用假PNG替代。锁文件随本任务提交。
- [ ] **Step 2: 写PNG与ZIP红测。** 新建 `image-compose.test.mjs`和`content-export.test.mjs`，使用node test、sharp metadata和fflate unzipSync；固定已核验测试输入，不调用网络AI。

```js
test('composer emits PNG bytes of the planned dimensions',async()=>{
  const png=await composeOfficialImage({
    productAssetPath:fixtureProductPath,
    width:1242,height:1656,title:'导卡 & 外接 <先核对>',
    lines:['接口以实际SKU为准'],footnotes:['销售提供场景；不代表实测结果'],
    storeProfile:{},
  });
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const meta=await sharp(png).metadata();
  assert.equal(meta.width,1242); assert.equal(meta.height,1656);
});
test('ZIP contains five selected copy files and actual generated PNG',()=>{
  const bytes=buildExportArchive(verifiedFixture);
  const files=unzipSync(bytes);
  for(const p of ['xiaohongshu','moments','wechat-mp','poster','video'])
    assert.ok(files[`copy/${p}.txt`]);
  assert.ok(files['manifest.json']); assert.ok(files['sources.json']);
  const path=Object.keys(files).find(p=>p.endsWith('.png'));
  assert.ok(path); assert.equal(Buffer.from(files[path]).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
```

测试fixture由测试代码用sharp生成有清晰边框的横向产品块，fixtureProductPath存于`mkdtemp`目录；verifiedFixture含五个ready选中稿、来源、一个真实PNG及一项missingImages。测试结束只清理明确的该临时目录。合成函数、归档函数签名在测试中固定：`composeOfficialImage(input)=>Promise<Buffer>`；`buildExportArchive({manifest,copies,images,sources,readme})=>Uint8Array`，其中copies为平台到字符串映射，images为 `{path,bytes}`数组。

- [ ] **Step 3: 运行红测。** `node --test server/refactor/image-compose.test.mjs server/refactor/content-export.test.mjs`，预期模块未实现FAIL；保留该红测证据。
- [ ] **Step 4: 实现PNG纯函数与独立媒体存储。** 按共享契约实现composeOfficialImage、XML escape、contain产品、文本行数与限定条件检查。`content-assets.mjs`导出 `listTaskAssets(task,store)`、`generateVariantAssets(task,variantId,store)`、`readAssetDownload(task,assetId,store)`；函数统一检查storeId、候选核验与指纹。真实图片失败返回明确failed状态及可重试错误；先写PNG，再原子写ready元数据，不能先标成功。sharp在Windows与部署平台须验证PNG中文字形，缺中文字体则记录部署需求并配置真实字体，不用乱码交付。
- [ ] **Step 5: 实现导出纯函数与服务。** `exportTaskPackage(task,selections,store)=>Promise<Buffer>`验证五渠道各一当前候选、调用verifyContent、收集最新PNG/source/manifest并构造ZIP。任一blocked硬阻断；缺图列manifest但文字可导出。内存限制单张不超过4096×4096且计划数量不超过20，避免被客户端任意尺寸放大；所有尺寸取服务端计划。
- [ ] **Step 6: 路由与HTTP红绿回归。** 新建 `workflow-http.test.mjs`，使用现有app导出与临时监听端口、demo cookie；创建真实任务并等done。POST海报assets => PNG下载200、Content-Type image/png与文件签名正确；GET任务快照assets非空；重启媒体模块后列表恢复；D14无素材422但文字ready；更新候选为伪造4999元/49kg/赠汽车 =>生成/旧图下载/ZIP全部409；别门店404；传`../`assetId不可访问文件；旧图在编辑后409 stale；五渠道ZIP解包逐项验证内容和尺寸；无FAL_KEY时不发生任何fal网络调用。
- [ ] **Step 7: 执行绿测。** `node --test server/refactor/image-compose.test.mjs server/refactor/content-assets.test.mjs server/refactor/content-export.test.mjs server/refactor/workflow-http.test.mjs`，预期全部PASS。边框fixture四角应仍可见，证明contain未裁切；加入`&<>\"'`、长中文与缺源图用例。
- [ ] **Step 8: 工作台最小接入。** ImageDelivery独立负责load/generate/error/retry/preview/download；ExportDelivery持有五渠道selections，默认每渠道当前recommended/selected候选，用户可用现有角度选择；工作台现有选稿切换同步该选择，不能让导出悄悄回默认角度。新增组件复用现有按钮/状态/抽屉类，桌面与手机都能访问。下载用fetch读取Blob，PNG可单图下载；ZIP优先 `navigator.canShare({files})` 后share，否则点击下载objectURL，最后revokeObjectURL。用户取消share无需报生成失败；分享不支持/失败保留明确下载入口。
- [ ] **Step 9: 构建、范围检查与真实浏览器验收。** 在app执行 `node --test server/refactor/*.test.mjs`、`npm run build`。对修改TS文件单独eslint，预期无新增问题；全量lint与18处基线对比。`git diff --name-only 4967250`确认AppShell/index.css/tasks.mjs零差异。浏览器390×844和1440宽各验证五渠道、配图按钮、图片显示、单图实际下载、整包实际下载解包、选稿一致、刷新恢复；截图与下载字节证据分开记录，未读剪贴板不能宣称已验证剪贴板内容。
- [ ] **Step 10: 提交并推送图文交付。** `git commit -m "feat: deliver verified official product PNGs and channel ZIP exports"`；`git push`；回复发起对话列真实下载结果与未完成项。由发布Agent集成Task1/2，完整回归后创建最终PR；不得宣称真实LLM/AI图片服务已验证。

## 最终验收与发布门槛

- [ ] D14 URL→新建显示→提交productId→任务详情→刷新始终同一型号，预算场景保留；无素材不借图。
- [ ] 预算4500→9000→轻一点保持9000；否定用途不触发错误场景；Windows排除鸿蒙；未知价格不表示预算内。
- [ ] 报告A/C替换scene/detail后不再11/11完全相同；标题、卖点顺序、海报与视频动作有实际差异；三角度视频主体有差异。
- [ ] PNG真实字节、正确尺寸、中文可读、产品完整；单图与ZIP可下载并打开；五渠道所选文案、PNG、sources、manifest一致；缺图透明。
- [ ] 客户端隐藏按钮之外，服务器生成/下载/ZIP仍阻断blocked；跨门店不可访问；编辑后旧图无效；刷新能恢复。
- [ ] 19个原测试保持通过，新增测试通过，build通过，无新增lint问题；禁止文件无差异。
- [ ] 只保留本轮开发插件和最新发布版本，不删除无关用户改动；代码、锁文件、测试、必要说明都推送GitHub；发布Agent报告commit、PR链接与验证边界。

## 计划自审记录

已覆盖报告四项及受保护文件授权边界；未重构应用壳、全局样式、任务引擎。图文选择服务端sharp是为了把真实PNG字节、核验、刷新和ZIP闭环放在同一可信出口，代价为新增原生图片依赖；必须在部署平台验证安装和中文字体。当前无可用真实服务key，因此本轮验收仅覆盖规则内容与官方图排版，不将其描述为真实LLM/AI背景效果。开发采用已经授权的SDLC多Agent方式，不再次要求用户选择执行方式。

## 最终实施与验收状态（2026-10-22）

以下以代码383ed63的实际实现为准，覆盖上方各步骤；原始步骤保留为设计历史，不将未保留的红测运行证据补写为已执行。最终证据见 [整体验收记录](../../workflow-quality-validation.md)。

|原计划项目|最终状态与对应实现|
|---|---|
|Task1步骤1–5|DONE：预算/用途/OS条件与真实型号接续已完成并回归；CHANGED：使用 `ask-slots.mjs`、`create-selection.ts`，实际测试为 `ask.test.mjs`、`create-selection.test.mjs`、`create-flow.test.mjs`，不创建计划示意的create-context/followup模块。接续复用现有带参数URL，不新增to-content端点。历史独立红测步骤不追认。|
|Task1步骤6|DONE：独立开发提交与集成checkpoint已推送GitHub。|
|Task2步骤1–5|DONE：scene-strategy接入五渠道，A/C各11稿实际差异、三角度动作及所有型号事实归属通过；所有导卡角度保留连接→识别→目录依赖。CHANGED：按实际generator-scenarios/scene-strategy测试组织，历史红测不追认。|
|Task2步骤6|DONE：开发提交已集成，随最终发布分支上传。|
|Task3步骤1–7|DONE：sharp/fflate/fontkit、真实PNG/ZIP、完整媒体核验、授权、指纹、持久化与清理均完成。CHANGED：模块实际接口为composeImage/createAssetRepository/exportContent；回归拆为content-assets、content-delivery-http、content-media-lifecycle、content-plan-images、image-compose等测试，无计划中的独立content-export/workflow-http测试文件。运行目录实际为content-media。红测历史不追认。|
|Task3步骤8|DONE：独立ImageDelivery/ExportDelivery及Workbench最小接入，选稿同步与自动回退通过。CHANGED：浏览器验证下载fallback，未验证原生share/取消；分享能力不超出实际实现声明。|
|Task3步骤9|DONE：75/75、build、7个TS/TSX的lint、保护文件零diff；手机/桌面实际PNG与ZIP下载、打开、解包、非默认选稿及刷新通过。全量lint保留18个既有错误。|
|Task3步骤10|DONE：代码已提交；发布阶段提交必要说明、push并创建feat/workflow-quality→zhr PR，不合并。|
|最终验收1–3|DONE：D14身份与预算场景、逐轮预算/否定/Windows约束、场景内容与动作差异均已自动及独立浏览器/HTTP验证。|
|最终验收4–5|DONE：真实PNG/ZIP、所选稿和来源一致、缺图透明；服务器核验/权限/失效及刷新恢复通过。CHANGED：合法edit旧图HTTP409有可读error但无ASSET_STALE字段；视频长标题可省略尾部，CTA/限定条件完整。|
|最终验收6–7|DONE：原基线测试保留、最终75项通过，禁止文件零差异；Git管理代码、锁文件、测试及必要说明。发布PR与远端SHA由发布结果确认，不删除无关用户工作。|

PNG实际渲染逐计划overlay及当前稿正文/CTA，来源记录renderedText，规则版本official-layout-v4。Windows中文字形已验证；Linux字体、真实LLM/外部AI图片与生产部署不在已验证范围。事实来源政策与既定版本架构未改。
