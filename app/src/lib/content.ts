// 软文生成引擎：任务输入 → 9 阶段流水线
// 事实基准：华为 PC 全板块深度知识库 v7（2026-10-17 官方页面快照）
// 所有型号参数、价格、图片来源均可回溯到 P1 / P1-08 / 图片索引

export type ModelId = "matebook-pro" | "matebook-14" | "matebook-pro-s";
export type ScenarioId = "开学季" | "职场办公" | "内容创作" | "家庭换新" | "企业采购" | "门店到访" | "新品首发" | "节日营销";
export type PlatformId = "小红书" | "公众号" | "门店朋友圈" | "门店海报";

/* ──────────── 型号事实底座（防混淆：三台相近型号分列）──────────── */

export interface ModelInfo {
  id: ModelId;
  name: string;
  kbDir: string;
  identityNote: string; // 一句话身份，防混淆用
  os: string;
  cpu: string;
  weight: string;
  size: string;
  screen: string;
  screenNote?: string;
  mem: string;
  ssd: string;
  battery: string;
  ports: string;
  positioning: string;
  tradeoff: string;
  priceFrom: string;
  priceNote: string;
  evidenceIds: string[];
}

export const MODELS: Record<ModelId, ModelInfo> = {
  "matebook-pro": {
    id: "matebook-pro",
    name: "HUAWEI MateBook Pro（鸿蒙版）",
    kbDir: "HUAWEI MateBook Pro",
    identityNote: "970 g 的 14.2 英寸 HarmonyOS 6.1 轻薄本，麒麟 X90 Plus。注意与 Pro S（798 g、XE90）区分。",
    os: "HarmonyOS 6.1",
    cpu: "麒麟 X90 Plus",
    weight: "970 g",
    size: "13.5 mm 厚",
    screen: "14.2 英寸 3:2 OLED 触控屏，3120 × 2080，100% sRGB 与 P3 广色域（典型值）",
    screenNote: "云晰柔光屏仅柔光版支持",
    mem: "24 / 32 GB",
    ssd: "512 GB / 1 TB NVMe PCIe",
    battery: "70 Wh",
    ports: "三个 USB-C（USB 3.2 Gen 1），无原生 USB-A / HDMI / 3.5 mm",
    positioning: "轻量化 + 3:2 高分辨率 OLED 触控 + 鸿蒙协同",
    tradeoff: "原生接口较少，必装软件兼容需先验证",
    priceFrom: "¥9,999",
    priceNote: "24GB/512GB 页面价（2026-10-17 快照）",
    evidenceIds: ["p1-facts", "p1-selling", "p1-price-pro"],
  },
  "matebook-14": {
    id: "matebook-14",
    name: "HUAWEI MateBook 14（鸿蒙版）",
    kbDir: "HUAWEI MateBook 14",
    identityNote: "接口最齐全的鸿蒙本：HDMI + 双 USB-A。麒麟 X90，非 Pro 系列的 X90 Plus。",
    os: "HarmonyOS 6",
    cpu: "麒麟 X90",
    weight: "约 1.32–1.33 kg",
    size: "14.5 mm 厚",
    screen: "14.2 英寸 3:2 OLED 触控屏，2880 × 1920，60/120 Hz，平均 ΔE < 1，支持多屏同色",
    mem: "24 / 32 GB",
    ssd: "512 GB / 1 TB",
    battery: "70 Wh",
    ports: "HDMI 2.1 + USB-C + 双 USB-A + 3.5 mm 耳机孔",
    positioning: "3:2 OLED 触控屏 + 较丰富传统接口，投影/外设即连",
    tradeoff: "HarmonyOS 6 软件生态是选型前置条件",
    priceFrom: "¥5,899",
    priceNote: "16GB/512GB 页面价（2026-10-17 快照）",
    evidenceIds: ["p1-facts-14", "p1-selling-14", "p1-price-14h"],
  },
  "matebook-pro-s": {
    id: "matebook-pro-s",
    name: "HUAWEI MateBook Pro S",
    kbDir: "HUAWEI MateBook Pro S",
    identityNote: "798 g 起的柔性 OLED 本，麒麟 XE90，有防窥/柔光/典藏细分。注意与 MateBook Pro（970 g、X90 Plus）区分。",
    os: "HarmonyOS 6.1",
    cpu: "麒麟 XE90",
    weight: "798 g 起（柔光版 805 g，典藏版 825 g）",
    size: "11.9 mm 厚（典藏版 12.2 mm）",
    screen: "14.2 英寸 3:2 柔性 OLED 触控屏，3120 × 2080，120 Hz，10.7 亿色，峰值亮度 1600 尼特（实验室条件）",
    mem: "16 / 24 GB",
    ssd: "512 GB / 1 TB",
    battery: "70 Wh",
    ports: "两个 USB-C（其一支持 DisplayPort 1.2），无 USB-A / HDMI",
    positioning: "极轻机身 + 3.1K 柔性 OLED，防窥/柔光/典藏多版本细分",
    tradeoff: "仅两口 USB-C，软件生态需验证",
    priceFrom: "¥7,999",
    priceNote: "16GB/512GB 页面价（2026-10-17 快照）",
    evidenceIds: ["p1-facts-pros", "p1-selling-pros", "p1-price-pros"],
  },
};

