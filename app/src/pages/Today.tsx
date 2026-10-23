import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, CircleAlert, Loader2, RefreshCw } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/lib/store-context";
import { api, type RecentTask, type TaskCard, type TodayResponse } from "@/lib/api";

function dateLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }).replace("星期", " 星期");
}

function ReasonLines({ text }: { text: string }) {
  const parts = String(text || "").split("。").map((part) => part.trim()).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}。{index === 0 && parts.length > 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function statusText(card: TaskCard) {
  if (card.factStatus === "conflict" || card.noPrice) return "价格待确认";
  return "资料齐全";
}

function RecentList({ tasks }: { tasks: RecentTask[] }) {
  if (!tasks.length) {
    return (
      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11.5px] leading-6 text-[var(--muted)]">
        最近写的内容会留在这里 30 天。第一条写完后，刷新也不会丢。
      </p>
    );
  }
  return (
    <div>
      {tasks.map((task) => (
        <Link key={task.id} to={`/create/${task.id}`} className="flex items-baseline gap-3 border-t border-[var(--line)] py-3">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${task.status === "partial" ? "bg-[var(--warning)]" : task.status === "failed" ? "bg-[var(--danger)]" : task.readyCount > 0 ? "bg-[var(--success)]" : "bg-[var(--muted-2)]"}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-[var(--ink)]">{task.productShortName}</span>
            <span className="mt-0.5 block text-[10px] leading-5 text-[var(--muted)]">
              {task.progress?.label || task.status}
              {task.blockedCount ? ` · ${task.blockedCount} 个版本被拦` : ""}
            </span>
          </span>
          <span className="mono shrink-0 text-[9px] text-[var(--muted-2)]">
            {new Date(task.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TaskRow({ card, index }: { card: TaskCard; index: number }) {
  return (
    <Link
      to={`/create?taskCardId=${encodeURIComponent(card.id)}`}
      className="group grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-4 border-b border-[var(--line)] py-5 transition-colors hover:bg-white/60"
    >
      <span className="mono pt-1 text-[9px] text-[var(--red)]">{String(index).padStart(2, "0")}</span>
      <span className="min-w-0">
        <span className="block text-[20px] font-semibold tracking-[-0.025em]">{card.title}</span>
        <span className="mt-1.5 block max-w-[62ch] text-[10.5px] leading-6 text-[var(--muted)]">{card.reason}</span>
      </span>
      <span className="flex items-center gap-3 pt-1">
        {card.factStatus === "conflict" || card.noPrice ? <span className="tag-square">价格待确认</span> : null}
        <ArrowUpRight className="h-4 w-4 text-[var(--muted-2)] transition-colors group-hover:text-[var(--red)]" />
      </span>
    </Link>
  );
}

export default function Today() {
  const { store } = useStore();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.today()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "今天的任务没加载出来");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const lead = data?.tasks[0];
  const rest = data?.tasks.slice(1) || [];
  const total = data?.tasks.length || 0;
  const conflictCount = data?.tasks.filter((t) => t.factStatus === "conflict" || t.noPrice).length || 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="mono text-[9px] tracking-[0.1em] text-[var(--muted)]">
            {data ? dateLabel(data.date) : dateLabel(new Date().toISOString().slice(0, 10))}
          </span>
          <span className="h-[3px] w-[3px] bg-[var(--red)]" />
          <span className="mono text-[9px] tracking-[0.08em] text-[var(--muted)]">资料截至 {lead?.snapshotDate || "2026-10-17"}</span>
          <span className="mono ml-auto text-[9px] tracking-[0.08em] text-[var(--ink)]">
            {loading ? "正在加载" : total ? `${String(total).padStart(2, "0")} 条待发` : "今天没有待发"}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-6">
          <h1 className="display text-[44px] sm:text-[64px] lg:text-[84px]">
            今天发这条<span className="text-[var(--red)]">。</span>
          </h1>
          {total ? (
            <span className="num hidden shrink-0 items-baseline gap-2 pb-2 text-[54px] text-[var(--red)] sm:flex">
              01<small className="mono text-[9px] font-medium tracking-[0.12em] text-[var(--muted)]">/ {String(total).padStart(2, "0")}</small>
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b-2 border-[var(--ink)] pb-5">
          <p className="max-w-[640px] text-[14px] leading-7 text-[var(--muted)]">
            {loading ? "正在看今天有什么可写。" : total ? `${total === 3 ? "三张卡" : `${total} 张卡`}都配了官方资料和产品图。选一张，` : "今天没有能写的题。"}
            {total ? <strong className="font-semibold text-[var(--ink)]">补一句店里发生的事</strong> : null}
            {total ? "，五个渠道的文案就都有了。" : ""}
          </p>
          <Link to="/create" className="link-rule shrink-0">
            自己写一条 <ArrowUpRight className="h-3.5 w-3.5 text-[var(--red)]" />
          </Link>
        </div>

        {loading && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_288px]">
            <div>
              <div className="skeleton h-5 w-24" />
              <div className="skeleton mt-5 h-12 w-4/5" />
              <div className="skeleton mt-4 h-16 w-full" />
              <div className="skeleton mt-6 h-[260px] w-full" />
            </div>
            <div>
              <div className="skeleton h-5 w-32" />
              <div className="skeleton mt-4 h-24 w-full" />
              <div className="skeleton mt-2 h-24 w-full" />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 border border-[var(--danger)] bg-[var(--danger-soft)] p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <div>
                <p className="text-[13px] font-medium">今天的任务没出来</p>
                <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">{error}</p>
                <button className="btn-secondary mt-4" onClick={() => { setError(""); setLoading(true); setReloadKey((n) => n + 1); }}>
                  <RefreshCw className="h-4 w-4" /> 重试
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && data && lead && (
          <div className="mt-0 grid gap-0 lg:grid-cols-[minmax(0,1fr)_288px]">
            <div className="min-w-0">
              <section className="grid grid-cols-1 gap-6 border-b border-[var(--line)] py-6 md:grid-cols-[minmax(0,1fr)_300px] md:gap-7 lg:pr-8">
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`tag-square ${lead.factStatus === "conflict" || lead.noPrice ? "border-[var(--warning)] text-[var(--warning)]" : ""}`}>
                      {statusText(lead)}
                    </span>
                    <span className="mono text-[9px] tracking-[0.1em] text-[var(--muted)]">{lead.productFamily}</span>
                  </div>

                  <h2 className="mt-4 text-[30px] font-bold leading-[1.16] tracking-[-0.04em] sm:text-[38px] lg:text-[42px]">{lead.title}</h2>
                  <p className="mt-3 max-w-[42ch] text-[13px] leading-7 text-[var(--muted)]"><ReasonLines text={lead.reason} /></p>

                  <div className="mt-6 border-t border-[var(--line)] pt-4">
                    <p className="mono-label">补一句店里的细节</p>
                    <p className="mt-1.5 text-[14px] font-medium leading-6">{lead.requiredDetailHint}</p>
                  </div>

                  <Link to={`/create?taskCardId=${encodeURIComponent(lead.id)}`} className="btn-primary mt-4 self-start">
                    写这条 <ArrowUpRight className="h-4 w-4" />
                  </Link>

                  <div className="mt-6 grid grid-cols-3 border-t-2 border-[var(--ink)]">
                    <div className="py-3 pr-3">
                      <b className="num block text-[38px] leading-none">3</b>
                      <span className="mt-1 block text-[10px] text-[var(--muted)]">个内容角度</span>
                    </div>
                    <div className="border-l border-[var(--line)] py-3 pl-4">
                      <b className="num block text-[38px] leading-none">5</b>
                      <span className="mt-1 block text-[10px] text-[var(--muted)]">个发布渠道</span>
                    </div>
                    <div className="border-l border-[var(--line)] py-3 pl-4">
                      <b className="num block text-[38px] leading-none">1</b>
                      <span className="mt-1 block text-[10px] text-[var(--muted)]">条门店细节</span>
                    </div>
                  </div>
                </div>

                <figure className="relative h-[280px] overflow-hidden bg-[#ddd9d2] md:h-[470px]">
                  <img src={lead.productAsset} alt={lead.productName} className="h-full w-full object-cover" />
                  <span className="mono absolute left-0 top-0 bg-[var(--paper)] px-2.5 py-1.5 text-[8.5px] tracking-[0.1em]">
                    {lead.hasAssets ? "官方产品图" : "配图先留白"}
                  </span>
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 bg-[var(--ink)] px-3.5 py-3 text-white">
                    <span className="text-[11px]">{lead.productName}</span>
                    <span className="mono shrink-0 text-[9px] text-white/65">{lead.priceLabel}</span>
                  </figcaption>
                </figure>
              </section>

              {rest.length > 0 && (
                <section className="pt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em]">还有两条，换个角度写</h2>
                    <span className="mono text-[9px] tracking-[0.06em] text-[var(--muted)]">不用每天全发，挑一条今天店里最用得上的</span>
                  </div>
                  {rest.map((card, index) => (
                    <TaskRow key={card.id} card={card} index={index + 2} />
                  ))}
                </section>
              )}
            </div>

            <aside className="border-t-2 border-[var(--ink)] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-8">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">发之前，先看这三条</h2>
              <div className="mt-3">
                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 border-t-2 border-[var(--ink)] py-3.5">
                  <span className="mono pt-0.5 text-[9px] text-[var(--red)]">01</span>
                  <div>
                    <b className="block text-[12.5px] font-semibold">没有门店细节，先别写</b>
                    <p className="mt-1 text-[10.5px] leading-5 text-[var(--muted)]">旧电脑哪里不好用、顾客每天怎么带着走，<br />让店员补一句。</p>
                  </div>
                </div>
                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 border-t border-[var(--line)] py-3.5">
                  <span className="mono pt-0.5 text-[9px] text-[var(--red)]">02</span>
                  <div>
                    <b className="block text-[12.5px] font-semibold">{conflictCount ? "价格没核实，先别带价" : "价格只写官方价"}</b>
                    <p className="mt-1 text-[10.5px] leading-5 text-[var(--muted)]">
                      {conflictCount ? (
                        <>MateBook 14 鸿蒙版的 5,899 和 6,599 <span className="whitespace-nowrap">还没核实</span>，先别带价。</>
                      ) : (
                        "价格要落到具体型号和 SKU，门店实际报价另算。"
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 border-t border-[var(--line)] py-3.5">
                  <span className="mono pt-0.5 text-[9px] text-[var(--red)]">03</span>
                  <div>
                    <b className="block text-[12.5px] font-semibold">配图不用等</b>
                    <p className="mt-1 text-[10.5px] leading-5 text-[var(--muted)]">先把文字写出来。图用官方产品图或店里实拍，不做假产品图、假二维码。</p>
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[19px] font-semibold tracking-[-0.02em]">最近写的</h2>
                  <span className="mono text-[9px] text-[var(--muted-2)]">{String(data.recent.length).padStart(2, "0")}</span>
                </div>
                <div className="mt-2">
                  <RecentList tasks={data.recent} />
                </div>
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-3">
                <p className="text-[10px] leading-5 text-[var(--muted-2)]">{store.name} · 内容存 30 天。价格和库存以门店当天为准。</p>
              </div>
            </aside>
          </div>
        )}

        {!loading && data && !lead && (
          <div className="mt-10 border-y-2 border-[var(--ink)] py-12 text-center">
            <p className="text-[20px] font-semibold">今天没有能写的题</p>
            <p className="mx-auto mt-2 max-w-[30rem] text-[12px] leading-6 text-[var(--muted)]">
              题得有产品资料和官方图，缺一样就不放上来，也不拿假数据凑。
            </p>
            <Link to="/settings" className="btn-secondary mt-5">看看门店资料</Link>
          </div>
        )}

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在看今天有什么可写
          </div>
        )}
      </div>
    </AppShell>
  );
}
