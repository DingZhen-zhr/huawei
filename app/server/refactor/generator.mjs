// 门店内容生成器：同一事实快照 + 同一真实细节，生成五个渠道的文案骨架。
// 这里不调用模型补事实；改写服务可以再接 DeepSeek，但事实仍由 verifier 决定。

const ANGLE_LABEL = { pain: "痛点切入", avoidance: "避坑与选择", story: "真实场景故事" };
const PLATFORM_LABEL = {
  xiaohongshu: "小红书",
  moments: "朋友圈",
  "wechat-mp": "公众号",
  poster: "海报",
  video: "视频号",
};

const HIGHLIGHTS = {
  "matebook-14-harmony": {
    screen: "14.2 英寸 3:2 OLED 触控屏，分辨率 2880 × 1920",
    portable: "约 1.32–1.33 kg，70 Wh 电池",
    ports: "HDMI、两个 USB-A 和一个 USB-C",
    limit: "HarmonyOS 6 的常用软件要先确认兼容，别只看外观",
    scene: "教室、图书馆、宿舍三点一线",
    posterLines: ["约 1.33 kg", "14.2 英寸 OLED", "3:2 触控屏", "价格到店确认"],
  },
  "matebook-gt-14": {
    screen: "14.2 英寸 OLED，2880 × 1920，最高 144 Hz",
    portable: "约 1.49 kg，70 Wh 电池",
    ports: "SD 卡槽、HDMI、两个 USB-A 与 USB-C",
    limit: "集成显卡和 Windows/Linux 版本差异要先问清楚",
    scene: "相机素材、外接屏和移动硬盘一起上桌",
    posterLines: ["约 1.49 kg", "14.2 英寸 OLED", "32GB + SD 卡槽", "官方价以门店为准"],
  },
  "matebook-pro-s": {
    screen: "14.2 英寸 3120 × 2080 柔性 OLED，120 Hz",
    portable: "标准屏版约 798 g，54 Wh 电池",
    ports: "左右各一个 USB-C，右侧支持 DP 1.2",
    limit: "只有两个 USB-C，常用 USB-A 设备要准备转接",
    scene: "通勤、出差、会议室之间来回移动",
    posterLines: ["约 798 g", "3120×2080 OLED", "双 USB-C", "官方价以门店为准"],
  },
};

function productFacts(productId) {
  return [...new Set((HIGHLIGHTS[productId] ? Object.values(HIGHLIGHTS[productId]) : []))];
}

function priceLine(product) {
  if (product.price?.status !== "active") return "价格到店确认，先不写具体数字";
  if (product.price?.min) return `${product.price.label}（2026-10-17 官方快照，以门店实际报价为准）`;
  return "具体配置和价格到店确认";
}

function priceBlocked(product) {
  return product.price?.status !== "active";
}

function priceBlockReason(product) {
  if (product.price?.status === "conflict") return "价格冲突未解决";
  if (product.price?.status === "reference") return "只有官网参考价，不是当前售价";
  return "暂无官方价格";
}

export function evidenceFor(product, keys = ["screen", "portable", "ports", "limit"]) {
  return product.facts
    .filter((f) => f.field !== "price")
    .filter((f) => {
      const text = String(f.value || "");
      if (keys.includes("screen") && /英寸|OLED|分辨率|Hz|ppi/.test(text)) return true;
      if (keys.includes("portable") && /kg|g|Wh|厚|电池|重量/.test(text)) return true;
      if (keys.includes("ports") && /USB|HDMI|接口|SD/.test(text)) return true;
      if (keys.includes("limit") && /但|需|限制|不支持|兼容|仅|没有|确认/.test(text)) return true;
      return false;
    })
    .slice(0, 6);
}

function normalizeDetail(text) {
  const s = String(text || "").trim().replace(/[。！？!?]+$/, "");
  return s || "旧电脑用起来不太顺手";
}

function ctaFor(target) {
  if (target === "私聊问配置") return "把你的用途发我，我按实际配置帮你对一下。";
  if (target === "先收藏对比") return "先收藏，等把用途和预算列清楚再对比。";
  if (target === "私聊发配置") return "把你的用途发我，我发具体配置给你看。";
  return "想摸一下重量和屏幕，直接到店看实物。";
}

function targetShort(target) {
  return target || "到店看实物";
}