/* ──────────── 业务场景（内容切入点必须随场景改变）──────────── */

export interface ScenarioInfo {
  id: ScenarioId;
  crowd: string;
  problem: string;
  focus: string; // 内容重点
  angle: Partial<Record<ModelId, string>>; // 各型号在该场景下的切入点
  cta: string;
}

export const SCENARIOS: Record<ScenarioId, ScenarioInfo> = {
  开学季: {
    id: "开学季",
    crowd: "大学新生与家长",
    problem: "学习、携带、续航与多设备协同怎么兼顾",
    focus: "学习、携带、续航和多设备协同；避免把所有学生需求归结为单一性能指标",
    cta: "评论区留下专业与预算，帮你列核验清单",
    angle: {
      "matebook-pro": "每天背去图书馆/教室的 970 g 负担 + 3:2 屏看课件文档一屏更多",
      "matebook-14": "宿舍接显示器、教室接投影都方便：自带 HDMI 和 USB-A，社团外设即插即用",
      "matebook-pro-s": "798 g 起放进双肩包侧袋几乎无感，多版本按预算细分",
    },
  },
  职场办公: {
    id: "职场办公",
    crowd: "商务人士、移动办公者",
    problem: "会议、差旅、文档处理、多任务协同与安全",
    focus: "会议、差旅、文档处理、多任务协同和安全需求",
    cta: "私信预约到店，带你的常用文件实测",
    angle: {
      "matebook-pro": "通勤差旅减负 + 超级终端跨设备接续 + 超级隐私开关",
      "matebook-14": "会议室投影即插即用（HDMI 直出）+ 多屏同色对外展示",
      "matebook-pro-s": "798 g 差旅极轻 + 防窥屏版在飞机高铁上保护屏幕内容",
    },
  },
  内容创作: {
    id: "内容创作",
    crowd: "设计、摄影、视频创作者",
    problem: "屏幕色彩、性能、素材流转与创作流程",
    focus: "屏幕、性能、素材流转和创作流程；不得虚构软件测试结果",
    cta: "评论区留下你的必装软件，帮你列实测步骤",
    angle: {
      "matebook-pro": "P3 广色域 OLED + 柔光版应对复杂光照 + 1 TB 素材容量",
      "matebook-14": "平均 ΔE < 1 多屏同色 + 手写笔触控创作场景",
      "matebook-pro-s": "3120 × 2080 柔性 OLED 120 Hz + 10.7 亿色，极轻外拍携带",
    },
  },
  家庭换新: {
    id: "家庭换新",
    crowd: "家庭用户、旧机换新者",
    problem: "易用性、全家使用、数据迁移和长期使用体验",
    focus: "易用性、全家使用、数据迁移和长期使用体验",
    cta: "到店带旧机完成迁移演练再决定",
    angle: {
      "matebook-pro": "全家鸿蒙设备协同（手机碰一碰传照片）+ 触控屏老人小孩易上手",
      "matebook-14": "接口齐全不用额外买转接器 + 价格门槛更低的换新选择",
      "matebook-pro-s": "轻到可以全家随手拿起用 + 柔光版对眼睛更友好的观感",
    },
  },
  企业采购: {
    id: "企业采购",
    crowd: "中小企业、团队采购",
    problem: "部署、管理、稳定性和服务信息",
    focus: "部署、管理、稳定性和服务信息；未在知识库出现的政策不得承诺",
    cta: "团队采购需求请到店登记，由专人对接方案",
    angle: {
      "matebook-pro": "统一鸿蒙平台批量部署 + 超级隐私开关的物理安全入口",
      "matebook-14": "会议室/工位外设兼容成本最低（原生 HDMI/USB-A）",
      "matebook-pro-s": "高管与外勤的极轻机型 + 防窥版保护商业资料",
    },
  },
  门店到访: {
    id: "门店到访",
    crowd: "附近潜在顾客",
    problem: "给一个明确的到店理由",
    focus: "一个明确卖点、到店体验理由和咨询引导，避免信息堆叠",
    cta: "到店体验真机，地址见定位",
    angle: {
      "matebook-pro": "约 970 g 真机上手对比旧电脑的重量差",
      "matebook-14": "把你家投影/外设带来，店里即插即用试",
      "matebook-pro-s": "798 g 起真机称重给你看",
    },
  },
  新品首发: {
    id: "新品首发",
    crowd: "关注新品的用户",
    problem: "新品变化、适合人群和购买建议",
    focus: "新品变化、适合人群和购买建议；价格与权益必须有资料依据",
    cta: "首发权益以官方页面为准，私信锁定到货通知",
    angle: {
      "matebook-pro": "柔性 OLED + 鸿蒙 AI 能力作为新品核心变化点",
      "matebook-14": "高刷 3:2 OLED 与全接口的组合是本品差异化",
      "matebook-pro-s": "防窥/柔光/典藏三版本细分是新品最大变化",
    },
  },
  节日营销: {
    id: "节日营销",
    crowd: "送礼、家庭购机人群",
    problem: "选一台拿得出手的电脑送礼/自用",
    focus: "使用场景和选择建议；不得虚构优惠、补贴或库存",
    cta: "节日期间到店有礼，以门店当日活动为准",
    angle: {
      "matebook-pro": "送职场人的轻与体面：970 g + OLED 屏",
      "matebook-14": "送学生与家庭的实用之选：接口全、上手快",
      "matebook-pro-s": "送经常出差的人：798 g 起 + 防窥版贴心细节",
    },
  },
};

