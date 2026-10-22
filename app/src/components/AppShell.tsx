import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { BookOpen, ClipboardList, MessageSquareText, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store-context";

const navItems = [
  { to: "/", label: "今日", icon: ClipboardList, key: "today" },
  { to: "/create", label: "内容", icon: BookOpen, key: "content" },
  { to: "/ask", label: "问答", icon: MessageSquareText, key: "ask" },
];

function navActive(pathname: string, key: string) {
  if (key === "today") return pathname === "/";
  if (key === "content") return pathname.startsWith("/create");
  return pathname.startsWith("/ask");
}

function Brand({ storeName }: { storeName: string }) {
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-3" aria-label="回到今日任务">
      <span className="brand-mark shrink-0" aria-hidden="true">
        <span />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[14px] font-semibold tracking-[-0.01em]">华采智营</span>
        <span className="block max-w-[17ch] truncate text-[10.5px] text-[var(--muted)] sm:max-w-[24ch]">{storeName}</span>
      </span>
    </NavLink>
  );
}

export default function AppShell({
  children,
  wide = false,
  flush = false,
  hideRail = false,
}: {
  children: ReactNode;
  wide?: boolean;
  flush?: boolean;
  hideRail?: boolean;
}) {
  const { store, logout } = useStore();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]">
        <div className={`mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 ${wide ? "max-w-[1600px]" : "max-w-[1320px]"}`}>
          <Brand storeName={store.name} />
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 items-center gap-2 rounded-[9px] border border-[var(--line)] px-3 py-2 sm:flex">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${store.demo ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
              <span className="max-w-[220px] truncate text-[11px] text-[var(--muted)]">{store.name}</span>
            </div>
            <NavLink
              to="/settings"
              className="icon-button"
              aria-label="门店设置"
              title="门店设置"
            >
              <Settings2 className="h-4 w-4" />
            </NavLink>
            <button type="button" className="hidden text-[11px] text-[var(--muted)] hover:text-[var(--ink)] sm:block" onClick={() => void logout()}>
              退出
            </button>
          </div>
        </div>
      </header>

      <div className={`mx-auto ${wide ? "max-w-[1600px]" : "max-w-[1320px]"} md:flex`}>
        {!hideRail && <aside className="hidden w-[204px] shrink-0 border-r border-[var(--line)] px-4 py-6 md:block lg:w-[224px]">
          <nav className="space-y-1" aria-label="主导航">
            {navItems.map(({ to, label, icon: Icon, key }) => {
              const active = navActive(pathname, key);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`nav-rail-item ${active ? "nav-rail-item-active" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-[var(--line)] pt-5">
            <p className="mono-label">当前门店</p>
            <p className="mt-2 text-[12px] font-medium leading-5">{store.name}</p>
            <p className="mt-1 text-[10.5px] text-[var(--muted)]">{store.profile.city || "城市未配置"} · {store.profile.businessHours || "营业时间未配置"}</p>
            <NavLink to="/settings" className="mt-3 inline-flex text-[11px] text-[var(--red)] underline underline-offset-4">
              补门店资料
            </NavLink>
          </div>

          <div className="mt-8 border-t border-[var(--line)] pt-5">
            <p className="mono-label">事实基线</p>
            <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">2026-10-17 官方公开资料快照。价格与库存以门店实际为准。</p>
          </div>
        </aside>}

        <main className={`min-w-0 flex-1 ${flush ? "" : "px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-12 lg:pt-8"}`}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav md:hidden" aria-label="移动端主导航">
        {navItems.map(({ to, label, icon: Icon, key }) => {
          const active = navActive(pathname, key);
          return (
            <NavLink key={to} to={to} className={`bottom-nav-item ${active ? "bottom-nav-item-active" : ""}`}>
              <Icon className="h-[19px] w-[19px]" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
