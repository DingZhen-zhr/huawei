// 整包导出：五渠道文案 + 已生成配图 + 来源 + manifest；未核验的渠道不进 copy/。
import type { Platform, TaskSnapshot, Variant } from "./api";
import { renderImages, type RenderedImage } from "./render-images";
import { base64File, downloadBlob, textFile, zipFiles, type ZipFile } from "./zip";

const PLATFORMS: Platform[] = ["xiaohongshu", "moments", "wechat-mp", "poster", "video"];
const LABELS: Record<Platform, string> = {
  xiaohongshu: "小红书",
  moments: "朋友圈",
  "wechat-mp": "公众号",
  poster: "海报",
  video: "视频号",
};

function pickVariant(snapshot: TaskSnapshot, platform: Platform): Variant | null {
  const channel = snapshot.channels[platform];
  if (!channel) return null;
  return channel.variants.find((variant) => variant.selected) || channel.recommended || channel.variants[0] || null;
}

function copyText(variant: Variant) {
  if (variant.platform === "video") {
    return `${variant.script || variant.body}\n\n分镜：\n${(variant.shotList || []).map((shot) => `- ${shot}`).join("\n")}`.trim();
  }
  return variant.copyText || variant.body;
}

export async function buildPack({
  snapshot,
  images,
}: {
  snapshot: TaskSnapshot;
  images: Record<string, RenderedImage[]>;
}): Promise<{ blob: Blob; missing: string[] }> {
  const files: ZipFile[] = [];
  const channelRows: Record<string, unknown>[] = [];
  const blocked: Record<string, unknown>[] = [];
  const missing: string[] = [];
  if (!snapshot.task.hasAssets) missing.push("官方图还没到：配图先用文字模板");

  for (const platform of PLATFORMS) {
    const variant = pickVariant(snapshot, platform);
    if (!variant) {
      channelRows.push({ platform, label: LABELS[platform], status: "missing" });
      missing.push(`${LABELS[platform]}：没有选中版本`);
      continue;
    }
    const ready = variant.status === "ready" && !variant.verification?.blocked;
    const rendered =
      images[variant.id] ||
      (await renderImages({
        platform,
        variant,
        task: snapshot.task,
        facts: snapshot.evidence,
      }));

    for (const image of rendered) {
      files.push(base64File(`images/${image.filename}`, image.dataUrl));
    }

    if (ready) {
      files.push(textFile(`copy/${platform}.txt`, `${copyText(variant)}\n`));
    } else {
      blocked.push({
        platform,
        label: LABELS[platform],
        angle: variant.angle,
        reasons: variant.verification?.reasons || ["未通过核验"],
      });
    }

    channelRows.push({
      platform,
      label: LABELS[platform],
      status: variant.status,
      variantId: variant.id,
      angle: variant.angle,
      title: variant.title || "",
      editBurden: variant.editBurden,
      generatedBy: variant.generatedBy || "rules",
      imageCount: rendered.length,
      images: rendered.map((image) => image.filename),
      verification: {
        status: variant.verification?.status || "unknown",
        reasons: variant.verification?.reasons || [],
      },
    });
  }

  const manifest = {
    schema: "huacai.pack/1",
    task: {
      id: snapshot.task.id,
      store: snapshot.task.storeName,
      storeProfile: snapshot.task.storeProfile,
      product: {
        id: snapshot.task.productId,
        name: snapshot.task.productName,
        shortName: snapshot.task.productShortName,
        priceLabel: snapshot.task.priceLabel,
        priceStatus: snapshot.task.priceStatus,
        snapshotDate: snapshot.task.snapshotDate,
        hasAssets: Boolean(snapshot.task.hasAssets),
      },
      audience: snapshot.task.audience,
      scene: snapshot.task.scene,
      target: snapshot.task.target,
      realDetail: snapshot.task.realDetail,
      generationMode: snapshot.task.generationMode,
      createdAt: snapshot.task.createdAt,
    },
    generatedAt: new Date().toISOString(),
    channels: channelRows,
    blocked,
    conflict: (snapshot.conflicts || []).map((item) => ({
      id: item.id,
      field: item.field,
      status: item.status,
      reason: item.reason,
      candidates: item.candidates?.map((candidate) => candidate.value),
    })),
    fallbacks: snapshot.task.fallbacks || [],
    missingImages: missing,
    note: "没过核验的渠道不会放进 copy/。价格、库存和活动以门店当天为准。配图用官方产品图和模板排版，产品外观没改。",
  };

  const sources = {
    product: snapshot.task.productName,
    snapshotDate: snapshot.task.snapshotDate,
    evidence: (snapshot.evidence || []).map((fact) => ({
      id: fact.id,
      model: fact.model,
      field: fact.field,
      value: fact.value,
      unit: fact.unit,
      sourceTitle: fact.sourceTitle,
      sourceUrl: fact.sourceUrl,
      capturedAt: fact.capturedAt,
      trustTier: fact.trustTier,
    })),
  };

  files.push(textFile("manifest.json", JSON.stringify(manifest, null, 2)));
  files.push(textFile("sources.json", JSON.stringify(sources, null, 2)));
  files.push(
    textFile(
      "README.txt",
      [
        "华采智营 · 门店内容包",
        "",
        `门店：${snapshot.task.storeName || ""}`,
        `产品：${snapshot.task.productName}`,
        `场景：${snapshot.task.audience} · ${snapshot.task.scene} · ${snapshot.task.target}`,
        `生成方式：${snapshot.task.generationMode}`,
        "",
        "目录：",
        "- copy/  过了核验的渠道文案（没过的见 manifest.blocked）",
        "- images/  官方图 + 排版出的配图",
        "- sources.json  资料和来源",
        "- manifest.json  渠道状态、核对结果、待补项",
        "",
        "发之前再看一眼门店报价、库存和联系方式。",
      ].join("\n"),
    ),
  );

  return { blob: zipFiles(files), missing };
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type || "application/zip" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "华采智营内容包" });
      return "shared" as const;
    } catch {
      // 用户取消分享时仍然给下载入口。
    }
  }
  downloadBlob(blob, filename);
  return "downloaded" as const;
}