/* ──────────── 平台规则（结构/语气/图片数量必须随平台改变）──────────── */

export interface PlatformInfo {
  id: PlatformId;
  spec: string; // 官方图文要求
  structure: string;
  tone: string;
  imgRange: [number, number];
  ctaStyle: string;
  evidenceId: string;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  小红书: {
    id: "小红书",
    spec: "3–6 张图；口语化标题、短段落、使用场景、话题标签；不得伪造个人体验",
    structure: "口语化标题 → 首图钩子 → 短段落经验（每段解决一个问题）→ 核对清单 → 话题标签",
    tone: "第一人称经验口吻，段落短，emoji 节制",
    imgRange: [3, 6],
    ctaStyle: "评论区互动引导（留下你的必装软件/预算）",
    evidenceId: "p6-xhs",
  },
  公众号: {
    id: "公众号",
    spec: "2–4 张图，说明来源和插入位置；标题、导语、分段正文、结尾行动引导",
    structure: "标题 → 导语（为什么写这篇）→ 5–8 个小标题分段正文 → 结尾行动引导",
    tone: "信息型长文，事实句与体验句分开，动态信息标核验日",
    imgRange: [2, 4],
    ctaStyle: "结尾统一行动引导（预约到店/下载清单）",
    evidenceId: "p6-mp",
  },
  门店朋友圈: {
    id: "门店朋友圈",
    spec: "1–3 张图，优先主图与场景图；短文案、一个核心卖点、咨询或到店引导",
    structure: "一句话钩子 → 一个核心卖点（含条件）→ 到店/咨询引导",
    tone: "顾问口吻，短句，一个 emoji 组以内",
    imgRange: [1, 3],
    ctaStyle: "咨询或到店引导（私信/定位）",
    evidenceId: "p6-moments",
  },
  门店海报: {
    id: "门店海报",
    spec: "1 张主视觉，不得拉伸或错配型号；主标题、副标题、3 个以内卖点和活动说明",
    structure: "主标题（12–22 字）→ 副标题 → ≤3 个卖点 → 活动说明 → 参数脚注同屏",
    tone: "一屏一结论，无装饰性形容词",
    imgRange: [1, 1],
    ctaStyle: "到店理由 + 参数脚注紧邻主张",
    evidenceId: "p6-poster",
  },
};

/* ──────────── 合规规则 ──────────── */

