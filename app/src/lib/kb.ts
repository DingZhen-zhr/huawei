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
];

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