function tagSet(product, angle) {
  const base = ["华为电脑", "门店体验", "AI生成"];
  if (product.id === "matebook-pro-s") base.unshift("轻薄本");
  else if (product.id === "matebook-gt-14") base.unshift("创作本");
  else base.unshift("学生电脑");
  if (angle === "avoidance") base.push("选购建议");
  if (angle === "story") base.push("真实场景");
  return [...new Set(base)].slice(0, 5);
}

function truncateText(text, max) {
  const chars = [...String(text || "")];
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max - 1).join("");
  const cut = Math.max(head.lastIndexOf("。"), head.lastIndexOf("，"), head.lastIndexOf("\n"));
  return (cut > max * 0.65 ? head.slice(0, cut + 1) : head) + "…";
}

function xhsVariant(product, detail, angle, audience, scene, target) {
  const h = HIGHLIGHTS[product.id];
  const detailLine = normalizeDetail(detail);
  const price = priceLine(product);
  const openings = {
    pain: `门店里遇到的情况很具体：${detailLine}。这种时候，先别急着换，也别只看一张参数表。`,
    avoidance: `先别被“轻薄”两个字带跑。${detailLine}，这种场景更该先看重量、屏幕和接口。`,
    story: `这次的内容只围绕一个门店里的真实场景：${detailLine}。没有夸张的成交故事，只有一台机器适不适合。`,
  };
  const bridge = {
    pain: `这台${product.shortName}放回这个场景里看，${h.screen}，${h.portable}。这些不是纸面热闹，是每天会碰到的部分。`,
    avoidance: `如果只看一个数字，很容易漏掉后面要用的东西。这台机器采用 ${h.screen}，还有${h.ports}，更适合先按使用方式筛选。`,
    story: `这类场景里，真正要确认的不是参数，而是“带出去会不会累、坐下来能不能顺手”。${product.shortName} ${h.portable}，屏幕采用 ${h.screen}，这两点正好对应。`,
  };
  const sceneLine = `对${audience || "每天带着电脑走动的人"}来说，${scene || h.scene}才是每天真正发生的事。机器轻一点、接口顺手一点，体验差别会很直接。`;
  const limitLine = `有一个边界要先说清楚：${h.limit}。这不是劝退，是避免买回去才发现不合用。`;
  const priceSection = priceBlocked(product)
    ? `价格先不写数字：${priceBlockReason(product)}，到店按实际配置确认。`
    : `价格口径也给清楚：${price}。`;
  const body = [openings[angle], bridge[angle], sceneLine, limitLine, priceSection, `${targetShort(target)}，比在屏幕前反复比较更快。`]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: angle === "pain"
      ? (product.id === "matebook-pro-s" ? "轻一点，带出门" : product.id === "matebook-gt-14" ? "素材多，先看接口" : "背去教室，轻一点")
      : angle === "avoidance" ? "先看这三点再决定" : "门店里的真实一幕",
    body: truncateText(body, 790),
    tags: tagSet(product, angle),
    firstComment: "产品信息来自官方公开资料；具体配置和价格以门店实际报价为准。",
    cta: ctaFor(target),
    evidence: evidenceFor(product),
    limitations: [h.limit, priceBlocked(product) ? `${priceBlockReason(product)}，正文不写具体价格` : "价格以门店实际报价为准"],
  };
}

function momentsVariant(product, detail, angle, audience, scene, target) {
  const h = HIGHLIGHTS[product.id];
  const detailLine = normalizeDetail(detail);
  const first = {
    pain: `${detailLine}。今天店里又聊到这个情况。`,
    avoidance: `${detailLine}，先别急着看参数。`,
    story: `门店里真实遇到的情况：${detailLine}。`,
  }[angle];
  const second = angle === "avoidance"
    ? `${product.shortName} 先看重量、屏幕和接口：${h.portable}，${h.ports}。`
    : `${product.shortName}：${h.portable}，屏幕采用 ${h.screen}，放在${scene || h.scene}里更说得通。`;
  const third = `${h.limit}。${ctaFor(target)}`;
  return {
    title: "",
    body: truncateText([first, second, third].filter(Boolean).join("\n"), 285),
    tags: [],
    cta: ctaFor(target),
    evidence: evidenceFor(product),
    limitations: [h.limit, priceBlocked(product) ? `${priceBlockReason(product)}，正文不写具体价格` : "价格以门店实际报价为准"],
  };
}

