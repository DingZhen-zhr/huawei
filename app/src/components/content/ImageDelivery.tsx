import { useState } from "react";
import { api, type ContentAsset, type Variant } from "@/lib/api";

export default function ImageDelivery({ taskId, variant, assets, onRefresh }: { taskId: string; variant: Variant; assets: ContentAsset[]; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const images = assets.filter(a => a.variantId === variant.id);
  const generate = async () => {
    setBusy(true); setMessage("");
    try { await api.generateImages(taskId, variant.id); await onRefresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "图片生成失败，可重试"); }
    finally { setBusy(false); }
  };
  const download = async (asset: ContentAsset) => {
    try {
      const blob = await api.downloadImage(taskId, asset.id);
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${variant.platform}-${asset.index + 1}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setMessage(error instanceof Error ? error.message : "下载失败，请重试"); await onRefresh(); }
  };
  return <section className="mt-5 min-w-0 border-t border-[var(--line)] pt-4" aria-label="图片交付">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-[13px] font-medium">图片交付</h3><button className="btn-secondary" disabled={busy || variant.verification.blocked} onClick={() => void generate()}>{busy ? "正在排版…" : images.length ? "重新生成本版配图" : "生成本版全部配图"}</button></div>
    <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">官方产品图排版 · official-layout · 未调用 AI 图片服务。保持同型号产品全貌，暂缺素材会明确提示。</p>
    {images.some(a => a.status === "stale") && <p role="status" className="mt-2 text-[12px] text-[var(--warning)]">文案、门店资料或素材已变化，旧图已失效，请重新生成。</p>}
    <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map(asset => <div key={asset.id} className="min-w-0 border border-[var(--line)] p-3">
        {asset.status === "ready" && asset.downloadUrl ? <><img src={asset.downloadUrl} alt={`官方排版配图 ${asset.index + 1}`} className="max-h-80 w-full object-contain" /><button className="btn-secondary mt-2 w-full" onClick={() => void download(asset)}>下载 PNG · {asset.width}×{asset.height}</button></> : <p className="text-[12px] leading-6">{asset.status === "stale" ? "旧图已失效" : asset.error || "图片不可用，请重新生成"}</p>}
      </div>)}
    </div>
    {message && <p role="alert" className="mt-2 break-words text-[12px] leading-6 text-[var(--danger)]">{message}</p>}
  </section>;
}
