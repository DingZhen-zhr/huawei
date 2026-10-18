// 知识库 v7 访问层：通过 Vite /@fs/ 读取工作区内真实文件，实现可回溯的"检索"
const KB_ROOT = "D:/KimiData/kimi/Workspaces/华为浙客松/华为PC全板块深度知识库_v7";

export interface KbFile {
  id: string;
  label: string; // 展示名
  board: string; // 板块
  path: string; // 绝对路径
  keywords: string[]; // 检索关键词
}

export const KB_FILES: KbFile[] = [
  {
    id: "rules-order",
    label: "智能体规则｜检索顺序",
    board: "00-建库规范",
    path: `${KB_ROOT}/00-建库规范/06-智能体规则/检索顺序.md`,
    keywords: ["检索", "顺序", "规则", "追问"],
  },
  {
    id: "rules-refuse",
    label: "智能体规则｜拒答与转人工",
    board: "00-建库规范",
    path: `${KB_ROOT}/00-建库规范/06-智能体规则/拒答与转人工.md`,
    keywords: ["转人工", "拒答", "内部价", "返点", "权限"],
  },
  {
    id: "p8-persona",
    label: "设计创意｜客户画像",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/12-行业场景/13-设计创意/客户画像.md`,
    keywords: ["画像", "设计", "创意", "客户", "行业"],
  },
  {
    id: "p8-questions",
    label: "设计创意｜需求访谈问题清单",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/12-行业场景/13-设计创意/问题清单.md`,
    keywords: ["问题清单", "访谈", "必问", "追问"],
  },
  {
    id: "p8-template",
    label: "设计创意｜方案输出模板",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/12-行业场景/13-设计创意/方案输出模板.md`,
    keywords: ["方案", "模板", "候选", "试点"],
  },
  {
    id: "p8-acceptance",
    label: "设计创意｜验收清单",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/12-行业场景/13-设计创意/验收清单.md`,
    keywords: ["验收", "清单", "试点", "交付"],
  },
  {
    id: "p2-interview",
    label: "零售顾问需求访谈卡",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/01-零售/零售顾问需求访谈卡.md`,
    keywords: ["访谈", "话术", "零售", "顾问", "追问"],
  },
  {
    id: "p1-facts",
    label: "HUAWEI MateBook Pro｜产品事实",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook Pro/产品事实.md`,
    keywords: ["matebook pro", "参数", "规格", "970", "屏幕", "事实", "鸿蒙"],
  },
  {
    id: "p1-selling",
    label: "HUAWEI MateBook Pro｜卖点与限制",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook Pro/卖点与限制.md`,
    keywords: ["卖点", "限制", "适用", "取舍", "不适合"],
  },
  {
    id: "p1-price-pro",
    label: "MateBook Pro（鸿蒙版）｜官方公开价格卡",
    board: "P1-产品参数库/08",
    path: `${KB_ROOT}/P1-产品参数库/08-官方公开价格快照/01-消费级PC/HUAWEI MateBook Pro（鸿蒙版）-价格卡.md`,
    keywords: ["价格", "报价", "多少钱", "matebook pro", "券", "分期", "赠品"],
  },
  {
    id: "p1-price-14",
    label: "MateBook 14 酷睿 Ultra｜官方公开价格卡",
    board: "P1-产品参数库/08",
    path: `${KB_ROOT}/P1-产品参数库/08-官方公开价格快照/01-消费级PC/HUAWEI MateBook 14 酷睿 Ultra-价格卡.md`,
    keywords: ["matebook 14", "酷睿", "windows", "下架"],
  },
  {
    id: "p6-xhs",
    label: "小红书图文创作指南",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/02-平台模板/小红书图文模板.md`,
    keywords: ["小红书", "图文", "内容", "文案", "软文", "发布"],
  },
  {
    id: "p6-xhs-draft",
    label: "MateBook Pro｜小红书完整成稿",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/11-完整软文成稿库/HUAWEI MateBook Pro/小红书完整成稿.md`,
    keywords: ["成稿", "案例", "小红书"],
  },
  {
    id: "p6-mp",
    label: "微信公众号图文模板",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/02-平台模板/微信公众号图文模板.md`,
    keywords: ["公众号", "微信", "平台"],
  },
  {
    id: "p6-moments",
    label: "销售朋友圈模板",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/02-平台模板/销售朋友圈模板.md`,
    keywords: ["朋友圈", "平台"],
  },
  {
    id: "p6-poster",
    label: "门店海报图文模板",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/02-平台模板/门店海报图文模板.md`,
    keywords: ["海报", "门店", "平台"],
  },
  {
    id: "p1-facts-14",
    label: "HUAWEI MateBook 14（鸿蒙版）｜产品事实",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook 14/产品事实.md`,
    keywords: ["matebook 14", "参数", "规格", "事实"],
  },
  {
    id: "p1-facts-pros",
    label: "HUAWEI MateBook Pro S｜产品事实",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook Pro S/产品事实.md`,
    keywords: ["pro s", "参数", "规格", "事实"],
  },
  {
    id: "p1-selling-14",
    label: "MateBook 14｜卖点与限制",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook 14/卖点与限制.md`,
    keywords: ["卖点", "限制", "matebook 14"],
  },
  {
    id: "p1-selling-pros",
    label: "MateBook Pro S｜卖点与限制",
    board: "P1-产品参数库",
    path: `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/HUAWEI MateBook Pro S/卖点与限制.md`,
    keywords: ["卖点", "限制", "pro s"],
  },
  {
    id: "p1-price-14h",
    label: "MateBook 14（鸿蒙版）｜官方公开价格卡",
    board: "P1-产品参数库/08",
    path: `${KB_ROOT}/P1-产品参数库/08-官方公开价格快照/01-消费级PC/HUAWEI MateBook 14（鸿蒙版）-价格卡.md`,
    keywords: ["价格", "matebook 14", "报价"],
  },
  {
    id: "p1-price-pros",
    label: "MateBook Pro S｜官方公开价格卡",
    board: "P1-产品参数库/08",
    path: `${KB_ROOT}/P1-产品参数库/08-官方公开价格快照/01-消费级PC/HUAWEI MateBook Pro S-价格卡.md`,
    keywords: ["价格", "pro s", "报价"],
  },

  // ── 扩容批次（2026-10-18）：P7 高频问答 / P8 场景卡 / P2 型号角色话术 / P6 成稿与合规 / P5 销售培训 ──
  {
    id: "p7-faq-select",
    label: "售前FAQ｜选型与版本",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/01-售前FAQ/选型与版本FAQ.md`,
    keywords: ["选型", "版本", "配置", "怎么选", "区别", "faq"],
  },
  {
    id: "p7-faq-buy",
    label: "售前FAQ｜购买与服务",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/01-售前FAQ/购买与服务FAQ.md`,
    keywords: ["购买", "下单", "服务", "赠品", "发票", "faq"],
  },
  {
    id: "p7-warranty",
    label: "售后政策｜笔记本保修政策速查",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/02-售后政策/笔记本保修政策速查.md`,
    keywords: ["保修", "质保", "售后", "维修", "保修期"],
  },
  {
    id: "p7-service",
    label: "售后政策｜官方服务权益速查",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/02-售后政策/官方服务权益速查.md`,
    keywords: ["权益", "服务", "焕新", "电池", "硬盘", "售后"],
  },
  {
    id: "p7-harmony-vs-win",
    label: "高频问答｜鸿蒙版与Windows版区别",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/06-高频问答/03-鸿蒙版与Windows版区别.md`,
    keywords: ["鸿蒙版", "windows", "区别", "系统", "harmonyos"],
  },
  {
    id: "p7-software",
    label: "高频问答｜专业软件能否安装",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/06-高频问答/04-专业软件能否安装.md`,
    keywords: ["软件", "安装", "兼容", "ps", "cad", "应用"],
  },
  {
    id: "p7-super-device",
    label: "高频问答｜手机协同需要什么条件",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/06-高频问答/06-手机协同需要什么条件.md`,
    keywords: ["协同", "超级终端", "手机", "多屏", "互联"],
  },
  {
    id: "p7-battery-life",
    label: "高频问答｜续航为何与宣传不同",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/06-高频问答/14-续航为何与宣传不同.md`,
    keywords: ["续航", "电池", "宣传", "实测", "使用时间"],
  },
  {
    id: "p7-return",
    label: "高频问答｜退换货需要什么条件",
    board: "P7-常见问题库",
    path: `${KB_ROOT}/P7-常见问题库/06-高频问答/50-退换货需要什么条件.md`,
    keywords: ["退换", "退货", "换货", "七天", "退款"],
  },
  {
    id: "p8-scene-zhengqi",
    label: "场景卡｜政企",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/01-政企/政企场景问题.md`,
    keywords: ["政企", "政府", "采购", "信创", "场景"],
  },
  {
    id: "p8-scene-edu",
    label: "场景卡｜教育",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/02-教育/教育场景问题.md`,
    keywords: ["教育", "学校", "教师", "教学", "场景"],
  },
  {
    id: "p8-scene-sme",
    label: "场景卡｜中小企业",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/03-中小企业/中小企业场景问题.md`,
    keywords: ["中小企业", "创业公司", "办公", "批量", "场景"],
  },
  {
    id: "p8-scene-store",
    label: "场景卡｜门店",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/04-门店/门店场景问题.md`,
    keywords: ["门店", "到店", "体验", "导购", "场景"],
  },
  {
    id: "p8-scene-creator",
    label: "场景卡｜内容创作",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/05-内容创作/内容创作场景卡.md`,
    keywords: ["内容创作", "设计", "摄影", "视频", "创作者", "场景"],
  },
  {
    id: "p8-scene-mobile",
    label: "场景卡｜移动办公",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/06-移动办公/移动办公场景卡.md`,
    keywords: ["移动办公", "差旅", "通勤", "外出", "场景"],
  },
  {
    id: "p8-scene-student",
    label: "场景卡｜学生学习",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/07-学生学习/学生学习场景卡.md`,
    keywords: ["学生", "学习", "开学", "上课", "场景"],
  },
  {
    id: "p8-scene-family",
    label: "场景卡｜家庭换新",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/08-家庭换新/家庭换新场景卡.md`,
    keywords: ["家庭", "换新", "旧电脑", "升级", "场景"],
  },
  {
    id: "p8-scene-business",
    label: "场景卡｜商务管理",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/09-商务管理/商务管理场景卡.md`,
    keywords: ["商务", "管理", "会议", "安全", "场景"],
  },
  {
    id: "p8-scene-aftersale",
    label: "场景卡｜售后服务",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/10-售后服务/售后场景问题.md`,
    keywords: ["售后", "服务", "维修", "咨询", "场景"],
  },
  {
    id: "p8-scene-it",
    label: "场景卡｜企业IT部署",
    board: "P8-客户场景库",
    path: `${KB_ROOT}/P8-客户场景库/11-企业IT/企业部署场景卡.md`,
    keywords: ["企业it", "部署", "批量", "运维", "场景"],
  },
  {
    id: "p2-pro-store",
    label: "话术卡｜MateBook Pro × 门店顾客",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro/门店顾客沟通卡.md`,
    keywords: ["matebook pro", "门店", "顾客", "话术", "沟通"],
  },
  {
    id: "p2-pro-creator",
    label: "话术卡｜MateBook Pro × 内容创作者",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro/内容创作者沟通卡.md`,
    keywords: ["matebook pro", "创作者", "话术", "沟通", "设计"],
  },
  {
    id: "p2-pro-tradein",
    label: "话术卡｜MateBook Pro × 旧机换新",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro/旧机换新用户沟通卡.md`,
    keywords: ["matebook pro", "换新", "旧机", "迁移", "话术"],
  },
  {
    id: "p2-14-store",
    label: "话术卡｜MateBook 14 × 门店顾客",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook 14/门店顾客沟通卡.md`,
    keywords: ["matebook 14", "门店", "顾客", "话术", "沟通"],
  },
  {
    id: "p2-14-creator",
    label: "话术卡｜MateBook 14 × 内容创作者",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook 14/内容创作者沟通卡.md`,
    keywords: ["matebook 14", "创作者", "话术", "沟通", "设计"],
  },
  {
    id: "p2-14-tradein",
    label: "话术卡｜MateBook 14 × 旧机换新",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook 14/旧机换新用户沟通卡.md`,
    keywords: ["matebook 14", "换新", "旧机", "迁移", "话术"],
  },
  {
    id: "p2-pros-store",
    label: "话术卡｜MateBook Pro S × 门店顾客",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro S/门店顾客沟通卡.md`,
    keywords: ["pro s", "门店", "顾客", "话术", "沟通"],
  },
  {
    id: "p2-pros-creator",
    label: "话术卡｜MateBook Pro S × 内容创作者",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro S/内容创作者沟通卡.md`,
    keywords: ["pro s", "创作者", "话术", "沟通", "设计"],
  },
  {
    id: "p2-pros-tradein",
    label: "话术卡｜MateBook Pro S × 旧机换新",
    board: "P2-卖点话术库",
    path: `${KB_ROOT}/P2-卖点话术库/07-按型号角色/HUAWEI MateBook Pro S/旧机换新用户沟通卡.md`,
    keywords: ["pro s", "换新", "旧机", "迁移", "话术"],
  },
  {
    id: "p6-draft-index",
    label: "成稿库｜总索引",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/11-完整软文成稿库/00-总索引.md`,
    keywords: ["成稿", "索引", "案例", "范文"],
  },
  {
    id: "p6-draft-14-xhs",
    label: "成稿｜MateBook 14 小红书",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/11-完整软文成稿库/HUAWEI MateBook 14/小红书完整成稿.md`,
    keywords: ["成稿", "matebook 14", "小红书", "案例"],
  },
  {
    id: "p6-draft-14-mp",
    label: "成稿｜MateBook 14 公众号",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/11-完整软文成稿库/HUAWEI MateBook 14/微信公众号完整成稿.md`,
    keywords: ["成稿", "matebook 14", "公众号", "案例"],
  },
  {
    id: "p6-compliance",
    label: "合规｜售后与促销表述红线",
    board: "P6-营销素材库",
    path: `${KB_ROOT}/P6-营销素材库/08-合规/售后与促销表述红线.md`,
    keywords: ["合规", "红线", "违规", "表述", "促销"],
  },
  {
    id: "p5-training",
    label: "销售培训｜对话演练指引",
    board: "P5-培训赋能库",
    path: `${KB_ROOT}/P5-培训赋能库/07-销售培训/销售对话演练指引.md`,
    keywords: ["培训", "演练", "对话", "销售", "导购"],
  },
];

