import { useState } from "react";
import { api, type Platform, type TaskSnapshot } from "@/lib/api";

const platforms: Platform[] = ["xiaohongshu", "moments", "wechat-mp", "poster", "video"];

export default function ExportDelivery({ snapshot, selections, onSelect }: { snapshot: TaskSnapshot; selections: Partial<Record<Platform, string>>; onSelect: (platform: Platform, variantId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = Object.fromEntries(platforms.map(platform => {
    const channel = snapshot.channels[platform];
    const requested = channel.variants.find(variant => variant.id === selections[platform]);
    const recommended = channel.variants.find(variant => variant.id === channel.recommended?.id);
    return [platform, requested?.id || channel.variants.find(variant => variant.selected)?.id || recommended?.id || channel.variants[0]?.id || ""];
  })) as Record<Platform, string>;
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "content-delivery.zip"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const exportZip = async () => {
    setBusy(true); setMessage("");
    try {
      const blob = await api.exportContent(snapshot.task.id, selected);
      const file = new File([blob], "content-delivery.zip", { type: "application/zip" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "五渠道图文交付" }); setMessage("已交给系统分享。"); return; }
        catch (error) { if (error instanceof Error && error.name === "AbortError") { setMessage("已取消分享，可再次导出。"); return; } }
      }
      download(blob); setMessage("ZIP 已准备下载；未生成或失效配图会在清单中列明。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "导出失败，请重试"); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 min-w-0 border-t border-[var(--line)] pt-4" aria-label="五渠道交付">
    <h3 className="text-[13px] font-medium">五渠道图文 ZIP</h3>
    <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">选择每个渠道的角度，导出正文、已生成配图及事实来源。缺图时可先交付文字，核验未过的版本需修正。</p>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{platforms.map(platform => <label key={platform} className="min-w-0 text-[11px]">{snapshot.channels[platform].label}<select className="field mt-1 w-full min-w-0" value={selected[platform]} onChange={event => onSelect(platform, event.target.value)}>{!snapshot.channels[platform].variants.length && <option value="">等待生成</option>}{snapshot.channels[platform].variants.map(v => <option key={v.id} value={v.id}>{v.angleLabel}{v.verification.blocked ? " · 核验未过" : ""}</option>)}</select></label>)}</div>
    <button className="btn-primary mt-3" disabled={busy || platforms.some(p => !selected[p])} onClick={() => void exportZip()}>{busy ? "正在打包…" : "分享 / 下载五渠道 ZIP"}</button>
    {message && <p role="status" className="mt-2 break-words text-[12px] leading-6">{message}</p>}
  </section>;
}
