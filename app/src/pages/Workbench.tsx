import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { downloadImage, renderImages, type RenderedImage } from "@/lib/render-images";
import { buildPack, shareOrDownload } from "@/lib/export-pack";
import {
  api,
  type ChannelSnapshot,
  type Platform,
  type TaskSnapshot,
  type Variant,
} from "@/lib/api";

const PLATFORM_ORDER: Platform[] = ["xiaohongshu", "moments", "wechat-mp", "poster", "video"];
const PLATFORM_NAMES: Record<Platform, string> = {
  xiaohongshu: "小红书",
  moments: "朋友圈",
  "wechat-mp": "公众号",
  poster: "海报",
  video: "视频号",
};

function sourceName(source: string) {
  return String(source || "").split("/").pop() || source;
}

function angleName(label: string) {
  return ({ "痛点切入": "哪里不好用", "避坑与选择": "怎么选", "真实场景故事": "店里故事" } as Record<string, string>)[label] || label;
}

function trustLabel(tier: number) {
  if (tier <= 2) return "官方资料";
  if (tier === 3) return "整理资料";
  return "参考来源";
}

function generationLabel(mode?: string) {
  if (!mode) return "不知道是怎么写的";
  if (mode.startsWith("model:")) return `模型写的（${mode.slice(6)}）`;
  if (mode === "mixed") return "一半模型，一半模板";
  if (mode === "rules-v1") return "模板稿（模型没跑成）";
  if (mode.startsWith("queued:")) return `排队中（${mode.slice(7)}）`;
  return mode;
}

function textBlocks(text: string) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {textBlocks(text).map((block, index) => {
        const heading = /^(一|二|三|四|五)[、.．]/.test(block) && block.length < 48;
        return heading ? (
          <h3 key={index} className="pt-2 text-[15px] font-semibold leading-6">{block}</h3>
        ) : (
          <p key={index} className="whitespace-pre-wrap text-[14px] leading-[1.95] text-[var(--ink)]">{block}</p>
        );
      })}
    </div>
  );
}