/** 按型号读取图片索引 CSV（真实检索图片来源） */
export interface KbImage {
  file: string;
  url: string;
  caption: string;
  usage: string;
}

export async function fetchImageIndex(modelDir: string): Promise<KbImage[]> {
  const csv = await fetchKbFile(
    `${KB_ROOT}/P1-产品参数库/01-鸿蒙电脑/${modelDir}/图片索引.csv`
  );
  return csv
    .split("\n")
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      // 简单 CSV 解析：前5列（文件名,型号,来源页,URL,说明）
      const m = line.match(/^([^,]+),[^,]*,[^,]*,([^,]*),([^,]*),/);
      const usage = line.split(",").slice(-1)[0] || "";
      return {
        file: m?.[1]?.trim() ?? line.slice(0, 40),
        url: m?.[2]?.trim() ?? "",
        caption: m?.[3]?.trim() || "（官网图片）",
        usage: usage.trim(),
      };
    })
    .filter((img) => img.file);
}

export async function fetchKbFile(path: string): Promise<string> {
  const res = await fetch(`/@fs/${encodeURI(path)}`);
  if (!res.ok) throw new Error(`无法读取知识库文件（${res.status}）：${path}`);
  return res.text();
}

export interface Evidence {
  file: KbFile;
  excerpt: string; // 命中的相关行
  fullText?: string;
}

/** 简易检索：按关键词选文件，再抽取命中行作为摘录 */
export async function retrieve(query: string, fileIds?: string[]): Promise<Evidence[]> {
  const q = query.toLowerCase();
  const candidates = (fileIds && fileIds.length
    ? KB_FILES.filter((f) => fileIds.includes(f.id))
    : KB_FILES.filter(
        (f) =>
          f.keywords.some((k) => q.includes(k.toLowerCase())) ||
          f.label.toLowerCase().includes(q)
      )
  ).slice(0, 4);

  const out: Evidence[] = [];
  for (const file of candidates) {
    try {
      const text = await fetchKbFile(file.path);
      const lines = text.split("\n");
      const hits = lines.filter((l) =>
        file.keywords.some((k) => l.toLowerCase().includes(k.toLowerCase()))
      );
      const excerpt = (hits.length ? hits : lines.slice(0, 6)).slice(0, 8).join("\n");
      out.push({ file, excerpt, fullText: text });
    } catch (e) {
      out.push({
        file,
        excerpt: `（读取失败：${e instanceof Error ? e.message : String(e)}）`,
      });
    }
  }
  return out;
}