function wechatVariant(product, detail, audience, scene, target) {
  const h = HIGHLIGHTS[product.id];
  const detailLine = normalizeDetail(detail);
  const price = priceLine(product);
  const title = `${product.shortName}适合谁：先把${audience || "日常使用"}这件事说清楚`;
  const summary = `从门店里一个真实场景出发，看看${product.shortName}的屏幕、重量和接口是否适合${audience || "你的日常"}。`;
  const p1 = [
    `门店里遇到的情况是：${detailLine}。这类问题很难靠一句“够不够用”回答，因为${scene || h.scene}里的动作完全不同。`,
    `先把场景拆开：你要带它去哪里，坐下来要开什么，回家之后还要接什么。把这三件事说清楚，再去看参数，判断会稳很多。`,
    `这篇不写夸张的体验，也不替顾客做决定，只把官方资料里和这个场景直接相关的部分摆出来。`,
  ].join("\n\n");
  const p2 = [
    `屏幕部分，${product.shortName} 采用 ${h.screen}。如果你经常看长文档、对照表格，3:2 的纵向空间会比单纯的尺寸数字更直观。`,
    `便携部分，${h.portable}。这个数字不能直接换成“背着不累”，但可以拿去和你现在的电脑对比，差别通常一上手就有感觉。`,
    `接口部分，${h.ports}。接口少不一定不能买，关键看你现有的鼠标、硬盘、显示器和读卡器需不需要转接。`,
    `如果你平时还要外接显示器，先确认现有线材和接口能不能直接连；如果经常带出门，再把重量和适配器一起算进去，别只看机身数字。`,
    `这些信息来自同型号官方规格页，具体配置仍要按 SKU 核对。`,
  ].join("\n\n");
  const p3 = [
    `有一个边界需要提前说：${h.limit}。${priceBlocked(product) ? `这款产品${priceBlockReason(product)}，正文不写具体价格，等门店核对配置后再确认。` : `价格口径为：${price}。`}`,
    `如果你正在${scene || h.scene}，可以把现在的电脑重量、常用软件和接口列出来，再和这台机器逐项对。到店时把自己的鼠标、硬盘或读卡器带上，试一遍比只看参数表更直接。`,
    `如果暂时不换，也可以先到店把重量和屏幕放在一起比较，确认自己真正介意的是哪一项，再决定要不要继续看配置。`,
    `${ctaFor(target)}`,
  ].join("\n\n");
  const body = `一、先把这个真实场景说清楚\n\n${p1}\n\n二、屏幕、重量和接口分别解决什么\n\n${p2}\n\n三、哪些情况要先确认\n\n${p3}\n\n信息基准日 2026-10-17，产品信息来自华为官方公开资料；具体配置与价格以门店实际报价为准。本文由 AI 辅助整理，事实经账本核验。`;
  return {
    title: truncateText(title, 64),
    summary: truncateText(summary, 120),
    body: truncateText(body, 1450),
    tags: [],
    cta: ctaFor(target),
    evidence: evidenceFor(product),
    limitations: [h.limit, priceBlocked(product) ? `${priceBlockReason(product)}，正文不写具体价格` : "价格以门店实际报价为准"],
  };
}

function posterVariant(product, detail, target) {
  const h = HIGHLIGHTS[product.id];
  const detailLine = normalizeDetail(detail);
  const title = product.id === "matebook-pro-s" ? "轻一点，带出门" : product.id === "matebook-gt-14" ? "素材多，先看接口" : "背去教室，轻一点";
  const lines = h.posterLines || [
    detailLine.length <= 18 ? detailLine : "真实场景，到店聊",
    h.portable,
    h.screen,
    product.price?.status !== "active" ? "价格到店确认" : "官方商城价以门店为准",
  ];
  return {
    title: truncateText(title, 12),
    body: lines.slice(0, 4).join("\n"),
    tags: [],
    cta: ctaFor(target),
    evidence: evidenceFor(product),
    limitations: [h.limit, priceBlocked(product) ? `${priceBlockReason(product)}，海报不写具体价格` : "二维码与门店信息需使用真实配置"],
  };
}

