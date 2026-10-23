import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, KeyRound, Loader2, Store as StoreIcon } from "lucide-react";
import { api, ApiError, type Store } from "@/lib/api";
import { StoreContext } from "@/lib/store-context";

function StoreLogin({ onLogin }: { onLogin: (store: Store) => void }) {
  const [storeCode, setStoreCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState<"login" | "demo" | null>(null);
  const [error, setError] = useState("");

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!storeCode.trim() || pin.trim().length < 4) {
      setError("填入门店码和 4–6 位 PIN。");
      return;
    }
    setBusy("login");
    setError("");
    try {
      const result = await api.loginStore(storeCode.trim(), pin.trim());
      onLogin(result.store);
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
      const result = await api.loginDemo();
      onLogin(result.store);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "演示门店未开启，请用门店码登录。" : e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <header className="flex h-16 items-center border-b border-[var(--line)] px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em]">华采智营</div>
            <div className="text-[11px] text-[var(--muted)]">门店内容工具</div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-64px)] w-full max-w-[1120px] min-w-0 items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="min-w-0 max-w-[560px]">
          <h1 className="max-w-[12ch] text-[42px] font-bold leading-[1.06] tracking-[-0.045em] sm:text-[58px]">
            今天发什么，先选一条。
          </h1>
          <p className="mt-3 mono text-[10px] text-[var(--red)]">门店自己用的工具</p>
          <p className="mt-6 max-w-[36rem] text-[15px] leading-7 text-[var(--muted)]">
            选一个型号，补一句店里发生的事，五个渠道的文案一次写好。价格和参数都从官方资料里取，没依据的不能复制。
          </p>
          <div className="mt-8 grid max-w-[430px] grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--line)] pt-5 text-[12px] text-[var(--muted)]">
            <span>小红书 / 朋友圈 / 视频号</span>
            <span>公众号 / 海报</span>
            <span>价格和数字会核对</span>
            <span>没依据不能复制</span>
          </div>
        </section>

        <section className="mx-auto w-full min-w-0 max-w-[440px] border border-[var(--line-strong)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <StoreIcon className="h-4 w-4 text-[var(--red)]" />
                门店登录
              </div>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">输入门店码和 PIN，这台设备会记住 7 天。</p>
            </div>
            <span className="mono text-[10px] text-[var(--muted)]">HC / STORE</span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block">
              <span className="field-label">门店码</span>
              <input
                className="field mt-2"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                placeholder="例如 HUAWEI-001"
                autoCapitalize="characters"
                autoComplete="organization"
                disabled={Boolean(busy)}
              />
            </label>
            <label className="block">
              <span className="field-label">PIN</span>
              <input
                className="field mt-2 tracking-[0.25em]"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="4–6 位数字"
                autoComplete="current-password"
                disabled={Boolean(busy)}
              />
            </label>
            {error && <p className="text-[12px] leading-5 text-[var(--danger)]">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={Boolean(busy)}>
              {busy === "login" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy === "login" ? "正在进店" : "进入门店"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[10px] text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            或者
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <button type="button" className="btn-secondary w-full" onClick={demo} disabled={Boolean(busy)}>
            {busy === "demo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {busy === "demo" ? "正在进入" : "进入演示门店"}
          </button>
          <p className="mt-4 text-center text-[10.5px] leading-5 text-[var(--muted)]">演示店没有真实顾客、成交和联系方式。</p>
        </section>
      </main>
    </div>
  );
}

export default function StoreGate({ children }: { children: ReactNode }) {
  const [store, setStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMe()
      .then(({ store }) => setStoreState(store))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "无法连接门店服务");
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setStoreState(null);
  };

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--paper)]">
        <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在确认门店
        </div>
      </div>
    );
  }

  if (error && !store) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--paper)] px-5">
        <div className="max-w-[360px] border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <p className="text-[14px] font-medium">连不上门店服务</p>
          <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">{error}</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}>重新连接</button>
        </div>
      </div>
    );
  }

  if (!store) return <StoreLogin onLogin={setStoreState} />;

  return (
    <StoreContext.Provider value={{ store, setStore: setStoreState, logout }}>
      {children}
    </StoreContext.Provider>
  );
}