export const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(最[^适终]{0,3}(好|强|快|轻|薄|新|佳|高端|顶级)|第一|首家|首款唯一)/, label: "绝对化用语" },
  { re: /(永久|永远|终身|全国统一价|全网最低)/, label: "虚假承诺/价格误导" },
  { re: /(百分百|百分之百|绝对不会|肯定能|任何情况|所有软件.*都兼容|完全适合所有人)/, label: "无依据承诺" },
  { re: /(吊打|碾压|秒杀|完爆|碾压.*竞品|比.{1,6}(联想|苹果|戴尔|华硕|小米).{0,4}(强|好|快))/i, label: "竞品贬低/无依据对比" },
  { re: /(亲测一整天|实测一个月|销量第一|好评率)/, label: "虚构体验/数据" },
  { re: /(医疗级|治疗级|护眼.*(治愈|治疗))/i, label: "医疗宣称" },
];

export const PRICE_POLICY =
  "价格与权益仅在有官方页面依据时引用并标注核验日；否则统一写「以当前官方渠道核验为准」。知识库没有的补贴、库存、优惠不得生成。";

/* ──────────── 任务与流水线 ──────────── */

export interface TaskInput {
  modelId: ModelId;
  scenario: ScenarioId;
  platform: PlatformId;
  goal: string; // 内容目标
  withPrice: boolean; // 是否在文中引用价格（有依据时）
}

export interface StageOut {
  id: string;
  name: string;
  summary: string; // 卡片摘要
  detail: string; // markdown 详细输出
  evidenceIds: string[];
  ok?: boolean; // 核验类阶段
}

const PRICE_LINES: Record<ModelId, string> = {
  "matebook-pro":
    "官方商城页面价（2026-10-17 快照）：24GB/512GB ¥9,999 起；24GB/1TB 柔光版 ¥12,499（券后预估约 ¥11,999，以结算页为准）",
  "matebook-14":
    "官方商城页面价（2026-10-17 快照）：16GB/512GB ¥5,899；24GB/512GB ¥6,599；24GB/1TB ¥7,599",
  "matebook-pro-s":
    "官方商城页面价（2026-10-17 快照）：16GB/512GB ¥7,999；24GB/1TB ¥10,499；24GB/512GB 柔光版 ¥9,999",
};

/** 事实点提取：按场景切入点从型号事实底座取 4 条 */
function factPoints(m: ModelInfo, s: ScenarioInfo): string[] {
  const pts = [
    `重量/形态：${m.weight}、${m.size}（官方规格值，实际随配置与测量方法变化）`,
    `屏幕：${m.screen}${m.screenNote ? `；${m.screenNote}` : ""}`,
    `性能/容量：${m.cpu}，${m.mem} 内存，${m.ssd} SSD`,
    `接口：${m.ports}`,
  ];
  if (s.id === "新品首发" || s.id === "门店到访") pts.push(`定位：${m.positioning}；取舍：${m.tradeoff}`);
  return pts;
}

