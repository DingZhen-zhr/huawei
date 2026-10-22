// 今日任务卡只从有真实事实和官方素材的型号中生成，不写无资料选题。
import { getProduct } from "./ledger.mjs";

const CARD_DEFS = [
  {
    id: "scene-light-carry",
    productId: "matebook-pro-s",
    title: "轻，是拿在手里的",
    scene: "到店体验 / 通勤随身",
    audience: "通勤上班族",
    target: "到店摸一摸",
    reason: "约 798–825g、11.9–12.2mm 的机身差异来自官方规格；适合让顾客亲手掂一掂，而不是只讲参数。",
    requiredDetailHint: "顾客现在背的电脑有多重，或者每天要带去哪里？",
    detailOptions: ["现在的电脑背一天肩膀发酸", "通勤路上要一直拎着走", "在店里拿起来先掂重量"],
    audienceOptions: ["通勤上班族", "经常出差的人", "给家里人挑轻一点的"],
    targetOptions: ["到店摸一摸", "私聊问配置", "先收藏对比"],
  },
  {
    id: "scene-classroom",
    productId: "matebook-14-harmony",
    title: "上课背来背去，重一点都明显",
    scene: "学生上课 / 图书馆",
    audience: "大学生",
    target: "到店看实物",
    reason: "14.2 英寸 3:2 屏、约 1.32–1.33kg 和 70Wh 电池，适合宿舍、教室、图书馆之间移动。价格事实存在冲突，内容默认不带价。",
    requiredDetailHint: "旧电脑在教室、宿舍或图书馆里，具体哪里不方便？",
    detailOptions: ["旧电脑开机慢、风扇响", "每天背去教室太沉", "宿舍桌面小，放不下大机器"],
    audienceOptions: ["大学生", "研究生", "家长给孩子买"],
    targetOptions: ["到店看实物", "私聊发配置", "先收藏再比较"],
    noPrice: true,
  },
  {
    id: "scene-editing",
    productId: "matebook-gt-14",
    title: "素材一多，桌面先乱",
    scene: "剪视频 / 整理素材",
    audience: "短视频创作者",
    target: "私聊问配置",
    reason: "14.2 英寸 OLED、32GB 内存、SD 卡与 HDMI 来自官方规格；先把素材导入和外接屏这条链路讲清楚，不承诺未经验证的渲染结果。",
    requiredDetailHint: "剪视频时是素材太多、导出慢，还是接口不够用？",
    detailOptions: ["相机素材多，导卡麻烦", "外接屏和硬盘总少一个口", "剪片时同时开太多软件会卡"],
    audienceOptions: ["短视频创作者", "摄影爱好者", "做课程视频的老师"],
    targetOptions: ["私聊问配置", "到店带素材试", "先收藏对比"],
  },
];

export function getTaskCards() {
  const cards = CARD_DEFS.map((def) => {
    const product = getProduct(def.productId);
    if (!product || !product.hasAssets) return null;
    return {
      ...def,
      productName: product.name,
      productShortName: product.shortName,
      productAsset: product.asset,
      productFamily: product.family,
      hasAssets: product.hasAssets,
      factStatus: product.conflict ? "conflict" : "active",
      priceLabel: product.price.label,
      snapshotDate: product.snapshotDate,
    };
  }).filter(Boolean);
  return cards.slice(0, 3);
}

export function getTaskCard(id) {
  return getTaskCards().find((c) => c.id === id) || null;
}
