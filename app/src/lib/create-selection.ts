import type { Product, TaskCard } from "./api";

export type CreateChoice = Omit<TaskCard, "productAsset"> & { productAsset: string | null };

export function createChoices(products: Product[], taskCards: TaskCard[]): CreateChoice[] {
  return products.map((product) => taskCards.find((card) => card.productId === product.id) || {
    id: `product:${product.id}`,
    productId: product.id,
    productName: product.name,
    productShortName: product.shortName,
    productAsset: product.asset,
    productFamily: product.family,
    title: product.shortName,
    scene: "日常使用 / 到店体验",
    audience: "有明确用途的顾客",
    target: "到店看实物",
    reason: "根据同型号账本资料生成；具体配置需确认。",
    requiredDetailHint: "顾客现在的电脑遇到了什么具体问题？",
    hasAssets: product.hasAssets,
    factStatus: product.factStatus,
    priceLabel: product.price.label,
    snapshotDate: product.snapshotDate,
    detailOptions: [],
    audienceOptions: ["有明确用途的顾客", "大学生", "通勤上班族"],
    targetOptions: ["到店看实物", "私聊问配置", "先收藏对比"],
  });
}

export function selectCreateChoice(choices: CreateChoice[], productId: string, taskCardId: string): CreateChoice | null {
  if (productId) return choices.find((choice) => choice.productId === productId) || null;
  if (taskCardId) return choices.find((choice) => choice.id === taskCardId) || null;
  return choices[0] || null;
}