function videoVariant(product, detail, angle, audience, scene, target) {
  const h = HIGHLIGHTS[product.id];
  const detailLine = normalizeDetail(detail);
  const hooks = {
    pain: `先别急着换电脑。${detailLine}。`,
    avoidance: `${detailLine}，先看这三个地方。`,
    story: `门店里遇到一个很具体的情况：${detailLine}。`,
  };
  const script = [
    `0–3 秒：${hooks[angle]}`,
    `3–15 秒：如果你是${audience || "每天带着电脑出门的人"}，先看重量。${product.shortName} ${h.portable}。`,
    `15–32 秒：再看屏幕和接口。${h.screen}，${h.ports}。这些决定了你在${scene || h.scene}里顺不顺手。`,
    `32–48 秒：边界也要讲清楚：${h.limit}。价格以门店实际报价为准。`,
    `48–60 秒：${ctaFor(target)}`,
  ].join("\n");
  return {
    title: truncateText(angle === "pain" ? "先看重量" : angle === "avoidance" ? "别只看参数" : "店里的一幕", 12),
    body: script,
    script,
    shotList: [
      "第一幕：销售拿起机器，手指比一下厚度（3 秒）",
      "第二幕：屏幕显示长文档或表格，镜头扫过键盘（12 秒）",
      "第三幕：接口特写，旁边放上常用外设（17 秒）",
      "第四幕：销售把机器放回桌面，面对镜头说限制条件（16 秒）",
      "第五幕：门店桌面收尾，字幕给出下一步动作（10 秒）",
    ],
    tags: [],
    cta: ctaFor(target),
    evidence: evidenceFor(product),
    limitations: [h.limit, priceBlocked(product) ? `${priceBlockReason(product)}，视频不写具体价格` : "价格以门店实际报价为准"],
  };
}

export function generatePlatformVariants({ product, platform, realDetail, audience, scene, target }) {
  const angles = ["xiaohongshu", "moments", "video"].includes(platform)
    ? ["pain", "avoidance", "story"]
    : ["pain"];
  return angles.map((angle) => {
    let v;
    if (platform === "xiaohongshu") v = xhsVariant(product, realDetail, angle, audience, scene, target);
    else if (platform === "moments") v = momentsVariant(product, realDetail, angle, audience, scene, target);
    else if (platform === "wechat-mp") v = wechatVariant(product, realDetail, audience, scene, target);
    else if (platform === "poster") v = posterVariant(product, realDetail, target);
    else v = videoVariant(product, realDetail, angle, audience, scene, target);
    return {
      ...v,
      platform,
      angle,
      platformLabel: PLATFORM_LABEL[platform],
      angleLabel: ANGLE_LABEL[angle],
      audience: audience || "",
      scene: scene || "",
      target: target || "",
      model: product.name,
      sku: "",
      systemVersion: "",
      status: "writing",
      editBurden: "light",
      imagePlan: imagePlanFor(product, platform, realDetail, target),
      priceIncluded: product.price?.status === "active" && /¥\s*[\d,]/.test(v.body || ""),
      evidenceIds: v.evidence.map((f) => f.id),
    };
  });
}

export function imagePlanFor(product, platform, realDetail, target) {
  const common = {
    productAssetId: product.id,
    backgroundBrief: "官方产品本体保持原样，仅生成校园或门店桌面背景与自然光影；背景不出现其他电脑、手机品牌、文字或二维码。",
    overlayText: [product.shortName, target || "到店看实物"],
    required: true,
  };
  if (platform === "xiaohongshu") {
    return [
      { purpose: "cover", ratio: "3:4", width: 1080, height: 1440, ...common, overlayText: [product.shortName, "真实场景"] },
      { purpose: "detail", ratio: "3:4", width: 1080, height: 1440, ...common, overlayText: ["屏幕与重量"] },
      { purpose: "scene", ratio: "3:4", width: 1080, height: 1440, ...common, overlayText: [target || "到店体验"] },
    ];
  }
  if (platform === "moments") return [{ purpose: "scene", ratio: "1:1", width: 1080, height: 1080, ...common }];
  if (platform === "wechat-mp") return [{ purpose: "cover", ratio: "16:9", width: 900, height: 383, ...common }];
  if (platform === "poster") return [{ purpose: "poster", ratio: "3:4", width: 1242, height: 1656, ...common }];
  return [{ purpose: "video-cover", ratio: "9:16", width: 1080, height: 1920, ...common }];
}

export function copyTextFor(variant) {
  if (variant.platform === "moments") return variant.body;
  if (variant.platform === "wechat-mp") return `${variant.title}\n\n${variant.body}`;
  if (variant.platform === "poster") return `${variant.title}\n\n${variant.body}`;
  if (variant.platform === "video") return `${variant.script || variant.body}\n\n分镜：\n${(variant.shotList || []).map((x) => `- ${x}`).join("\n")}`;
  const tags = (variant.tags || []).map((x) => `#${x}`).join(" ");
  return `${variant.title}\n\n${variant.body}\n\n${tags}`.trim();
}

export { ANGLE_LABEL, PLATFORM_LABEL, productFacts };
