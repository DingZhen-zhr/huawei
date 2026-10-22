import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProduct } from './ledger.mjs';
import { copyTextFor } from './generator.mjs';
import { verifyContent } from './verifier.mjs';
import { composeImage } from './image-compose.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const mediaDir = path.resolve(here, '../../public/media');
export const MEDIA_RULE_VERSION = 'official-layout-v2';
const ALLOWED = new Map([
  ['matebook-14-harmony', '/media/matebook-14-harmony.png'],
  ['matebook-gt-14', '/media/matebook-gt-14.png'],
  ['matebook-pro-s', '/media/matebook-pro-s.jpg'],
]);
export const PLATFORMS = ['xiaohongshu', 'moments', 'wechat-mp', 'poster', 'video'];
const SIZES = { xiaohongshu: [1080, 1440, 3], moments: [1080, 1080, 1], 'wechat-mp': [900, 383, 1], poster: [1242, 1656, 1], video: [1080, 1920, 1] };
const hash = value => createHash('sha256').update(value).digest('hex');
const error = (status, message, code) => Object.assign(new Error(message), { status, code });

export function authorizeMedia(task, store) {
  if (!task || !store?.id || task.storeId !== store.id) throw error(404, '任务不存在');
  if (!task.expiresAt || Date.parse(task.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(task.expiresAt))) throw error(410, '任务已过期');
}

// One payload drives rendering and all media gates, including fields that a channel's
// plain-copy serializer intentionally omits (notably moments/video titles).
function mediaPayload(task, variant) {
  const product = getProduct(task.productId);
  if (!product) throw error(404, '型号不存在');
  const title = variant.title || product.shortName;
  const subtitle = `${product.shortName} · 官方产品图`;
  const text = [copyTextFor(variant), title, subtitle, variant.body, variant.script,
    variant.summary, variant.cta, ...(variant.tags || []), ...(variant.shotList || []),
    ...(variant.limitations || []), ...(variant.imagePlan || []).flatMap(plan => plan.overlayText || []),
  ].filter(Boolean).join('\n\n');
  return { title, subtitle, text };
}

export function verifyVariant(task, variant) {
  if (!variant) throw error(404, '版本不存在');
  const verification = verifyContent(mediaPayload(task, variant).text, task.productId, { platform: variant.platform });
  if (verification.blocked) throw error(409, '当前文案核验未通过，请修正后重试', 'CONTENT_BLOCKED');
  return verification;
}

function sourceFor(product) {
  if (!product?.asset) return null;
  if (ALLOWED.get(product.id) !== product.asset || !/^\/media\/[a-z0-9.-]+$/.test(product.asset)) throw error(422, '产品素材不在官方白名单');
  const filename = path.resolve(mediaDir, path.basename(product.asset));
  if (path.dirname(filename) !== mediaDir) throw error(422, '无效素材路径');
  return existsSync(filename) ? readFileSync(filename) : null;
}

function plansFor(variant) {
  const fixed = SIZES[variant.platform];
  if (!fixed || variant.imagePlan?.length !== fixed[2] || variant.imagePlan.some(p => p.width !== fixed[0] || p.height !== fixed[1])) throw error(422, '配图计划尺寸或数量无效');
  return variant.imagePlan;
}

function fingerprint(task, store, variant, product, source) {
  return hash(JSON.stringify({ version: MEDIA_RULE_VERSION, taskId: task.id, productId: product.id, copy: copyTextFor(variant), fields: { title: variant.title, body: variant.body, script: variant.script, tags: variant.tags }, plans: variant.imagePlan, asset: product.asset, source: source ? hash(source) : null, facts: product.facts, date: product.snapshotDate, store: { id: store.id, name: store.name, profile: store.profile } }));
}

export function createAssetRepository({ runtimeDir = process.env.HC_RUNTIME_DIR || path.resolve(here, '../data/runtime') } = {}) {
  const dir = path.resolve(runtimeDir, 'content-media');
  const file = path.join(dir, 'assets.json');
  mkdirSync(dir, { recursive: true });
  // Malformed metadata is surfaced rather than silently replacing existing media.
  let rows = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  if (!Array.isArray(rows)) throw new Error('媒体元数据损坏');
  const persist = () => {
    const temp = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(rows, null, 2));
    renameSync(temp, file);
  };
  function current(task, store, variant) {
    const product = getProduct(task.productId);
    if (!product) throw error(404, '型号不存在');
    const source = sourceFor(product);
    return { product, source, fingerprint: fingerprint(task, store, variant, product, source) };
  }
  function list(task, store) {
    authorizeMedia(task, store);
    return rows.filter(row => row.taskId === task.id && row.storeId === store.id).map(row => {
      const variant = task.variants.find(v => v.id === row.variantId);
      const stale = !variant || row.fingerprint !== current(task, store, variant).fingerprint;
      const status = stale ? 'stale' : row.status === 'ready' && !existsSync(path.join(dir, `${row.id}.png`)) ? 'failed' : row.status;
      return { ...row, status, downloadUrl: status === 'ready' ? `/api/content/tasks/${encodeURIComponent(task.id)}/assets/${row.id}/download` : null };
    });
  }
  async function generate(task, store, variantId) {
    authorizeMedia(task, store);
    const variant = task.variants.find(v => v.id === variantId);
    verifyVariant(task, variant);
    const plans = plansFor(variant);
    const state = current(task, store, variant);
    const results = [];
    for (const [index, plan] of plans.entries()) {
      const row = { id: randomUUID(), taskId: task.id, storeId: store.id, variantId, platform: variant.platform, index, purpose: plan.purpose, width: plan.width, height: plan.height, fingerprint: state.fingerprint, mode: 'official-layout', ruleVersion: MEDIA_RULE_VERSION, source: state.product.asset, productId: state.product.id, factDate: state.product.snapshotDate, createdAt: new Date().toISOString(), status: 'unavailable' };
      if (state.source) {
        try {
          const payload = mediaPayload(task, variant);
          const png = await composeImage({ source: state.source, width: plan.width, height: plan.height, title: payload.title, subtitle: payload.subtitle });
          // Recheck after async rendering: an edit during generation never publishes an obsolete PNG as ready.
          verifyVariant(task, variant);
          if (state.fingerprint !== current(task, store, variant).fingerprint) throw error(409, '文案已变化，请重新生成');
          const target = path.join(dir, `${row.id}.png`), temp = `${target}.tmp`;
          writeFileSync(temp, png); renameSync(temp, target);
          row.status = 'ready'; row.byteLength = png.length;
        } catch (e) {
          row.status = 'failed'; row.error = e.message;
          if (e.status === 409) throw e;
        }
      } else row.error = '该型号尚无已收录的官方产品素材，暂不可生成';
      results.push(row);
    }
    rows = rows.filter(row => !(row.taskId === task.id && row.storeId === store.id && row.variantId === variantId));
    rows.push(...results); persist();
    return list(task, store).filter(row => row.variantId === variantId);
  }
  async function download(task, store, assetId) {
    authorizeMedia(task, store);
    if (!/^[0-9a-f-]{36}$/.test(String(assetId))) throw error(404, '图片不存在');
    const row = list(task, store).find(a => a.id === assetId);
    if (!row) throw error(404, '图片不存在');
    verifyVariant(task, task.variants.find(v => v.id === row.variantId));
    if (row.status !== 'ready') throw error(409, '图片已失效或不可用，请重新生成');
    return readFileSync(path.join(dir, `${row.id}.png`));
  }
  return { list, generate, download };
}

let defaultRepository;
export const assetRepository = () => defaultRepository ||= createAssetRepository();
