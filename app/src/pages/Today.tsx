import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Clock3,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/lib/store-context";
import { api, type RecentTask, type TaskCard, type TodayResponse } from "@/lib/api";

function dateLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}

function statusText(card: TaskCard) {
  if (card.factStatus === "conflict") return "价格待确认";
  return "资料齐";
}

function TaskRow({ card, onPick }: { card: TaskCard; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="group grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] py-4 text-left transition-colors hover:bg-[rgba(255,255,255,.48)] sm:grid-cols-[76px_minmax(0,1fr)_auto]"
    >
      <div className="h-[64px] w-[64px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[#f2eee7] sm:h-[76px] sm:w-[76px]">
        <img src={card.productAsset} alt={card.productName} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-[var(--ink)]">{card.title}</h3>
          <span className={`status-pill ${card.factStatus === "conflict" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`}>
            {statusText(card)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">{card.reason}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--muted-2)]">
          <span>{card.productShortName}</span>
          <span>{card.scene}</span>
          <span>3 角度 · 5 渠道</span>
        </div>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors group-hover:border-[var(--line-strong)] group-hover:text-[var(--ink)]">
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function RecentList({ tasks }: { tasks: RecentTask[] }) {
  if (!tasks.length) {
    return (
      <div className="border-t border-[var(--line)] pt-5">
        <p className="text-[12px] leading-6 text-[var(--muted)]">最近写的的内容会留在这里 30 天。第一条写完后，刷新也不会丢。</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
      {tasks.map((task) => (
        <Link key={task.id} to={`/create/${task.id}`} className="flex min-h-[56px] items-center gap-3 py-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${task.status === "partial" ? "bg-[var(--warning)]" : task.status === "failed" ? "bg-[var(--danger)]" : task.readyCount > 0 ? "bg-[var(--success)]" : "bg-[var(--muted-2)]"}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-[var(--ink)]">{task.productShortName}</span>
            <span className="mt-0.5 block text-[10.5px] text-[var(--muted)]">
              {task.progress?.label || task.status}
              {task.blockedCount ? ` · ${task.blockedCount} 个版本被拦` : ""}
            </span>
          </span>
          <span className="mono shrink-0 text-[10px] text-[var(--muted-2)]">
            {new Date(task.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)]" />
        </Link>
      ))}
    </div>
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
        if (alive) setError(e instanceof Error ? e.message : "今日任务加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const lead = data?.tasks[0];
  const rest = data?.tasks.slice(1) || [];
  const conflictCount = data?.tasks.filter((t) => t.factStatus === "conflict").length || 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px]">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[34px]">今天先发这条</h1>
            <p className="mt-2 max-w-[34rem] text-[13px] leading-6 text-[var(--muted)]">
              三张卡都有官方资料和产品图。挑一个，补一句店里的事，五个渠道一起出。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-[var(--muted-2)]">
              <span className="mono">{data ? dateLabel(data.date) : dateLabel(new Date().toISOString().slice(0, 10))}</span>
              <span>{store.name}</span>
              <span>资料 2026-10-17</span>
            </div>
          </div>
          <Link to="/create" className="btn-secondary shrink-0">
            自己写一条
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </header>

        {loading && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <div className="task-lead min-h-[340px] animate-pulse">
              <div className="space-y-4">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-10 w-4/5" />
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-11 w-36" />
              </div>
              <div className="skeleton min-h-[220px] w-full" />
            </div>
            <div className="surface min-h-[250px] p-5">
              <div className="space-y-3">
                <div className="skeleton h-5 w-28" />
                <div className="skeleton h-12 w-full" />
                <div className="skeleton h-12 w-full" />
                <div className="skeleton h-12 w-full" />
              </div>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-6 border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <div>
                <p className="text-[13px] font-medium">任务卡没出来</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{error}</p>
                <button className="btn-secondary mt-4" onClick={() => { setError(""); setLoading(true); setReloadKey((n) => n + 1); }}>
                  <RefreshCw className="h-4 w-4" /> 重试
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && data && lead && (
          <>
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.38fr)_minmax(280px,.62fr)]">
              <article className="task-lead overflow-hidden">
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-pill ${lead.factStatus === "conflict" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`}>
                      {lead.factStatus === "conflict" ? <CircleAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {statusText(lead)}
                    </span>
                    <span className="mono text-[10px] text-[var(--muted-2)]">{lead.productFamily}</span>
                  </div>

                  <h2 className="mt-5 max-w-[16ch] text-[26px] font-semibold leading-[1.18] tracking-[-0.03em] sm:text-[32px]">{lead.title}</h2>
                  <p className="mt-3 max-w-[42ch] text-[13px] leading-6 text-[var(--muted)]">{lead.reason}</p>

                  <div className="mt-5 border-t border-[var(--line)] pt-4">
                    <p className="text-[11px] font-medium text-[var(--ink)]">只差一句店里的事</p>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{lead.requiredDetailHint}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link to={`/create?taskCardId=${encodeURIComponent(lead.id)}`} className="btn-primary">
                      写这条
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <span className="text-[10.5px] text-[var(--muted-2)]">大概一分半，先出文字</span>
                  </div>

                  <div className="mt-auto grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-[10.5px] text-[var(--muted)]">
                    <span><strong className="block font-medium text-[var(--ink)]">3</strong> 个短内容角度</span>
                    <span><strong className="block font-medium text-[var(--ink)]">5</strong> 个渠道</span>
                    <span><strong className="block font-medium text-[var(--ink)]">1</strong> 条真实细节</span>
                  </div>
                </div>

                <div className="relative min-h-[220px] overflow-hidden rounded-[12px] border border-[var(--line)] bg-[#eee9e1]">
                  <img
                    src={lead.productAsset}
                    alt={lead.productName}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(24,24,24,.72)] to-transparent p-4 pt-16 text-white">
                    <p className="text-[11px] text-white/70">{lead.productName}</p>
                    <p className="mt-1 text-[13px] font-medium">{lead.priceLabel}</p>
                  </div>
                </div>
              </article>

              <aside className="flex flex-col gap-4">
                <section className="surface p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[13px] font-medium">先说清楚三件事</h2>
                    <ShieldCheck className="h-4 w-4 text-[var(--muted-2)]" />
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="flex gap-3">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--red)]" />
                      <div>
                        <p className="text-[12px] font-medium">没细节，不写</p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">旧电脑哪里不好用，顾客怎么带着走，得由销售补一句。</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]" />
                      <div>
                        <p className="text-[12px] font-medium">{conflictCount ? "价格没对上，先不写价" : "价格只写官方价"}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                          {conflictCount
                            ? "MateBook 14 鸿蒙版的 5,899 和 6,599 还没对上，带价的内容先不发。"
                            : "价格要落到具体型号和 SKU，门店实际报价另算。"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--info)]" />
                      <div>
                        <p className="text-[12px] font-medium">图不用等</p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">文字先出。图只用官方产品图或店里实拍，不做假产品、假二维码。</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="surface flex-1 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[13px] font-medium">最近写的</h2>
                    <Clock3 className="h-4 w-4 text-[var(--muted-2)]" />
                  </div>
                  <div className="mt-4">
                    <RecentList tasks={data.recent} />
                  </div>
                </section>
              </aside>
            </div>

            {rest.length > 0 && (
              <section className="mt-9">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em]">另外两条，换着写</h2>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">不用每天全发。挑一个最像今天店里的。</p>
                  </div>
                  <span className="hidden items-center gap-1.5 text-[10.5px] text-[var(--muted-2)] sm:flex">
                    <ImageIcon className="h-3.5 w-3.5" /> 有官方产品图
                  </span>
                </div>
                <div className="mt-3 border-t border-[var(--line)]">
                  {rest.map((card) => (
                    <TaskRow
                      key={card.id}
                      card={card}
                      onPick={() => { window.location.href = `/create?taskCardId=${encodeURIComponent(card.id)}`; }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {!loading && data && !lead && (
          <div className="mt-8 border border-dashed border-[var(--line-strong)] px-5 py-10 text-center">
            <p className="text-[14px] font-medium">今天没有能写的题</p>
            <p className="mx-auto mt-2 max-w-[30rem] text-[12px] leading-6 text-[var(--muted)]">
              题得有产品资料和官方图，缺一样就不放上来，也不拿假数据凑。
            </p>
            <Link to="/settings" className="btn-secondary mt-5">看看门店资料</Link>
          </div>
        )}

        {loading && (
          <div className="mt-8 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在看今天有什么可写
          </div>
        )}
      </div>
    </AppShell>
  );
}
