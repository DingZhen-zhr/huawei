import { zipSync, strToU8 } from 'fflate';
import { getProduct } from './ledger.mjs';
import { copyTextFor } from './generator.mjs';
import { authorizeMedia, verifyVariant, PLATFORMS, MEDIA_RULE_VERSION } from './content-assets.mjs';

export async function exportContent({ task, store, repository, selections = {} }) {
  authorizeMedia(task, store);
  if (!selections || typeof selections !== 'object' || Array.isArray(selections) || Object.keys(selections).some(p => !PLATFORMS.includes(p))) throw Object.assign(new Error('渠道选择无效'), { status: 400 });
  const chosen = PLATFORMS.map(platform => {
    const variants = task.variants.filter(v => v.platform === platform);
    const variant = selections[platform] ? variants.find(v => v.id === selections[platform]) : variants.find(v => v.selected) || variants.find(v => v.recommended) || variants[0];
    verifyVariant(task, variant);
    return variant;
  });
  const product = getProduct(task.productId);
  const assets = repository.list(task, store);
  const manifest = { taskId: task.id, productId: task.productId, model: product.name, factDate: product.snapshotDate, createdAt: new Date().toISOString(), mode: 'official-layout', ruleVersion: MEDIA_RULE_VERSION, selections: Object.fromEntries(chosen.map(v => [v.platform, v.id])), missingImages: [], images: [] };
  const files = {};
  for (const variant of chosen) {
    files[`copy/${variant.platform}.txt`] = strToU8(copyTextFor(variant));
    for (let index = 0; index < variant.imagePlan.length; index++) {
      const row = assets.find(a => a.variantId === variant.id && a.index === index && a.status === 'ready');
      if (!row) { manifest.missingImages.push({ platform: variant.platform, variantId: variant.id, index, reason: assets.find(a => a.variantId === variant.id && a.index === index)?.status || 'not-generated' }); continue; }
      const filename = `images/${variant.platform}/${variant.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${index + 1}.png`;
      files[filename] = await repository.download(task, store, row.id);
      manifest.images.push({ filename, assetId: row.id, fingerprint: row.fingerprint });
    }
  }
  // Recheck current drafts after asynchronous reads before serializing the final package.
  chosen.forEach(v => verifyVariant(task, v));
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['sources.json'] = strToU8(JSON.stringify({ taskId: task.id, model: product.name, factDate: product.snapshotDate, mode: manifest.mode, ruleVersion: MEDIA_RULE_VERSION, copy: chosen.map(v => ({ platform: v.platform, variantId: v.id, text: copyTextFor(v), evidenceIds: v.evidenceIds || [] })), facts: product.facts, images: assets.filter(a => manifest.images.some(i => i.assetId === a.id)).map(a => ({ assetId: a.id, localOfficialAsset: a.source, fingerprint: a.fingerprint, productId: a.productId, factDate: a.factDate, renderedText: a.renderedText })), note: '图片来自本地收录的同型号官方素材；事实中的URL为正文事实来源，不冒充图片原始下载URL。' }, null, 2));
  files['README.txt'] = strToU8('门店五渠道内容交付\n图片模式：official-layout（官方产品图排版，未调用AI图片服务）。\n发布前请核对门店信息。素材缺失或已失效时仅交付文字，明细见manifest.json的missingImages。\n核验基于收录的事实快照，不代表实时价格或库存。');
  return Buffer.from(zipSync(files));
}
