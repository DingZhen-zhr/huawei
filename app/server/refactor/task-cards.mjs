// 今日任务卡只从有真实事实和官方素材的型号中生成，不写无资料选题。
import { getProduct } from "./ledger.mjs";
import { importedAssetFor } from "./kb-store.mjs";

const CARD_DEFS = [
  {
    id: "scene-light-carry",
    productId: "matebook-pro-s",
    title: "798 克，拎一下就知道",
    scene: "到店体验 / 通勤随身",
    audience: "通勤上班族",
    target: "到店摸一摸",
    reason: "标准屏版约 798 克。顾客把旧电脑一起拎起来，差别马上就能感觉到。",
    requiredDetailHint: "顾客现在用的电脑有多重？每天背着走多远？",
    detailOptions: ["现在的电脑背一天肩膀发酸", "通勤路上要一直拎着走", "在店里拿起来先掂重量"],
    audienceOptions: ["通勤上班族", "经常出差的人", "给家里人挑轻一点的"],
    targetOptions: ["到店摸一摸", "私聊问配置", "先收藏对比"],
  },
  {
    id: "scene-classroom",
    productId: "matebook-14-harmony",
    title: "上课背来背去，重一点都嫌累",
    scene: "学生上课 / 图书馆",
    audience: "大学生",
    target: "到店看实物",
    reason: "约 1.32 kg，背去教室轻一点。价格还没核实，内容先不带价。",
    requiredDetailHint: "旧电脑在教室、宿舍或图书馆，具体哪儿别扭？",
    detailOptions: ["旧电脑开机慢、风扇响", "每天背去教室太沉", "宿舍桌面小，放不下大机器"],
    audienceOptions: ["大学生", "研究生", "家长给孩子买"],
    targetOptions: ["到店看实物", "私聊发配置", "先收藏再比较"],
    noPrice: true,
  },
  {
    id: "scene-editing",
    productId: "matebook-gt-14",
    title: "素材一多，桌面就乱",
    scene: "剪视频 / 整理素材",
    audience: "短视频创作者",
    target: "私聊问配置",
    reason: "SD 卡槽和 HDMI 都有。导卡、接硬盘不用转接，没测过的渲染速度先别承诺。",
    requiredDetailHint: "剪片时是卡多、导出慢，还是接口不够？",
    detailOptions: ["相机素材多，导卡麻烦", "外接屏和硬盘总少一个口", "剪片时同时开太多软件会卡"],
    audienceOptions: ["短视频创作者", "摄影爱好者", "做课程视频的老师"],
    targetOptions: ["私聊问配置", "到店带素材试", "先收藏对比"],
  },
];

export function getTaskCards() {
  const cards = CARD_DEFS.map((def) => {
    const product = getProduct(def.productId);
    const asset = product ? (product.asset || importedAssetFor(product.modelKey)) : null;
    if (!product || !asset) return null;
    return {
      ...def,
      productName: product.name,
      productShortName: product.shortName,
      productAsset: asset,
      productFamily: product.family,
      hasAssets: Boolean(asset),
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