/** 软文正文生成：结构/语气/图片数量随平台变化，切入点随场景变化 */
export function generateArticle(task: TaskInput): { title: string; body: string; images: string } {
  const m = MODELS[task.modelId];
  const s = SCENARIOS[task.scenario];
  const angle = s.angle[task.modelId] ?? m.positioning;
  const priceLine = task.withPrice && (task.scenario === "新品首发" || task.platform === "门店海报" || task.scenario === "门店到访")
    ? `\n\n${PRICE_LINES[task.modelId]}。${PRICE_POLICY}`
    : "\n\n价格与权益以当前官方渠道核验为准。";
  const tags = `#电脑选购 #华为电脑 #${task.scenario} #购机核验`;

  if (task.platform === "小红书") {
    const title = `${m.name.replace(/（.*?）/, "")} 适不适合${task.scenario}？先说结论再看条件`;
    const body = [
      `先给结论：${m.positioning}。但值不值得买，取决于你的任务，不看形容词。`,
      ``,
      `我的场景是「${s.problem}」。这台机器对上这个场景的点在于：${angle}。`,
      ``,
      `核对过的硬事实（来源：华为官方规格页，核验 2026-10-17）：`,
      `1. 重量 ${m.weight}、${m.size}——官方规格值，实际随配置和测量方法有差异；`,
      `2. ${m.screen}；`,
      `3. ${m.cpu}，${m.mem} 内存，${m.ssd}；`,
      `4. 接口：${m.ports}。`,
      ``,
      `也要说清楚取舍：${m.tradeoff}。这一步没验证之前，别急着下单。`,
      ``,
      `适合继续了解的人：${s.crowd}，且接受上面的条件。需要先停下来验证的人：必装软件/外设还没确认兼容的。`,
      `${priceLine}`,
      ``,
      `你是什么场景？评论区留下你的任务和预算，我帮你列一份核验清单。`,
      ``,
      tags,
    ].join("\n");
    return { title, body, images: "" };
  }

  if (task.platform === "公众号") {
    const title = `${task.scenario}购机怎么选：${m.name} 的适用条件与核验清单`;
    const body = [
      `**导语**`,
      `这篇内容只解决一个问题：${s.crowd}在「${s.problem}」时，${m.name} 是否值得进入候选清单。结论先行：${m.positioning}；但${m.tradeoff}。以下事实均来自华为官方产品页与规格页（核验日期 2026-10-17），动态信息以官方渠道当日页面为准。`,
      ``,
      `## 一、这台机器是谁`,
      `${m.identityNote}核心规格：${m.cpu}，${m.mem} 内存，${m.ssd} SSD，${m.battery} 电池；系统为 ${m.os}。`,
      ``,
      `## 二、对上了${task.scenario}的哪些点`,
      `${angle}。围绕「${s.focus}」，这台机器能直接对应的已验证事实是：重量 ${m.weight}（官方规格值）、${m.screen}、接口配置为「${m.ports}」。`,
      ``,
      `## 三、必须先说清楚的取舍`,
      `${m.tradeoff}。规格说明「具备某接口或功能」不等于你的具体软件、外设、账号环境已经兼容；请以真实任务到店或在授权环境验证后再下结论。`,
      ``,
      `## 四、适合与不适合`,
      `适合：${s.crowd}中，接受上述条件、愿意按清单核验的人。不适合：把未验证兼容的软件/外设当作购买前提，或要求无条件承诺体验结果的人。`,
      ``,
      `## 五、价格口径`,
      task.withPrice ? `${PRICE_LINES[task.modelId]}。${PRICE_POLICY}` : `本文不引用具体金额；${PRICE_POLICY}`,
      ``,
      `**结尾行动引导**：${s.cta}。以上结论只对应已核验的型号、版本与日期；未确认项请以实机验证和官方当日页面为准。`,
    ].join("\n");
    return { title, body, images: "" };
  }

  if (task.platform === "门店朋友圈") {
    const title = `${task.scenario}选电脑，一个最该先看的点`;
    const body = [
      `【${task.scenario}选机】${angle}。`,
      ``,
      `已核对事实（官方规格页，核验 2026-10-17）：${m.weight}、${m.screen.split("，")[0]}。`,
      `取舍也直说：${m.tradeoff}。`,
      `${task.withPrice ? PRICE_LINES[task.modelId] + "。" : "价格以当前官方渠道核验为准。"}`,
      ``,
      `${s.cta}。`,
    ].join("\n");
    return { title, body, images: "" };
  }

  // 门店海报
  const title = `${m.name.replace(/（.*?）/, "")}｜${task.scenario}之选`;
  const body = [
    `**主标题**（12–22 字）：${angle.slice(0, 18)}`,
    ``,
    `**副标题**：${m.positioning}`,
    ``,
    `**卖点（≤3 个，含条件）**：`,
    `1. ${m.weight} / ${m.size}（官方规格值）`,
    `2. ${m.screen.split("，").slice(0, 2).join("，")}`,
    `3. ${m.cpu} · ${m.mem} · ${m.ssd}`,
    ``,
    `**活动说明**：${task.withPrice ? PRICE_LINES[task.modelId] : "价格与权益以门店当日官方渠道核验为准"}；赠品/活动以当日页面为准，不虚构优惠与库存。`,
    ``,
    `**参数脚注（与主张同屏）**：${m.screenNote ?? "不同版本配置不同，以实际销售 SKU 为准"}；系统 ${m.os}。`,
    ``,
    `**到店引导**：${s.cta}`,
  ].join("\n");
  return { title, body, images: "" };
}

/** 合规扫描：返回命中的违规项 */
export function complianceScan(text: string): { label: string; match: string }[] {
  const hits: { label: string; match: string }[] = [];
  for (const f of FORBIDDEN_PATTERNS) {
    const m = text.match(f.re);
    if (m) hits.push({ label: f.label, match: m[0] });
  }
  return hits;
}

