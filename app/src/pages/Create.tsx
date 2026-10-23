import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { api, ApiError, type Product, type TaskCard } from "@/lib/api";
import { getSpeechRecognition, type SpeechRecognitionLike } from "@/lib/speech";

type Step = 0 | 1 | 2;

const STEP_TITLES = ["这条给谁看？", "店里当时是什么情况？", "想让顾客下一步做什么？"];

function VoiceButton({ onChange, disabled }: { onChange: (text: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => Boolean(getSpeechRecognition()));
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      onChange(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      className="icon-button shrink-0"
      title={supported ? (listening ? "停止语音输入" : "语音输入") : "当前浏览器不支持语音输入"}
      aria-label={supported ? (listening ? "停止语音输入" : "语音输入") : "当前浏览器不支持语音输入"}
    >
      {listening ? <MicOff className="h-4 w-4 text-[var(--red)]" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center justify-between gap-3 border px-4 py-3 text-left text-[13px] transition-colors ${
        selected
          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
          : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:border-[var(--line-strong)]"
      }`}
      aria-pressed={selected}
    >
      <span>{label}</span>
      {selected ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 border border-current opacity-30" />}
    </button>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCard = searchParams.get("taskCardId") || "";
  const requestedProduct = searchParams.get("productId") || "";
  const prefillAudience = searchParams.get("audience") || "";
  const prefillScene = searchParams.get("scene") || "";
  const prefillTarget = searchParams.get("target") || "";
  const prefillBudget = searchParams.get("budget") || "";
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [card, setCard] = useState<TaskCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [audience, setAudience] = useState("");
  const [scene, setScene] = useState("");
  const [target, setTarget] = useState("");
  const [budget, setBudget] = useState("");
  const [detail, setDetail] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [customAudienceOpen, setCustomAudienceOpen] = useState(false);
  const [customDetail, setCustomDetail] = useState(false);
  const [customTarget, setCustomTarget] = useState("");
  const [customTargetOpen, setCustomTargetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const cardFromProduct = (product: Product, audience: string, scene: string, target: string): TaskCard => ({
      id: `product:${product.id}`,
      productId: product.id,
      productName: product.name,
      productShortName: product.shortName,
      productAsset: product.asset || "",
      productFamily: product.family,
      title: product.shortName,
      scene: scene || "门店接待",
      audience: audience || "到店顾客",
      target: target || "到店看实物",
      reason: `这个型号有 ${product.factCount} 条资料。${product.price.label}。`,
      requiredDetailHint: "顾客现在最不方便的地方是什么？是重、慢，还是接口不够用？",
      hasAssets: product.hasAssets,
      factStatus: product.price.status === "conflict" ? "conflict" : "active",
      priceLabel: product.price.label,
      snapshotDate: product.snapshotDate,
      detailOptions: ["旧电脑开机慢、风扇响", "每天背着走太沉", "接口不够，总要拔来拔去"],
      audienceOptions: [...new Set([audience, "到店顾客", "学生", "通勤上班族", "创作者"].filter(Boolean))],
      targetOptions: [...new Set([target, "到店看实物", "私聊问配置", "先收藏对比"].filter(Boolean))],
    });

    api.today()
      .then(async (result) => {
        if (!alive) return;
        setCards(result.tasks);
        let picked: TaskCard | null =
          result.tasks.find((t) => t.id === requestedCard) ||
          result.tasks.find((t) => t.productId === requestedProduct) ||
          (!requestedProduct && !requestedCard ? result.tasks[0] : null) ||
          null;

        if (!picked && requestedProduct) {
          const { products } = await api.products();
          const product = products.find((item) => item.id === requestedProduct || item.name === requestedProduct);
          if (!product) {
            setLoadError("这个型号没有资料，回问答换一个。");
            return;
          }
          picked = cardFromProduct(product, prefillAudience, prefillScene, prefillTarget);
        }

        if (!alive) return;
        setCard(picked);
        if (picked) {
          const nextAudience = prefillAudience || picked.audience;
          const audienceIsOption = picked.audienceOptions.includes(nextAudience);
          setAudience(audienceIsOption ? nextAudience : picked.audienceOptions[0] || nextAudience);
          setCustomAudience(audienceIsOption ? "" : nextAudience);
          setCustomAudienceOpen(!audienceIsOption && Boolean(nextAudience));
          const nextTarget = prefillTarget || picked.target;
          const targetIsOption = picked.targetOptions.includes(nextTarget);
          setTarget(targetIsOption ? nextTarget : picked.targetOptions[0] || nextTarget);
          setCustomTarget(targetIsOption ? "" : nextTarget);
          setCustomTargetOpen(!targetIsOption && Boolean(nextTarget));
          setScene(prefillScene || picked.scene);
          setBudget(prefillBudget);
        } else {
          setLoadError("今天没有能写的题。");
        }
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : "任务卡加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [requestedCard, requestedProduct, prefillAudience, prefillScene, prefillTarget, prefillBudget]);

  const currentAudience = customAudienceOpen ? customAudience.trim() : audience;
  const currentDetail = detail.trim();
  const currentTarget = customTargetOpen ? customTarget.trim() : target;
  const currentScene = scene || card?.scene || "";

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(currentDetail);
    if (step === 0) return Boolean(currentAudience);
    return Boolean(currentTarget);
  }, [step, currentAudience, currentDetail, currentTarget]);

  const chooseCard = (next: TaskCard) => {
    setCard(next);
    setAudience(next.audienceOptions.includes(next.audience) ? next.audience : next.audienceOptions[0] || next.audience);
    setTarget(next.targetOptions.includes(next.target) ? next.target : next.targetOptions[0] || next.target);
    setScene(next.scene);
    setBudget("");
    setStep(0);
    setDetail("");
    setCustomDetail(false);
    setCustomAudience("");
    setCustomAudienceOpen(false);
    setCustomTarget("");
    setCustomTargetOpen(false);
    setError("");
  };

  const next = async () => {
    setError("");
    if (!canNext) {
      if (step === 1) setError("还差一句店里的细节。写一句当时发生了什么，再生成。");
      return;
    }
    if (step < 2) {
      setStep((n) => (n + 1) as Step);
      return;
    }
    if (!card) return;
    setSubmitting(true);
    try {
      const result = await api.createTask({
        taskCardId: card.id,
        productId: card.productId,
        audience: currentAudience,
        scene: currentScene,
        target: currentTarget,
        realDetail: { text: currentDetail, source: "sales_provided", confirmed: true },
        questionAnswers: {
          audience: currentAudience,
          detail: currentDetail,
          scene: currentScene,
          target: currentTarget,
          budget: budget || "",
        },
      });
      navigate(`/create/${result.taskId}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "REAL_DETAIL_REQUIRED") {
        setStep(1);
        setCustomDetail(true);
      }
      setError(e instanceof Error ? e.message : "任务创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    if (step === 0) {
      navigate("/");
      return;
    }
    setStep((n) => (n - 1) as Step);
    setError("");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
              <ArrowLeft className="h-3.5 w-3.5" /> 今日任务
            </Link>
            <h1 className="mt-3 text-[34px] font-bold tracking-[-0.04em] sm:text-[44px]">补一句店里的细节，就能写</h1>
            <p className="mt-1.5 text-[12.5px] leading-6 text-[var(--muted)]">一次问一个，答完就能写。</p>
          </div>
          <span className="mono hidden text-[10px] text-[var(--muted-2)] sm:block">五个渠道</span>
        </div>

        {loading && (
          <div className="mt-7 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="skeleton h-[360px] w-full" />
            <div className="skeleton h-[360px] w-full" />
          </div>
        )}

        {loadError && !loading && (
          <div className="mt-7 border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
            <p className="text-[13px] font-medium">任务卡没出来</p>
            <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">{loadError}</p>
            <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>重新加载</button>
          </div>
        )}

        {!loading && card && (
          <div className="mt-7 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="order-2 space-y-4 lg:order-1">
              <div className="surface overflow-hidden">
                <div className="aspect-[4/3] bg-[#eee9e1]">
                  {card.productAsset ? (
                    <img src={card.productAsset} alt={card.productName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-[var(--muted)]">还没官方图，配图先留白</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[10.5px] text-[var(--muted)]">{card.productFamily}</p>
                  <h2 className="mt-1 text-[15px] font-medium leading-6">{card.productName}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`status-pill ${card.factStatus === "conflict" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`}>
                      {card.factStatus === "conflict" ? <CircleAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {card.factStatus === "conflict" ? "价格待确认" : "资料齐全"}
                    </span>
                    <span className="mono text-[10px] text-[var(--muted-2)]">{card.priceLabel}</span>
                  </div>
                  <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] leading-5 text-[var(--muted)]">{card.reason}</p>
                  <p className="mt-2 text-[10.5px] leading-5 text-[var(--muted-2)]">这次场景：{currentScene}{budget ? ` · 预算 ${budget}` : ""}</p>
                </div>
              </div>

              <div className="surface p-4">
                <p className="text-[11px] font-medium">这次出这些</p>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-[var(--muted)]">
                  <span>小红书 × 3</span>
                  <span>朋友圈 × 3</span>
                  <span>公众号 × 1</span>
                  <span>海报 × 1</span>
                  <span>视频号 × 3</span>
                  <span className="text-[var(--red)]">先出文字，图后补</span>
                </div>
              </div>

              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-[10.5px] leading-5 text-[var(--muted)]">
                  换一条：
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cards.filter((c) => c.id !== card.id).map((c) => (
                    <button key={c.id} type="button" className="chip" onClick={() => chooseCard(c)}>
                      {c.title}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="surface order-1 flex min-h-[430px] flex-col p-5 sm:p-7 lg:order-2">
              <div className="mb-5 flex items-center gap-3 border-b border-[var(--line)] pb-4 lg:hidden">
                <div className="h-11 w-11 shrink-0 overflow-hidden border border-[var(--line)] bg-[#eee9e1]">
                  {card.productAsset ? <img src={card.productAsset} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-medium">{card.productName}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">{card.productFamily} · {card.factStatus === "conflict" ? "价格待确认" : "资料齐全"}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">场景：{currentScene}{budget ? ` · 预算 ${budget}` : ""}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="mono text-[10px] text-[var(--muted-2)]">第 {step + 1} 个问题</span>
                <div className="flex gap-1.5" aria-label={`第 ${step + 1} 步，共 3 步`}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1.5 w-6 ${i <= step ? "bg-[var(--red)]" : "bg-[var(--line)]"}`} />
                  ))}
                </div>
              </div>

              <h2 className="mt-7 text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]">{STEP_TITLES[step]}</h2>
              <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
                {step === 0 && "决定称呼和日常场景，产品资料不动。"}
                {step === 1 && "这句会当成店里发生的场景，不写成官方参数。"}
                {step === 2 && "只给一个自然的下一步，不替你承诺成交。"}
              </p>

              <div className="mt-6 space-y-2.5">
                {step === 0 && (
                  <>
                    {card.audienceOptions.map((option) => (
                      <OptionButton key={option} label={option} selected={!customAudienceOpen && audience === option} onClick={() => { setAudience(option); setCustomAudienceOpen(false); setCustomAudience(""); }} />
                    ))}
                    <button type="button" className={`chip ${customAudienceOpen ? "chip-active" : ""}`} onClick={() => { setCustomAudienceOpen(true); setAudience(""); }}>
                      都不是，我自己写
                    </button>
                    {customAudienceOpen && (
                      <input
                        className="field"
                        autoFocus
                        value={customAudience}
                        onChange={(e) => setCustomAudience(e.target.value)}
                        placeholder="例如：给刚退休的爸妈挑"
                      />
                    )}
                  </>
                )}

                {step === 1 && (
                  <>
                    {card.detailOptions.map((option) => (
                      <OptionButton key={option} label={option} selected={detail === option} onClick={() => { setDetail(option); setCustomDetail(false); setError(""); }} />
                    ))}
                    <button type="button" className={`chip ${customDetail ? "chip-active" : ""}`} onClick={() => { setCustomDetail(true); setDetail(""); }}>
                      都不是，我自己写
                    </button>
                    {customDetail && (
                      <div className="flex items-start gap-2">
                        <textarea
                          className="field min-h-[104px] resize-y"
                          value={detail}
                          onChange={(e) => { setDetail(e.target.value); setError(""); }}
                          placeholder={card.requiredDetailHint}
                          autoFocus={customDetail}
                        />
                        <VoiceButton onChange={(text) => { setDetail(text); setError(""); }} disabled={submitting} />
                      </div>
                    )}
                    {!detail.trim() && <p className="text-[10.5px] leading-5 text-[var(--muted)]">没这句就不能生成。</p>}
                  </>
                )}

                {step === 2 && (
                  <>
                    {card.targetOptions.map((option) => (
                      <OptionButton key={option} label={option} selected={!customTargetOpen && target === option} onClick={() => { setTarget(option); setCustomTargetOpen(false); setCustomTarget(""); }} />
                    ))}
                    <button type="button" className={`chip ${customTargetOpen ? "chip-active" : ""}`} onClick={() => { setCustomTargetOpen(true); setTarget(""); }}>
                      都不是，我自己写
                    </button>
                    {customTargetOpen && (
                      <input
                        className="field"
                        autoFocus
                        value={customTarget}
                        onChange={(e) => setCustomTarget(e.target.value)}
                        placeholder="例如：先加微信，再发两档配置"
                      />
                    )}
                  </>
                )}
              </div>

              {step === 1 && currentDetail && (
                <div className="mt-5 flex gap-2 border border-[var(--info)]/20 bg-[var(--info-soft)] p-3 text-[11px] leading-5 text-[var(--info)]">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>这句会标成店里提供的场景，不混进产品参数。</span>
                </div>
              )}

              {error && (
                <div className="mt-5 flex gap-2 border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-3 text-[11px] leading-5 text-[var(--danger)]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
                <button type="button" className="btn-quiet" onClick={back} disabled={submitting}>
                  <ArrowLeft className="h-4 w-4" /> {step === 0 ? "回今日" : "上一步"}
                </button>
                <button type="button" className="btn-primary min-w-[148px]" onClick={() => void next()} disabled={!canNext || submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 2 ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {submitting ? "正在生成（约 15–30 秒）" : step === 2 ? "生成五个渠道" : "下一步"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
