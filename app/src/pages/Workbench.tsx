import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Copy,
  FileText,
  Image as ImageIcon,
  Layers3,
  Loader2,
  PenLine,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
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

function statusTone(status: string) {
  if (status === "blocked") return "bg-[var(--danger-soft)] text-[var(--danger)]";
  if (status === "ready") return "bg-[var(--success-soft)] text-[var(--success)]";
  if (status === "failed") return "bg-[var(--danger-soft)] text-[var(--danger)]";
  return "bg-[var(--warning-soft)] text-[var(--warning)]";
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
          <p key={index} className="whitespace-pre-wrap text-[13px] leading-7 text-[var(--ink)]">{block}</p>
        );
      })}
    </div>
  );
}

function PlatformPreview({ variant, task }: { variant: Variant; task: TaskSnapshot["task"] }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const image = task.productAsset;

  if (variant.platform === "xiaohongshu") {
    return (
      <div className="mx-auto w-full max-w-[430px] bg-[#f6f1ea] p-3 sm:p-5">
        <div className="overflow-hidden bg-white shadow-[0_10px_36px_-26px_rgba(0,0,0,.38)]">
          <div className="relative aspect-[3/4] bg-[#e9e3da]">
            {image && !coverFailed ? (
              <img src={image} alt="" className="h-full w-full object-cover" onError={() => setCoverFailed(true)} />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-[var(--muted)]">官方产品图未就位</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 pt-24 text-white">
              <p className="text-[20px] font-semibold leading-7">{variant.title}</p>
              <p className="mt-2 text-[11px] text-white/75">{task.productShortName} · 门店真实场景</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <Paragraphs text={variant.body} />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(variant.tags || []).map((tag) => (
                <span key={tag} className="text-[11.5px] text-[#335a7a]">#{tag}</span>
              ))}
            </div>
            <div className="mt-4 border-t border-black/8 pt-3 text-[10.5px] leading-5 text-[var(--muted)]">
              {variant.cta}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant.platform === "moments") {
    return (
      <div className="mx-auto w-full max-w-[420px] bg-[#e9e5df] p-3 sm:p-5">
        <div className="bg-white p-4 shadow-[0_10px_36px_-28px_rgba(0,0,0,.4)]">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[var(--ink)] text-[10px] font-semibold text-white">华采</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">门店同事</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-black/80">{variant.body}</p>
              {image && (
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {[0, 1, 2].slice(0, 3).map((i) => (
                    <div key={i} className="aspect-square overflow-hidden bg-[#eee9e1]">
                      <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-black/6 pt-2 text-[10px] text-black/35">
                <span>刚刚</span>
                <span>到店看实物</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant.platform === "wechat-mp") {
    return (
      <div className="mx-auto w-full max-w-[620px] bg-white p-4 shadow-[0_10px_36px_-30px_rgba(0,0,0,.28)] sm:p-8">
        <div className="border-b border-black/8 pb-5">
          <p className="text-[10px] text-[var(--muted)]">华采智营 · 门店内容</p>
          <h2 className="mt-2 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em]">{variant.title}</h2>
          <p className="mt-2 text-[11px] text-[var(--muted)]">2026-10-22 · 门店内容副驾驶</p>
        </div>
        {image && (
          <div className="mt-5 aspect-[900/383] overflow-hidden bg-[#eee9e1]">
            <img src={image} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="mt-6">
          {variant.summary && <p className="mb-5 border-l-2 border-[var(--red)] pl-3 text-[12px] leading-6 text-[var(--muted)]">{variant.summary}</p>}
          <Paragraphs text={variant.body} />
        </div>
      </div>
    );
  }

  if (variant.platform === "poster") {
    return (
      <div className="mx-auto w-full max-w-[370px] bg-[#111] p-3 shadow-[0_16px_50px_-30px_rgba(0,0,0,.6)]">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#161616] text-white">
          {image && (
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/90" />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center justify-between text-[9px] text-white/55">
              <span className="mono">HUAWEI STORE</span>
              <span>真实素材</span>
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
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden bg-[#101010] text-white shadow-[0_16px_44px_-32px_rgba(0,0,0,.7)]">
        {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />
        <div className="relative flex h-full flex-col justify-between p-4">
          <span className="w-fit rounded-full bg-black/45 px-2 py-1 text-[9px] text-white/70">视频号 · 9:16</span>
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/20">
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
    <div className="space-y-3">
      {conflict && (
        <div className="border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <div>
              <p className="text-[11.5px] font-medium text-[var(--warning)]">价格字段冻结</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                {conflict.candidates.map((c) => `¥${c.value.toLocaleString("zh-CN")}`).join(" / ")} 未完成 SKU 与页面日期确认。
                所有带价内容先拦下，管理员确认后才恢复。
              </p>
            </div>
          </div>
        </div>
      )}
      {variant.verification.blocked && (
        <div className="border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-3.5">
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
            <div>
              <p className="text-[11.5px] font-medium text-[var(--danger)]">这一版不能复制</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-5 text-[var(--muted)]">
                {variant.verification.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
      {!variant.verification.blocked && (
        <div className="border border-[var(--success)]/20 bg-[var(--success-soft)] p-3.5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
            <div>
              <p className="text-[11.5px] font-medium text-[var(--success)]">数字与承诺已过账本</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                {conflict ? "这一版没有写价格；规格与场景已核验。价格仍需管理员确认后再恢复。" : "价格、规格与商业条件都落到了同型号事实；发布前仍需门店确认实际报价与库存。"}
              </p>
            </div>
          </div>
        </div>
      )}
      {variant.copyQuality.issues.length > 0 && (
        <div className="border border-[var(--info)]/20 bg-[var(--info-soft)] p-3.5">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
            <div>
              <p className="text-[11.5px] font-medium text-[var(--info)]">还有 {variant.copyQuality.issues.length} 处像套话</p>
              <div className="mt-1.5 space-y-2">
                {variant.copyQuality.issues.slice(0, 2).map((issue, index) => (
                  <div key={`${issue.term}-${index}`} className="text-[10.5px] leading-5 text-[var(--muted)]">
                    <p>“{issue.sentence}”</p>
                    <p className="mt-0.5 text-[var(--info)]">{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidencePanel({ snapshot, variant }: { snapshot: TaskSnapshot; variant: Variant }) {
  const selectedIds = new Set(variant.evidenceIds || []);
  const facts = snapshot.evidence.filter((f) => !selectedIds.size || selectedIds.has(f.id));
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium">销售提供的真实细节</p>
        <p className="mt-2 border-l border-[var(--red)] pl-3 text-[12px] leading-6 text-[var(--muted)]">{snapshot.task.realDetail.text}</p>
        <p className="mt-1 pl-3 text-[10px] text-[var(--muted-2)]">标记：销售提供场景 · 未伪装成官方参数</p>
      </div>

      <div className="border-t border-[var(--line)] pt-4">
        <p className="text-[11px] font-medium">这版引用的 {facts.length} 条事实</p>
        <div className="mt-2 divide-y divide-[var(--line)]">
          {facts.slice(0, 8).map((fact) => (
            <div key={fact.id} className="py-2.5">
              <p className="text-[11.5px] leading-5 text-[var(--ink)]">{String(fact.value)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted-2)]">
                <span className="mono">{fact.capturedAt}</span>
                <span>{sourceName(fact.sourceTitle)}</span>
                <span>层级 {fact.trustTier}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-4">
        <p className="text-[11px] font-medium">配图计划</p>
        <div className="mt-2 space-y-2">
          {variant.imagePlan.map((plan, index) => (
            <div key={`${plan.purpose}-${index}`} className="flex items-start gap-2.5 text-[11px] leading-5">
              <ImageIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--muted-2)]" />
              <div>
                <p className="text-[var(--ink)]">{plan.purpose === "cover" ? "封面" : plan.purpose === "poster" ? "海报" : plan.purpose === "video-cover" ? "视频封面" : "场景图"} · {plan.ratio}</p>
                <p className="text-[10px] text-[var(--muted)]">{plan.width}×{plan.height} · 官方产品图 + AI 背景，待按需生成</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-[var(--muted-2)]">图片不阻塞文案；未生成时 manifest 会如实记录。</p>
      </div>
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
    <div className="space-y-1">
      {PLATFORM_ORDER.map((key) => {
        const channel = snapshot.channels[key];
        const error = snapshot.errors.find((e) => e.platform === key);
        const active = key === platform;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={`flex min-h-[48px] w-full items-center justify-between gap-2 rounded-[9px] px-3 text-left transition-colors ${
              active ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
            }`}
          >
            <span className="flex items-center gap-2 text-[12px]">
              <span className={`h-1.5 w-1.5 rounded-full ${channel.status === "ready" ? "bg-[var(--success)]" : channel.status === "blocked" ? "bg-[var(--danger)]" : error ? "bg-[var(--danger)]" : "bg-[var(--muted-2)]"}`} />
              {PLATFORM_NAMES[key]}
            </span>
            <span className={`mono text-[9.5px] ${active ? "text-white/45" : "text-[var(--muted-2)]"}`}>
              {channel.variants.length || (error ? "失败" : "…")}
            </span>
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
      setError(e instanceof Error ? e.message : "任务加载失败");
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
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
      setNotice("这一版被核验拦下了，修正后才能复制。");
      return;
    }
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(activeVariant.copyText);
      setNotice("已复制。粘贴前再确认一次门店信息。");
      window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setNotice("浏览器没有允许复制，请长按选中文字。");
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
      await refresh(true);
      setNotice("已保存并重新核验。");
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
      await refresh(true);
      setNotice(result.rewriteMode === "llm" ? "已改写并重新核验。" : "模型未返回，已用本地去套话并重新核验。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "改写失败");
    } finally {
      setBusy(null);
    }
  };

  const retry = async () => {
    setBusy("retry");
    setNotice("");
    try {
      await api.retry(taskId, platform);
      setNotice(`已只重跑${PLATFORM_NAMES[platform]}，其他渠道不动。`);
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
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> 正在打开任务</div>
        </div>
      )}

      {error && !loading && (
        <div className="p-5 sm:p-8">
          <div className="border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
            <p className="text-[13px] font-medium">任务没有打开</p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{error}</p>
            <button className="btn-secondary mt-4" onClick={() => void refresh()}>重试</button>
          </div>
        </div>
      )}

      {snapshot && !loading && (
        <div className="min-h-[calc(100dvh-64px)] md:grid md:grid-cols-[188px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)_310px]">
          <aside className="hidden border-r border-[var(--line)] px-4 py-6 md:sticky md:top-16 md:flex md:h-[calc(100dvh-64px)] md:flex-col md:overflow-y-auto">
            <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
              <ArrowLeft className="h-3.5 w-3.5" /> 今日
            </Link>
            <div className="mt-5">
              <p className="text-[11px] text-[var(--muted)]">{snapshot.task.productShortName}</p>
              <h1 className="mt-1 text-[17px] font-semibold leading-6 tracking-[-0.02em]">内容包工作台</h1>
              <div className="mt-3 flex items-center gap-2">
                <span className={`status-pill ${statusTone(snapshot.task.status)}`}>
                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {snapshot.task.progress.label}
                </span>
              </div>
            </div>

            <div className="mt-7">
              <p className="mono-label">渠道</p>
              <div className="mt-3"><ChannelList snapshot={snapshot} platform={platform} onPick={pickPlatform} /></div>
            </div>

            <div className="mt-auto border-t border-[var(--line)] pt-4">
              <p className="text-[10.5px] leading-5 text-[var(--muted)]">生成方式</p>
              <p className="mono mt-1 text-[10px] text-[var(--muted-2)]">{snapshot.task.generationMode}</p>
              <p className="mt-3 text-[10.5px] leading-5 text-[var(--muted)]">任务保存 30 天。价格与库存仍以门店实际为准。</p>
            </div>
          </aside>

          <main className="min-w-0 border-r border-[var(--line)] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-10">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link to="/" className="md:hidden"><ArrowLeft className="h-4 w-4 text-[var(--muted)]" /></Link>
                  <h2 className="truncate text-[15px] font-medium">{PLATFORM_NAMES[platform]}</h2>
                  <span className={`status-pill ${statusTone(activeVariant?.status || currentChannel?.status || "waiting")}`}>
                    {activeVariant?.status === "blocked" ? "核验拦下" : activeVariant?.status === "ready" ? "可复制" : currentChannel?.status === "waiting" ? "等待中" : "生成中"}
                  </span>
                </div>
                <p className="mt-1 truncate text-[10.5px] text-[var(--muted)]">
                  {snapshot.task.audience} · {snapshot.task.scene} · {snapshot.task.target}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button className="icon-button lg:hidden" onClick={() => setDrawer("risk")} aria-label="查看风险" title="风险"><ShieldCheck className="h-4 w-4" /></button>
                <button className="icon-button lg:hidden" onClick={() => setDrawer("evidence")} aria-label="查看依据" title="依据"><FileText className="h-4 w-4" /></button>
                <button className="icon-button lg:hidden" onClick={() => setDrawer("images")} aria-label="查看配图计划" title="配图计划"><ImageIcon className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6">
              {isRunning && !activeVariant && (
                <div className="border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> {snapshot.progress.label}</div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/8">
                    <div className="h-full rounded-full bg-[var(--red)] transition-[width] duration-300" style={{ width: `${Math.max(6, snapshot.progress.percent)}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10.5px] text-[var(--muted)] sm:grid-cols-5">
                    {["查资料", "排结构", "写稿", "审口吻", "核数字"].map((stage) => <span key={stage}>{stage}</span>)}
                  </div>
                </div>
              )}

              {channelError && !activeVariant && (
                <div className="border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
                  <p className="text-[13px] font-medium">这个渠道没有生成成功</p>
                  <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">{channelError.message}</p>
                  <button className="btn-secondary mt-4" onClick={() => void retry()} disabled={busy === "retry"}>
                    {busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    只重试这一渠道
                  </button>
                </div>
              )}

              {activeVariant && (
                <>
                  <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden" aria-label="切换渠道">
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
                          <span className="mono text-[9.5px] opacity-55">{channel.variants.length}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                    {currentChannel?.variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => pickAngle(variant)}
                        className={`chip shrink-0 ${variant.id === activeVariant.id ? "chip-active" : ""}`}
                        aria-pressed={variant.id === activeVariant.id}
                      >
                        {variant.recommended && <Check className="h-3 w-3" />}
                        {variant.angleLabel}
                        {variant.status === "blocked" && <CircleAlert className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5">
                    <PlatformPreview key={activeVariant.id} variant={activeVariant} task={snapshot.task} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button className="btn-primary" onClick={() => void copy()} disabled={busy === "copy" || activeVariant.verification.blocked}>
                      {busy === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      复制这一版
                    </button>
                    <button className="btn-secondary" onClick={() => setEditing((v) => !v)}>
                      <PenLine className="h-4 w-4" /> {editing ? "收起编辑" : "编辑文字"}
                    </button>
                    {activeVariant.verification.blocked && <span className="text-[10.5px] text-[var(--danger)]">核验未过，复制已禁用</span>}
                    {activeVariant.editBurden !== "none" && <span className="text-[10.5px] text-[var(--muted)]">预计轻改：{activeVariant.editBurden === "light" ? "一次" : "较大"}</span>}
                  </div>

                  {editing && (
                    <section className="mt-4 border border-[var(--line-strong)] bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-medium">编辑这一版</p>
                        <span className="text-[10px] text-[var(--muted)]">保存后自动重新核验</span>
                      </div>
                      {activeVariant.platform !== "moments" && (
                        <label className="mt-3 block">
                          <span className="field-label">标题</span>
                          <input className="field mt-1" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                        </label>
                      )}
                      {activeVariant.platform === "video" ? (
                        <label className="mt-3 block">
                          <span className="field-label">口播脚本</span>
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
                          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} 保存并核验
                        </button>
                        <button className="btn-quiet" onClick={() => setEditing(false)}>取消</button>
                      </div>
                    </section>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
                    <span className="mr-1 text-[10.5px] text-[var(--muted)]">去一下套话：</span>
                    {[
                      ["更口语", "更像门店销售说话，句子短一点，删掉套话，不要新增事实。",],
                      ["换个开头", "换一个更具体的场景开头，保留事实和真实细节。",],
                      ["删掉口号", "删掉空泛形容词和口号，只留具体动作、事实和限制。",],
                    ].map(([label, instruction]) => (
                      <button key={label} className="chip" onClick={() => void rewrite(instruction)} disabled={busy === "rewrite"}>
                        {busy === "rewrite" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {notice && <p role="status" aria-live="polite" className="mt-4 border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">{notice}</p>}
            </div>
          </main>

          <aside className="hidden px-4 py-6 lg:block">
            <div className="sticky top-[88px] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-medium">依据与风险</h2>
                <Layers3 className="h-4 w-4 text-[var(--muted-2)]" />
              </div>
              {activeVariant ? (
                <>
                  <RiskBlock snapshot={snapshot} variant={activeVariant} />
                  <EvidencePanel snapshot={snapshot} variant={activeVariant} />
                </>
              ) : (
                <p className="text-[11px] leading-6 text-[var(--muted)]">这一渠道还没有可看的版本。先等后台跑完，或只重试这一渠道。</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {drawer && snapshot && activeVariant && (
        <>
          <button type="button" className="drawer-backdrop lg:hidden" aria-label="关闭面板" onClick={() => setDrawer(null)} />
          <section className="drawer-panel lg:hidden" role="dialog" aria-modal="true" aria-label="依据与风险">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">{drawer === "risk" ? "风险" : drawer === "images" ? "配图计划" : "依据"}</h2>
              <button className="icon-button" onClick={() => setDrawer(null)} aria-label="关闭"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5">
              {drawer === "risk" && <RiskBlock snapshot={snapshot} variant={activeVariant} />}
              {drawer === "evidence" && <EvidencePanel snapshot={snapshot} variant={activeVariant} />}
              {drawer === "images" && (
                <div className="space-y-3">
                  {activeVariant.imagePlan.map((plan, index) => (
                    <div key={`${plan.purpose}-${index}`} className="border-b border-[var(--line)] pb-3">
                      <p className="text-[12px] font-medium">{plan.purpose} · {plan.ratio}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{plan.width}×{plan.height} · {plan.overlayText.join(" / ")}</p>
                      <p className="mt-1 text-[10px] leading-5 text-[var(--muted-2)]">官方产品图或门店实拍；AI 只生成背景。当前状态：待按需生成。</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