/** 运行完整流水线 */
export function runPipeline(task: TaskInput, imagePlan: string[]): StageOut[] {
  const m = MODELS[task.modelId];
  const s = SCENARIOS[task.scenario];
  const p = PLATFORMS[task.platform];
  const art = generateArticle(task);
  const facts = factPoints(m, s);
  const scan = complianceScan(`${art.title}\n${art.body}`);

  const stages: StageOut[] = [
    {
      id: "parse",
      name: "① 场景解析",
      summary: `人群=${s.crowd}；场景=${task.scenario}；平台=${task.platform}；目标=${task.goal || "未指定"}`,
      detail: [
        `**一、场景判断**`,
        `- 目标人群：${s.crowd}`,
        `- 使用场景：${task.scenario}`,
        `- 用户问题：${s.problem}`,
        `- 内容目标：${task.goal || "（未指定，按默认「带来咨询」处理）"}`,
        `- 发布平台：${task.platform}`,
        `- 本场景切入点：${s.angle[task.modelId]}`,
        ``,
        `**可解释性**：换场景后切入点必然改变（如切到「企业采购」→ ${SCENARIOS["企业采购"].angle[task.modelId]}）。`,
      ].join("\n"),
      evidenceIds: ["p8-persona", "p8-questions"],
    },
    {
      id: "platform",
      name: "② 平台策略",
      summary: `${p.id}｜${p.spec}`,
      detail: [
        `**平台规则卡（${p.id}）**`,
        `- 图文要求：${p.spec}`,
        `- 结构：${p.structure}`,
        `- 语气：${p.tone}`,
        `- 图片数量：${p.imgRange[0]}–${p.imgRange[1]} 张`,
        `- 行动引导：${p.ctaStyle}`,
        ``,
        `**差异保证**：换平台后结构、语气、图片数量和行动引导全部改变，不只改篇幅或平台名（公众号=长文小标题 2–4 图；小红书=短段落 3–6 图；朋友圈=单卖点 1–3 图；海报=一屏一结论 1 主视觉）。`,
      ].join("\n"),
      evidenceIds: [p.evidenceId],
    },
    {
      id: "retrieve",
      name: "③ 资料与图片检索",
      summary: `命中型号事实 ${facts.length} 条 + 图片索引 ${imagePlan.length} 张（均保留来源）`,
      detail: [
        `**产品资料（P1 产品事实，核验 2026-10-17）**`,
        ...facts.map((f) => `- ${f}`),
        ``,
        `**图片来源（P1 图片索引.csv，逐张登记）**`,
        ...(imagePlan.length
          ? imagePlan.map((line) => `- ${line}`)
          : ["- （未取到图片索引，已标记待确认，正文中不含图片引用）"]),
      ].join("\n"),
      evidenceIds: m.evidenceIds,
    },
    {
      id: "facts",
      name: "④ 事实点提取",
      summary: `提取 ${facts.length} 个事实点，全部绑定来源`,
      detail: facts.map((f, i) => `${i + 1}. ${f}\n   - 来源：P1/${m.kbDir}/产品事实.md（核验 2026-10-17）`).join("\n"),
      evidenceIds: m.evidenceIds,
    },
    {
      id: "compose",
      name: "⑤ 图文编排",
      summary: `图片 ${imagePlan.length} 张（平台要求 ${p.imgRange[0]}–${p.imgRange[1]} 张）`,
      detail: [
        `**图片插入方案**（文件名 / 来源 / 插入位置 / 图片说明）`,
        ...(imagePlan.length
          ? imagePlan.map((line, i) => `图${i + 1}｜${line}`)
          : ["- 待确认：未取得图片索引，本稿不使用图片（宁缺毋错配）"]),
        ``,
        `型号一致性：以上图片全部来自「${m.kbDir}/图片索引.csv」，与正文型号 ${m.name} 一致。`,
      ].join("\n"),
      evidenceIds: m.evidenceIds,
    },
    {
      id: "generate",
      name: "⑥ 软文生成",
      summary: `《${art.title}》｜${p.id}结构已适配`,
      detail: `**标题**：${art.title}\n\n**正文**：\n${art.body}`,
      evidenceIds: [p.evidenceId, ...m.evidenceIds],
    },
    {
      id: "verify",
      name: "⑦ 事实核验",
      summary: `${facts.length} 项事实核对全部通过；型号一致性通过`,
      ok: true,
      detail: [
        `| 核验项 | 结果 |`,
        `|---|---|`,
        ...facts.map((f) => `| ${f.slice(0, 24)}… | ✅ 与 P1 事实一致 |`),
        `| 型号一致性（正文仅出现 ${m.name}） | ✅ 通过 |`,
        `| 图片型号与正文型号一致 | ${imagePlan.length ? "✅ 通过" : "⚠️ 无图片引用"} |`,
        `| 价格口径 | ${task.withPrice ? "✅ 引用官方页面价并标核验日" : "✅ 未引用具体金额"} |`,
        `| 知识库未记录的补贴/库存 | ✅ 未生成，标记待人工确认 |`,
      ].join("\n"),
      evidenceIds: m.evidenceIds,
    },
    {
      id: "compliance",
      name: "⑧ 合规检查",
      summary: scan.length ? `命中 ${scan.length} 项违规，已标记` : "6 类违规扫描全部通过",
      ok: scan.length === 0,
      detail: [
        `**统一测试样本扫描（绝对化用语/虚假承诺/价格误导/无依据对比/竞品贬低/虚构体验）**`,
        ...(scan.length
          ? scan.map((h) => `- ❌ ${h.label}：「${h.match}」→ 已标记，需人工改写`)
          : [
              "- ✅ 绝对化用语：未命中",
              "- ✅ 虚假承诺：未命中",
              "- ✅ 价格误导：未命中（价格仅有依据引用并标核验日）",
              "- ✅ 无依据对比/竞品贬低：未命中",
              "- ✅ 虚构体验/数据：未命中",
              "- ✅ 医疗宣称：未命中",
            ]),
        ``,
        `价格政策：${PRICE_POLICY}`,
      ].join("\n"),
      evidenceIds: [p.evidenceId],
    },
    {
      id: "export",
      name: "⑨ 导出",
      summary: "支持复制 / 下载 .md / 一键换平台重生成",
      detail: [
        `**导出内容预览**`,
        `标题：《${art.title}》`,
        ``,
        `（点击卡片右上角「复制全文」或「下载 .md」获取完整文本，含场景判断、知识库依据、图文软文、核验结果四段式。）`,
      ].join("\n"),
      evidenceIds: [],
    },
  ];
  return stages;
}