function PlatformPreview({ variant, task, variantIndex }: { variant: Variant; task: TaskSnapshot["task"]; variantIndex: number }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const image = task.productAsset;
  const fit = task.productAssetFit || "cover";

  if (variant.platform === "xiaohongshu") {
    return (
      <article className="mx-auto w-full max-w-[664px] border-t-2 border-[var(--ink)] bg-white px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex items-baseline justify-between gap-4">
          <span className="mono text-[8.5px] tracking-[0.12em] text-[var(--muted-2)]">小红书 · 第 {String(variantIndex).padStart(2, "0")} 条</span>
          <span className="mono text-[8.5px] tracking-[0.1em] text-[var(--muted-2)]">{task.productShortName} / {task.scene}</span>
        </div>
        <div className="relative mt-4 h-[260px] overflow-hidden bg-[#e7e3dc] sm:h-[286px]">
          {image && !coverFailed ? (
            <img src={image} alt="" className="h-full w-full" style={{ objectFit: fit }} onError={() => setCoverFailed(true)} />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-[var(--muted)]">官方图还没到</div>
          )}
        </div>
        <h1 className="mt-6 max-w-[560px] text-[26px] font-bold leading-[1.35] tracking-[-0.035em] sm:text-[30px]">{variant.title}</h1>
        <p className="mono mt-2 text-[9px] tracking-[0.06em] text-[var(--muted)]">{task.productShortName} · 店里的事</p>
        <div className="mt-5 max-w-[560px]">
          <Paragraphs text={variant.body} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1">
          {(variant.tags || []).map((tag) => (
            <span key={tag} className="text-[11.5px] text-[#335a7a]">#{tag}</span>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--line)] pt-3 text-[10.5px] leading-5 text-[var(--muted)]">
          {variant.cta}
        </div>
      </article>
    );
  }

  if (variant.platform === "moments") {
    return (
      <div className="mx-auto w-full max-w-[440px] border border-[var(--line)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--ink)] text-[10px] font-semibold text-white">华采</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">门店同事</p>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-black/80">{variant.body}</p>
            {image && (
              <div className="mt-3 grid grid-cols-3 gap-1">
                {[0, 1, 2].slice(0, 3).map((i) => (
                  <div key={i} className="aspect-square overflow-hidden bg-[#eee9e1]">
                    <img src={image} alt="" className="h-full w-full" style={{ objectFit: fit }} loading="lazy" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[10px] text-[var(--muted-2)]">
              <span>刚刚</span>
              <span>到店看实物</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant.platform === "wechat-mp") {
    return (
      <article className="mx-auto w-full max-w-[620px] border-t-2 border-[var(--ink)] bg-white px-5 py-6 sm:px-8 sm:py-8">
        <div className="border-b border-[var(--line)] pb-5">
          <p className="mono text-[8.5px] tracking-[0.1em] text-[var(--muted-2)]">华采智营 · 门店内容</p>
          <h2 className="mt-2 text-[24px] font-bold leading-[1.35] tracking-[-0.03em]">{variant.title}</h2>
          <p className="mt-2 text-[10px] text-[var(--muted)]">资料截至 2026-10-17</p>
        </div>
        {image && (
          <div className="mt-5 h-[220px] overflow-hidden bg-[#eee9e1]">
            <img src={image} alt="" className="h-full w-full" style={{ objectFit: fit }} />
          </div>
        )}
        <div className="mt-6">
          {variant.summary && <p className="mb-5 border-l-2 border-[var(--red)] pl-3 text-[11.5px] leading-6 text-[var(--muted)]">{variant.summary}</p>}
          <Paragraphs text={variant.body} />
        </div>
      </article>
    );
  }

  if (variant.platform === "poster") {
    return (
      <div className="mx-auto w-full max-w-[370px] bg-[#111] p-3">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#161616] text-white">
          {image && (
            <img src={image} alt="" className="absolute inset-0 h-full w-full opacity-55" style={{ objectFit: fit }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/90" />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center justify-between text-[9px] text-white/55">
              <span className="mono">HUAWEI STORE</span>
              <span>官方图</span>
            </div>
            <div>
              <div className="mb-3 h-[3px] w-12 bg-[var(--red)]" />
              <h2 className="max-w-[9ch] text-[34px] font-semibold leading-[1.08] tracking-[-0.03em]">{variant.title}</h2>
              <div className="mt-5 space-y-1.5 text-[13px] leading-5 text-white/78">
                {variant.body.split("\n").slice(0, 4).map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="text-[9px] leading-4 text-white/45">
                <p>产品信息来自官方公开资料</p>
                <p>价格与活动以门店为准</p>
              </div>
              <div className="flex h-[72px] w-[72px] items-center justify-center border border-dashed border-white/25 text-center text-[8px] leading-3 text-white/40">
                二维码<br />待配置
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden bg-[#101010] text-white">
        {image && <img src={image} alt="" className="absolute inset-0 h-full w-full opacity-45" style={{ objectFit: fit }} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />
        <div className="relative flex h-full flex-col justify-between p-4">
          <span className="mono w-fit bg-black/45 px-2 py-1 text-[9px] text-white/70">视频号 · 9:16</span>
          <div>
            <span className="flex h-10 w-10 items-center justify-center border border-white/40 bg-black/20">
              <Play className="ml-0.5 h-4 w-4 fill-white" />
            </span>
            <p className="mt-3 text-[10px] text-white/55">首 3 秒</p>
            <h2 className="mt-1 text-[22px] font-semibold leading-7">{variant.title}</h2>
          </div>
        </div>
      </div>
      <div className="border border-[var(--line)] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium">口播与分镜</h3>
          <span className="mono text-[10px] text-[var(--muted)]">45–60 秒</span>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-[12.5px] leading-7">{variant.script || variant.body}</div>
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="text-[11px] font-medium">分镜</p>
          <ol className="mt-2 space-y-2">
            {(variant.shotList || []).map((shot, index) => (
              <li key={index} className="flex gap-2 text-[11px] leading-5 text-[var(--muted)]">
                <span className="mono shrink-0 text-[var(--muted-2)]">{String(index + 1).padStart(2, "0")}</span>
                <span>{shot}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function RiskBlock({ snapshot, variant }: { snapshot: TaskSnapshot; variant: Variant }) {
  const conflict = snapshot.conflicts[0];
  return (
    <div className="space-y-5">
      {conflict && (
        <div className="border-t-2 border-[var(--warning)] pt-3">
          <p className="text-[12px] font-semibold text-[var(--warning)]">价格先不写</p>
          <p className="mt-1.5 text-[10.5px] leading-5 text-[var(--muted)]">
            {conflict.candidates.map((c) => `¥${c.value.toLocaleString("zh-CN")}`).join(" / ")} 还没核实，带价的先不发。管理员确认后再写。
          </p>
        </div>
      )}
      {variant.verification.blocked && (
        <div className="border-t-2 border-[var(--danger)] pt-3">
          <p className="text-[12px] font-semibold text-[var(--danger)]">这版先别发</p>
          <ul className="mt-1.5 space-y-1 text-[10.5px] leading-5 text-[var(--muted)]">
            {variant.verification.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      {!variant.verification.blocked && (
        <div className="border-t-2 border-[var(--red)] pt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--red)]" /> 数字和说法都核对过</p>
          <p className="mt-1.5 text-[10.5px] leading-5 text-[var(--muted)]">
            {conflict
              ? "这版没写价。规格和场景都核过，价格等管理员确认。"
              : snapshot.task.priceStatus === "reference"
                ? "这版没写价：只有官网参考价，不是现在能买到的价。规格和场景核过。"
                : "价格、规格和活动都能对上同型号资料。发之前再确认门店实际报价和库存。"}
          </p>
        </div>
      )}
      {variant.copyQuality.issues.length > 0 && (
        <div className="border-t border-[var(--line)] pt-3">
          <p className="text-[12px] font-semibold">还有 {variant.copyQuality.issues.length} 句像套话</p>
          <div className="mt-1.5 space-y-2">
            {variant.copyQuality.issues.slice(0, 2).map((issue, index) => (
              <div key={`${issue.term}-${index}`} className="text-[10px] leading-5 text-[var(--muted)]">
                <p>“{issue.sentence}”</p>
                <p className="mt-0.5 text-[var(--info)]">{issue.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FactRow({ fact, index }: { fact: TaskSnapshot["evidence"][number]; index: number }) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-1.5 border-b border-[var(--line)] py-2">
      <span className="mono pt-0.5 text-[8px] text-[var(--red)]">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <p className="text-[10.5px] leading-5 text-[var(--ink)]">{String(fact.value)}</p>
        <p className="mt-0.5 flex flex-wrap gap-2 text-[8.5px] text-[var(--muted-2)]">
          <span className="mono">{fact.capturedAt}</span>
          <span>{sourceName(fact.sourceTitle)}</span>
          <span>{trustLabel(fact.trustTier)}</span>
        </p>
      </div>
    </div>
  );
}

function EvidencePanel({ snapshot, variant }: { snapshot: TaskSnapshot; variant: Variant }) {
  const selectedIds = new Set(variant.evidenceIds || []);
  const selected = snapshot.evidence.filter((f) => selectedIds.has(f.id));
  const fallback = snapshot.evidence.filter((f) => !selectedIds.has(f.id));
  const facts = [...selected, ...fallback].slice(0, Math.min(snapshot.evidence.length, Math.max(3, selected.length)));
  return (
    <div>
      <div className="border-t border-[var(--line)] pt-3">
        <p className="text-[12px] font-semibold">店里补的那句话</p>
        <p className="mt-2 border-l-2 border-[var(--red)] pl-3 text-[11px] leading-6 text-[var(--muted)]">{snapshot.task.realDetail.text}</p>
        <p className="mt-1 pl-3 text-[9px] leading-5 text-[var(--muted-2)]">这是店员说的，没有当成官方参数。</p>
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-3">
        <p className="flex items-baseline justify-between text-[12px] font-semibold">
          这版用到的资料
          <span className="mono text-[9px] font-normal text-[var(--muted-2)]">{facts.length} 条</span>
        </p>
        <div className="mt-1">
          {facts.slice(0, 3).map((fact, index) => <FactRow key={fact.id} fact={fact} index={index} />)}
        </div>
        {facts.length > 3 && (
          <details className="mt-1">
            <summary className="cursor-pointer border-b border-[var(--line)] py-2 text-[9.5px] text-[var(--muted)] hover:text-[var(--ink)]">
              展开另外 {facts.length - 3} 条
            </summary>
            <div>
              {facts.slice(3).map((fact, index) => <FactRow key={fact.id} fact={fact} index={index + 3} />)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function ImageStudio({
  snapshot,
  images,
  busy,
  onGenerate,
}: {
  snapshot: TaskSnapshot;
  images: RenderedImage[];
  busy: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="border-t border-[var(--line)] pt-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-semibold">配图</p>
        <span className="mono text-[9px] text-[var(--muted-2)]">官方图 + 排版</span>
      </div>
      {!snapshot.task.hasAssets && (
        <p className="mt-2 border-l-2 border-[var(--warning)] pl-2 text-[10px] leading-5 text-[var(--warning)]">
          这个型号还没官方图。先补图，文字和导出照常。
        </p>
      )}
      {images.length > 0 ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => downloadImage(image)}
                className="group relative overflow-hidden border border-[var(--line)] bg-[#eee9e1]"
                title={`下载 ${image.label}`}
              >
                <img src={image.dataUrl} alt={image.label} className="aspect-[3/4] h-full w-full bg-[#f5efe5] object-contain" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-1 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  下载
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4">
            <button type="button" className="flex items-center justify-between border-b border-[var(--line)] py-2 text-[10.5px] hover:text-[var(--red)]" onClick={onGenerate} disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>重做</span>}
              <RefreshCw className="h-3 w-3 text-[var(--red)]" />
            </button>
            {images.slice(0, 3).map((image) => (
              <button key={`dl-${image.id}`} type="button" className="flex items-center justify-between border-b border-[var(--line)] py-2 text-[10.5px] hover:text-[var(--red)]" onClick={() => downloadImage(image)}>
                <span className="truncate">{image.label.split(" ")[0]}</span>
                <Download className="h-3 w-3 text-[var(--red)]" />
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" className="mt-2 flex w-full items-center justify-between border-b border-[var(--line)] py-2 text-[11px] hover:text-[var(--red)]" onClick={onGenerate} disabled={busy}>
          <span>{busy ? "正在出图" : "出这版的图"}</span>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 text-[var(--red)]" />}
        </button>
      )}
      <p className="mt-2 text-[9px] leading-5 text-[var(--muted-2)]">
        用官方产品图和模板排版，不改产品外观，不画二维码。没配二维码就留白。可以单张下载，也可以打包。
      </p>
    </div>
  );
}

function ChannelList({
  snapshot,
  platform,
  onPick,
}: {
  snapshot: TaskSnapshot;
  platform: Platform;
  onPick: (platform: Platform) => void;
}) {
  return (
    <div>
      {PLATFORM_ORDER.map((key, index) => {
        const channel = snapshot.channels[key];
        const error = snapshot.errors.find((e) => e.platform === key);
        const active = key === platform;
        const count = channel.variants.length || (error ? "失败" : "…");
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={`grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-[var(--line)] py-3 text-left transition-colors ${
              active
                ? "-ml-3 border-l-[3px] border-l-[var(--red)] pl-3 font-semibold text-[var(--ink)]"
                : "text-[#96928b] hover:text-[var(--ink)]"
            }`}
          >
            <span className={`mono text-[8.5px] ${active ? "text-[var(--red)]" : "text-[var(--muted-2)]"}`}>{String(index + 1).padStart(2, "0")}</span>
            <span className="flex items-center gap-2 text-[15.5px]">
              <span className={`h-1.5 w-1.5 shrink-0 ${channel.status === "ready" ? "bg-[var(--success)]" : channel.status === "blocked" ? "bg-[var(--danger)]" : error ? "bg-[var(--danger)]" : "bg-[var(--muted-2)]"}`} />
              {PLATFORM_NAMES[key]}
            </span>
            <span className={`mono text-[9.5px] ${active ? "text-[var(--red)]" : "text-[var(--muted-2)]"}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Workbench() {
  const { taskId = "" } = useParams();
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState<Platform>("xiaohongshu");
  const [variantId, setVariantId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", tags: "", script: "" });
  const [busy, setBusy] = useState<"copy" | "save" | "rewrite" | "retry" | null>(null);
  const [images, setImages] = useState<Record<string, RenderedImage[]>>({});
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<"evidence" | "risk" | "images" | null>(null);

  const refresh = async (quiet = false) => {
    if (!taskId) return;
    try {
      const next = await api.getTask(taskId);
      setSnapshot(next);
      setError("");
      if (!quiet) setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "内容没加载出来");
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    setImages({});
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!snapshot || !["queued", "running"].includes(snapshot.task.status)) return;
    let closed = false;
    const source = new EventSource(`/api/content/tasks/${taskId}/events`);
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!closed) void refresh(true); }, 550);
    };
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "variant" || data.type === "stage" || data.type === "done" || data.type === "error") schedule();
      } catch {
        /* ignore malformed event */
      }
    };
    source.onerror = () => source.close();
    const poll = window.setInterval(() => { if (!closed) void refresh(true); }, 2600);
    return () => {
      closed = true;
      source.close();
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.task.status, taskId]);

  useEffect(() => {
    if (!snapshot) return;
    const channel = snapshot.channels[platform];
    const current = snapshot.variants.find((v) => v.id === variantId && v.platform === platform);
    if (!current && channel.recommended) setVariantId(channel.recommended.id);
  }, [platform, snapshot, variantId]);

  const currentChannel: ChannelSnapshot | undefined = snapshot?.channels[platform];
  const activeVariant = useMemo(() => {
    if (!snapshot || !currentChannel) return null;
    return currentChannel.variants.find((v) => v.id === variantId) || currentChannel.recommended || currentChannel.variants[0] || null;
  }, [snapshot, currentChannel, variantId]);

  useEffect(() => {
    if (!activeVariant || editing) return;
    setDraft({
      title: activeVariant.title || "",
      body: activeVariant.body || "",
      tags: (activeVariant.tags || []).join(" "),
      script: activeVariant.script || "",
    });
  }, [activeVariant, editing]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const pickPlatform = (next: Platform) => {
    setPlatform(next);
    setEditing(false);
    setNotice("");
    const recommended = snapshot?.channels[next]?.recommended;
    setVariantId(recommended?.id || snapshot?.channels[next]?.variants[0]?.id || "");
  };

  const pickAngle = (variant: Variant) => {
    setVariantId(variant.id);
    setEditing(false);
    setNotice("");
  };

  const copy = async () => {
    if (!activeVariant) return;
    if (activeVariant.verification.blocked) {
      setNotice("这版有问题，改完才能复制。");
      return;
    }
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(activeVariant.copyText);
      setNotice("复制好了。发之前再看一眼门店信息。");
      window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setNotice("浏览器不让复制，长按选中文字。");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!activeVariant) return;
    setBusy("save");
    setNotice("");
    try {
      const tags = draft.tags.split(/\s+/).map((x) => x.replace(/^#/, "").trim()).filter(Boolean);
      await api.updateVariant(taskId, activeVariant.id, {
        title: draft.title,
        body: draft.body,
        tags,
        script: draft.script,
      });
      setEditing(false);
      setImages((prev) => {
        const next = { ...prev };
        delete next[activeVariant.id];
        return next;
      });
      await refresh(true);
      setNotice("改好了，又核了一遍。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(null);
    }
  };

  const rewrite = async (instruction: string) => {
    if (!activeVariant) return;
    setBusy("rewrite");
    setNotice("");
    try {
      const result = await api.rewrite(taskId, activeVariant.id, instruction);
      setEditing(false);
      setImages((prev) => {
        const next = { ...prev };
        delete next[activeVariant.id];
        return next;
      });
      await refresh(true);
      setNotice(result.rewriteMode === "llm" ? "改好了，又核了一遍。" : "模型没返回，先用本地规则去套话，也重新核过了。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "改写失败");
    } finally {
      setBusy(null);
    }
  };

  const generateImages = async (variant: Variant, targetPlatform: Platform) => {
    if (!snapshot) return;
    setImageBusy(variant.id);
    setNotice("");
    try {
      const rendered = await renderImages({
        platform: targetPlatform,
        variant,
        task: snapshot.task,
        facts: snapshot.evidence,
      });
      setImages((prev) => ({ ...prev, [variant.id]: rendered }));
      setNotice(`出了 ${rendered.length} 张图，可以单张下，也可以打包。`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "配图生成失败");
    } finally {
      setImageBusy(null);
    }
  };

  const exportPack = async () => {
    if (!snapshot) return;
    setExportBusy(true);
    setNotice("");
    try {
      const map: Record<string, RenderedImage[]> = { ...images };
      for (const key of PLATFORM_ORDER) {
        const channel = snapshot.channels[key];
        const variant = channel?.variants.find((item) => item.selected) || channel?.recommended || channel?.variants[0];
        if (variant && !map[variant.id]) {
          map[variant.id] = await renderImages({
            platform: key,
            variant,
            task: snapshot.task,
            facts: snapshot.evidence,
          });
        }
      }
      const { blob, missing } = await buildPack({ snapshot, images: map });
      const result = await shareOrDownload(blob, `huacai-${snapshot.task.id.slice(0, 8)}.zip`);
      setImages(map);
      setNotice(
        result === "shared"
          ? "打开系统分享了。"
          : `打包好了${missing.length ? `（${missing.length} 项待补，清单里有）` : ""}。`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExportBusy(false);
    }
  };

  const retry = async () => {
    setBusy("retry");
    setNotice("");
    try {
      await api.retry(taskId, platform);
      setNotice(`只重写了${PLATFORM_NAMES[platform]}，别的没动。`);
      await refresh(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "重试失败");
    } finally {
      setBusy(null);
    }
  };

  const channelError = snapshot?.errors.find((e) => e.platform === platform);
  const isRunning = snapshot ? ["queued", "running"].includes(snapshot.task.status) : false;

  return (
    <AppShell wide flush hideRail>
      {loading && (
        <div className="grid min-h-[520px] place-items-center">
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> 正在打开</div>
        </div>
      )}

      {error && !loading && (
        <div className="p-5 sm:p-8">
          <div className="border border-[var(--danger)] bg-[var(--danger-soft)] p-5">
            <p className="text-[13px] font-medium">这条内容没打开</p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{error}</p>
            <button className="btn-secondary mt-4" onClick={() => void refresh()}>重试</button>
          </div>
        </div>
      )}

      {snapshot && !loading && (
        <div className="min-h-[calc(100dvh-74px)] md:grid md:grid-cols-[226px_minmax(0,1fr)] lg:grid-cols-[226px_minmax(0,1fr)_350px]">
          <aside className="hidden border-r border-[var(--line)] px-4 py-7 md:sticky md:top-[74px] md:flex md:h-[calc(100dvh-74px)] md:flex-col md:overflow-y-auto md:pl-6 md:pr-5 lg:pl-8">
            <Link to="/" className="mono inline-flex items-center gap-1.5 text-[9px] tracking-[0.1em] text-[var(--muted)] hover:text-[var(--red)]">
              <ArrowLeft className="h-3 w-3" /> 今天
            </Link>

            <div className="mt-8">
              <p className="mono-label">{snapshot.task.productShortName}</p>
              <h1 className="mt-1.5 text-[28px] font-bold leading-[1.08] tracking-[-0.04em]">这条内容</h1>
              <p className="mt-2 text-[10.5px] leading-5 text-[var(--muted)]">{snapshot.task.audience} · {snapshot.task.scene}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold">
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--red)]" /> : <Check className="h-3.5 w-3.5 text-[var(--red)]" />}
                {snapshot.task.progress.label}
              </div>
            </div>

            <div className="mt-8 border-t-2 border-[var(--ink)] pt-1">
              <ChannelList snapshot={snapshot} platform={platform} onPick={pickPlatform} />
            </div>

            <div className="mt-auto border-t border-[var(--line)] pt-3">
              <p className="mono-label">怎么写的</p>
              <p className="mt-1.5 text-[10px] leading-5 text-[var(--muted)]">{generationLabel(snapshot.task.generationMode)}</p>
              {(snapshot.task.fallbacks || []).length > 0 && (
                <p className="mt-1 text-[10px] leading-5 text-[var(--warning)]">
                  {(snapshot.task.fallbacks || []).length} 个渠道模型没跑成，退回模板稿
                </p>
              )}
              <p className="mt-3 text-[9.5px] leading-5 text-[var(--muted-2)]">内容存 30 天。价格和库存以门店当天为准。</p>
            </div>
          </aside>

          <main className="min-w-0 border-[var(--line)] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-10 lg:border-r">
            <div className="border-b-2 border-[var(--ink)] px-4 py-5 sm:px-8">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="mono-label">渠道 {String(PLATFORM_ORDER.indexOf(platform) + 1).padStart(2, "0")} / {platform === "poster" ? "海报" : platform === "video" ? "视频" : "图文"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-[40px] font-bold leading-none tracking-[-0.045em] sm:text-[54px]">{PLATFORM_NAMES[platform]}</h1>
                    <span className={`tag-square ${activeVariant?.status === "blocked" ? "border-[var(--danger)] text-[var(--danger)]" : activeVariant?.status === "ready" ? "border-[var(--success)] text-[var(--success)]" : "border-[var(--line-strong)] text-[var(--muted)]"}`}>
                      {activeVariant?.status === "blocked" ? "有点问题" : activeVariant?.status === "ready" ? "能发" : currentChannel?.status === "waiting" ? "还没写" : "在写"}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[10px] text-[var(--muted)]">{snapshot.task.audience} · {snapshot.task.scene} · {snapshot.task.target}</p>
                </div>
                <div className="num shrink-0 pb-1 text-[56px] leading-none text-[var(--red)] sm:text-[88px]">
                  {String(currentChannel?.variants.length || 0).padStart(2, "0")}
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="no-scrollbar flex min-w-0 gap-5 overflow-x-auto">
                  {currentChannel?.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => pickAngle(variant)}
                      className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-1 text-[12px] transition-colors ${
                        variant.id === activeVariant?.id
                          ? "border-[var(--red)] font-semibold text-[var(--ink)]"
                          : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                      }`}
                      aria-pressed={variant.id === activeVariant?.id}
                    >
                      {variant.recommended && <Check className="h-3 w-3 text-[var(--red)]" />}
                      {angleName(variant.angleLabel)}
                      {variant.status === "blocked" && <CircleAlert className="h-3 w-3 text-[var(--danger)]" />}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
                  <button className="icon-button" onClick={() => setDrawer("risk")} aria-label="看风险" title="风险"><ShieldCheck className="h-4 w-4" /></button>
                  <button className="icon-button" onClick={() => setDrawer("evidence")} aria-label="看依据" title="依据"><FileText className="h-4 w-4" /></button>
                  <button className="icon-button" onClick={() => setDrawer("images")} aria-label="看配图" title="配图"><ImageIcon className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-8 sm:py-6">
              {isRunning && !activeVariant && (
                <div className="border border-[var(--line)] bg-white p-5">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> {snapshot.progress.label}</div>
                  <div className="mt-4 h-1 overflow-hidden bg-black/10">
                    <div className="h-full bg-[var(--red)] transition-[width] duration-300" style={{ width: `${Math.max(6, snapshot.progress.percent)}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-[var(--muted)] sm:grid-cols-5">
                    {["查资料", "排结构", "写稿", "审口吻", "核数字"].map((stage) => <span key={stage}>{stage}</span>)}
                  </div>
                </div>
              )}

              {channelError && !activeVariant && (
                <div className="border border-[var(--danger)] bg-[var(--danger-soft)] p-5">
                  <p className="text-[13px] font-medium">这个渠道没写出来</p>
                  <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">{channelError.message}</p>
                  <button className="btn-secondary mt-4" onClick={() => void retry()} disabled={busy === "retry"}>
                    {busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    只重试这个渠道
                  </button>
                </div>
              )}

              {snapshot.task.status === "failed" && !activeVariant && (
                <div className="mt-4 border border-[var(--danger)] bg-[var(--danger-soft)] p-5">
                  <p className="text-[13px] font-medium">这次没写完</p>
                  <ul className="mt-1 space-y-1 text-[11px] leading-5 text-[var(--muted)]">
                    {(snapshot.errors || []).slice(0, 4).map((item, index) => (
                      <li key={`${item.code || "err"}-${index}`}>{item.message}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => void refresh(true)}>
                      <RefreshCw className="h-4 w-4" /> 刷新
                    </button>
                    <Link to={`/create?productId=${snapshot.task.productId}`} className="btn-secondary">
                      重来一条
                    </Link>
                  </div>
                </div>
              )}

              {activeVariant && (
                <>
                  <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden" aria-label="切换渠道">
                    {PLATFORM_ORDER.map((key) => {
                      const channel = snapshot.channels[key];
                      const active = key === platform;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => pickPlatform(key)}
                          className={`chip shrink-0 ${active ? "chip-active" : ""}`}
                          aria-pressed={active}
                        >
                          {PLATFORM_NAMES[key]}
                          <span className="mono text-[9px] opacity-55">{channel.variants.length}</span>
                        </button>
                      );
                    })}
                  </div>

                  <PlatformPreview key={activeVariant.id} variant={activeVariant} task={snapshot.task} variantIndex={Math.max(1, (currentChannel?.variants.findIndex((v) => v.id === activeVariant.id) || 0) + 1)} />

                  <div className="mx-auto mt-4 flex w-full max-w-[664px] flex-wrap items-center gap-2">
                    <button className="btn-primary" onClick={() => void copy()} disabled={busy === "copy" || activeVariant.verification.blocked}>
                      {busy === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      复制这段
                    </button>
                    <button className="btn-secondary" onClick={() => setEditing((v) => !v)}>
                      <PenLine className="h-4 w-4" /> {editing ? "收起" : "改字"}
                    </button>
                    <button className="btn-secondary" onClick={() => void exportPack()} disabled={exportBusy}>
                      {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {exportBusy ? "正在打包" : "打包下载"}
                    </button>
                    {activeVariant.verification.blocked && <span className="text-[10px] text-[var(--danger)]">核对没过，先别复制</span>}
                    {activeVariant.editBurden !== "none" && <span className="text-[10px] text-[var(--muted)]">大概改：{activeVariant.editBurden === "light" ? "一处" : "较多"}</span>}
                  </div>

                  {editing && (
                    <section className="mx-auto mt-4 w-full max-w-[664px] border border-[var(--line-strong)] bg-white p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold">改这一段</p>
                        <span className="text-[9.5px] text-[var(--muted)]">保存后会再核一遍</span>
                      </div>
                      {activeVariant.platform !== "moments" && (
                        <label className="mt-3 block">
                          <span className="field-label">标题</span>
                          <input className="field mt-1" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                        </label>
                      )}
                      {activeVariant.platform === "video" ? (
                        <label className="mt-3 block">
                          <span className="field-label">口播稿</span>
                          <textarea className="field mt-1 min-h-[240px] resize-y" value={draft.script} onChange={(e) => setDraft((d) => ({ ...d, script: e.target.value, body: e.target.value }))} />
                        </label>
                      ) : (
                        <label className="mt-3 block">
                          <span className="field-label">正文</span>
                          <textarea className="field mt-1 min-h-[220px] resize-y" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
                        </label>
                      )}
                      {activeVariant.platform === "xiaohongshu" && (
                        <label className="mt-3 block">
                          <span className="field-label">标签（空格分隔）</span>
                          <input className="field mt-1" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
                        </label>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button className="btn-primary" onClick={() => void save()} disabled={busy === "save"}>
                          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} 保存，再核一遍
                        </button>
                        <button className="btn-quiet" onClick={() => setEditing(false)}>取消</button>
                      </div>
                    </section>
                  )}

                  <div className="mx-auto mt-4 flex w-full max-w-[664px] flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-3">
                    <span className="mr-1 text-[10px] text-[var(--muted)]">改得口语一点：</span>
                    {[
                      ["更口语", "像店里的人说话，句子短一点，删掉套话，别加事实。"],
                      ["换个开头", "从店里一个具体场景开头，事实和细节别动。"],
                      ["删口号", "删掉空泛形容词和口号，只留动作、事实和限制。"],
                    ].map(([label, instruction]) => (
                      <button key={label} className="flex items-center gap-1 border-b border-[var(--line)] py-1 text-[10.5px] text-[var(--muted)] hover:border-[var(--red)] hover:text-[var(--red)]" onClick={() => void rewrite(instruction)} disabled={busy === "rewrite"}>
                        {busy === "rewrite" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {notice && <p role="status" aria-live="polite" className="mx-auto mt-4 w-full max-w-[664px] border-l-2 border-[var(--red)] pl-3 text-[11px] leading-5 text-[var(--muted)]">{notice}</p>}
            </div>
          </main>

          <aside className="hidden px-6 py-7 lg:block">
            <div className="sticky top-[94px]">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[21px] font-bold tracking-[-0.03em]">发之前，核对一下</h2>
                <span className="mono text-[9px] text-[var(--muted-2)]">{String(Math.min(snapshot.evidence.length, Math.max(3, activeVariant?.evidenceIds?.length || 0))).padStart(2, "0")} 条资料</span>
              </div>
              {activeVariant ? (
                <div className="mt-5 space-y-5">
                  <RiskBlock snapshot={snapshot} variant={activeVariant} />
                  <ImageStudio
                    snapshot={snapshot}
                    images={images[activeVariant.id] || []}
                    busy={imageBusy === activeVariant.id}
                    onGenerate={() => void generateImages(activeVariant, platform)}
                  />
                  <EvidencePanel snapshot={snapshot} variant={activeVariant} />
                </div>
              ) : (
                <p className="mt-4 text-[11px] leading-6 text-[var(--muted)]">这个渠道还没写出来。等一会儿，或者只重试这个渠道。</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {drawer && snapshot && activeVariant && (
        <>
          <button type="button" className="drawer-backdrop lg:hidden" aria-label="关闭面板" onClick={() => setDrawer(null)} />
          <section className="drawer-panel lg:hidden" role="dialog" aria-modal="true" aria-label="发布前核对">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">{drawer === "risk" ? "发布前核对" : drawer === "images" ? "配图" : "依据"}</h2>
              <button className="icon-button" onClick={() => setDrawer(null)} aria-label="关闭"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5">
              {drawer === "risk" && <RiskBlock snapshot={snapshot} variant={activeVariant} />}
              {drawer === "evidence" && <EvidencePanel snapshot={snapshot} variant={activeVariant} />}
              {drawer === "images" && (
                <ImageStudio
                  snapshot={snapshot}
                  images={images[activeVariant.id] || []}
                  busy={imageBusy === activeVariant.id}
                  onGenerate={() => void generateImages(activeVariant, platform)}
                />
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
