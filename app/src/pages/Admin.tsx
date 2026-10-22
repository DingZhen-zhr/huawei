import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CircleAlert, Database, Loader2, LockKeyhole, LogOut, ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { api, ApiError, type Conflict, type Product, type RecentTask } from "@/lib/api";

function AdminHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>
            <span className="block text-[14px] font-semibold">华采智营 · 后台</span>
            <span className="block text-[10.5px] text-[var(--muted)]">事实、冲突与门店配置</span>
          </span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-3.5 w-3.5" /> 销售端
        </Link>
      </div>
    </header>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState<"passcode" | "demo" | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("passcode");
    setError("");
    try {
      await api.adminLogin(passcode);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(null);
    }
  };

  const demo = async () => {
    setBusy("demo");
    setError("");
    try {
      await api.adminDemo();
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "演示后台未开启");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <AdminHeader />
      <main className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-[980px] items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_.8fr]">
        <section>
          <ShieldAlert className="h-8 w-8 text-[var(--red)]" />
          <h1 className="mt-5 max-w-[12ch] text-[38px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[48px]">事实确认，不进销售主流程。</h1>
          <p className="mt-5 max-w-[38rem] text-[13px] leading-7 text-[var(--muted)]">
            管理员只做三件事：核对价格冲突、维护官方来源、生成门店码。销售端不显示这个入口。
          </p>
        </section>
        <section className="border border-[var(--line-strong)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_-36px_rgba(24,24,24,.45)] sm:p-7">
          <div className="flex items-center gap-2 text-[13px] font-medium"><LockKeyhole className="h-4 w-4 text-[var(--red)]" /> 管理员登录</div>
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">口令只用于本地演示时，请及时替换为环境变量中的正式口令。</p>
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <input className="field" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="管理员口令" autoComplete="current-password" disabled={Boolean(busy)} />
            {error && <p className="text-[11px] leading-5 text-[var(--danger)]">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={Boolean(busy) || !passcode.trim()}>
              {busy === "passcode" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} 进入后台
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-[10px] text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]" />或<span className="h-px flex-1 bg-[var(--line)]" /></div>
          <button className="btn-secondary w-full" onClick={() => void demo()} disabled={Boolean(busy)}>
            {busy === "demo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} 进入演示后台
          </button>
        </section>
      </main>
    </div>
  );
}

function CandidateRows({ conflict }: { conflict: Conflict }) {
  return (
    <div className="space-y-2">
      {conflict.candidates.map((candidate, index) => (
        <div key={`${candidate.value}-${index}`} className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="mono rounded-[5px] bg-[var(--surface)] px-2 py-1 text-[var(--ink)]">¥{candidate.value.toLocaleString("zh-CN")}</span>
          <span className="text-[var(--muted)]">{candidate.evidence.map((e) => e.sku || e.priceType).filter(Boolean).join(" / ")}</span>
          {candidate.evidence[0]?.url && <a href={candidate.evidence[0].url} target="_blank" rel="noreferrer" className="text-[var(--red)] underline underline-offset-4">看来源</a>}
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [tasks, setTasks] = useState<RecentTask[]>([]);

  const load = async () => {
    setError("");
    try {
      const result = await api.adminOverview();
      setProducts(result.products);
      setConflicts(result.conflicts);
      setTasks(result.tasks);
      setAuthed(true);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "后台加载失败");
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setAuthed(false);
    setProducts([]);
    setConflicts([]);
    setTasks([]);
  };

  if (checking) {
    return <div className="grid min-h-dvh place-items-center bg-[var(--paper)] text-[12px] text-[var(--muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在检查后台会话</div>;
  }

  if (!authed) return <AdminLogin onLogin={() => void load()} />;

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <AdminHeader />
      <main className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em]">后台总览</h1>
            <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">价格冲突不自动选边。确认前，销售端内容保持冻结。</p>
          </div>
          <button className="btn-quiet self-start sm:self-auto" onClick={() => void logout()}><LogOut className="h-4 w-4" /> 退出后台</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["产品事实", products.length, "型号"],
            ["未解决冲突", conflicts.filter((c) => c.status === "open").length, "价格字段"],
            ["内容任务", tasks.length, "本地运行时"],
            ["官方快照", "2026-10-17", "基线日期"],
          ].map(([label, value, hint]) => (
            <div key={label} className="border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[10.5px] text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-[24px] font-semibold tracking-[-0.03em]">{value}</p>
              <p className="mt-1 text-[10px] text-[var(--muted-2)]">{hint}</p>
            </div>
          ))}
        </div>

        {error && <div className="mt-5 border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-4 text-[11px] text-[var(--danger)]">{error}</div>}

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-[var(--warning)]" />
            <h2 className="text-[16px] font-semibold">价格冲突</h2>
          </div>
          <div className="mt-3 border-t border-[var(--line)]">
            {conflicts.map((conflict) => (
              <article key={conflict.id} className="border-b border-[var(--line)] py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium">{conflict.productId} · {conflict.field}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{conflict.reason}</p>
                  </div>
                  <span className="status-pill bg-[var(--warning-soft)] text-[var(--warning)]">冻结中</span>
                </div>
                <div className="mt-3"><CandidateRows conflict={conflict} /></div>
                <p className="mt-3 text-[10.5px] text-[var(--muted-2)]">确认流程需要选择 SKU、地区、生效日期与结论；当前只读展示，不伪造确认。</p>
              </article>
            ))}
            {!conflicts.length && <p className="py-5 text-[11px] text-[var(--muted)]">没有未解决冲突。</p>}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[16px] font-semibold">产品事实</h2>
          <div className="mt-3 overflow-x-auto border-t border-[var(--line)]">
            <table className="w-full min-w-[680px] text-left text-[11px]">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="py-2.5 pr-3 font-medium">型号</th>
                  <th className="py-2.5 pr-3 font-medium">系列</th>
                  <th className="py-2.5 pr-3 font-medium">事实</th>
                  <th className="py-2.5 pr-3 font-medium">价格状态</th>
                  <th className="py-2.5 font-medium">快照</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--line)]">
                    <td className="py-2.5 pr-3 text-[var(--ink)]">{product.name}</td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">{product.family}</td>
                    <td className="mono py-2.5 pr-3 text-[var(--muted)]">{product.factCount}</td>
                    <td className="py-2.5 pr-3"><span className={`status-pill ${product.factStatus === "conflict" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`}>{product.price.status === "conflict" ? "冲突冻结" : product.price.status === "active" ? "可用" : "缺失"}</span></td>
                    <td className="mono py-2.5 text-[var(--muted)]">{product.snapshotDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[16px] font-semibold">最近内容任务</h2>
          <div className="mt-3 border-t border-[var(--line)]">
            {tasks.slice(0, 8).map((task) => (
              <Link key={task.id} to={`/create/${task.id}`} className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-3 text-[11px]">
                <span className="min-w-0 truncate">{task.productShortName}</span>
                <span className="text-[var(--muted)]">{task.progress?.label || task.status}</span>
                <span className="mono text-[var(--muted-2)]">{new Date(task.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </Link>
            ))}
            {!tasks.length && <p className="py-5 text-[11px] text-[var(--muted)]">还没有本地任务。</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