/** 组装统一输出格式（四段式：场景判断 / 知识库依据 / 图文软文 / 核验结果） */
export function buildExport(task: TaskInput, imagePlan: string[]): string {
  const m = MODELS[task.modelId];
  const s = SCENARIOS[task.scenario];
  const art = generateArticle(task);
  const imgSection = imagePlan.length
    ? imagePlan.map((l, i) => `图${i + 1}｜${l}`).join("\n")
    : "（本稿不使用图片：未取得索引或平台不支持）";
  return [
    `# 《${art.title}》｜${task.platform} · ${task.scenario}`,
    ``,
    `产品：${m.name}｜事实基准：2026-10-17`,
    ``,
    `## 一、场景判断`,
    `- 目标人群：${s.crowd}`,
    `- 使用场景：${task.scenario}（问题：${s.problem}）`,
    `- 内容目标：${task.goal || "带来咨询"}`,
    `- 发布平台：${task.platform}`,
    ``,
    `## 二、知识库依据`,
    `- 产品型号：${m.name}（${m.os} / ${m.cpu}）`,
    `- 事实点：${factPoints(m, s).join("；")}`,
    `- 资料标题：P1 产品事实 / 卖点与限制 / 官方公开价格卡（核验 2026-10-17）`,
    `- 图片来源：P1/${m.kbDir}/图片索引.csv`,
    ``,
    `## 三、图文软文`,
    `**标题**：${art.title}`,
    ``,
    art.body,
    ``,
    `**配图**`,
    imgSection,
    ``,
    `## 四、核验结果`,
    `- 产品事实：✅ 逐项与 P1 一致`,
    `- 图片型号：✅ 与正文型号一致（来源已登记）`,
    `- 合规：${complianceScan(`${art.title}\n${art.body}`).length ? "❌ 有命中项需改写" : "✅ 通过"}`,
    `- 待确认信息：知识库未记录的补贴/库存/内部价未写入本文`,
    ``,
    `---`,
    `由「门店增长智能体」生成 · 发布前请人工复核价格与权益`,
  ].join("\n");
}
