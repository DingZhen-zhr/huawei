import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { BookOpen, ClipboardList, MessageSquareText, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store-context";

const navItems = [
  { to: "/", label: "今天", icon: ClipboardList, key: "today", num: "01" },
  { to: "/create", label: "内容", icon: BookOpen, key: "content", num: "02" },
  { to: "/ask", label: "问答", icon: MessageSquareText, key: "ask", num: "03" },
];

function navActive(pathname: string, key: string) {
  if (key === "today") return pathname === "/";
  if (key === "content") return pathname.startsWith("/create");
  return pathname.startsWith("/ask");
}

function Brand({ storeName }: { storeName: string }) {
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-3" aria-label="回到今天">
      <span className="brand-mark shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="whitespace-nowrap text-[17px] font-semibold tracking-[0.02em]">华采智营</span>
        <span className="mono hidden text-[9px] tracking-[0.2em] text-[var(--muted-2)] sm:block">HUAWEI RETAIL</span>
        <span className="max-w-[22ch] truncate text-[10.5px] text-[var(--muted)] md:hidden">{storeName}</span>
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
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}.${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <header className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-[var(--paper)]">
        <div className={`mx-auto flex h-[74px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 ${wide ? "max-w-[1600px]" : "max-w-[1440px]"}`}>
          <Brand storeName={store.name} />
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className={`h-1.5 w-1.5 shrink-0 ${store.demo ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
              <span className="max-w-[200px] truncate text-[11.5px] text-[var(--ink)]">{store.name}</span>
            </div>
            <span className="hidden h-3 w-px bg-[var(--line)] sm:block" />
            <span className="mono hidden text-[10px] tracking-[0.06em] text-[var(--muted)] sm:block">
              {store.profile.city || "杭州"} · {dateLabel}
            </span>
            <NavLink to="/settings" className="icon-button border-transparent" aria-label="门店设置" title="门店设置">
              <Settings2 className="h-4 w-4" />
            </NavLink>
            <button
              type="button"
              className="hidden border-b border-[var(--ink)] pb-0.5 text-[11px] text-[var(--ink)] hover:border-[var(--red)] hover:text-[var(--red)] sm:block"
              onClick={() => void logout()}
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <div className={`mx-auto ${wide ? "max-w-[1600px]" : "max-w-[1440px]"} md:flex`}>
        {!hideRail && (
          <aside className="hidden w-[224px] shrink-0 border-r border-[var(--line)] px-4 pb-8 pt-8 md:flex md:flex-col md:pl-10 md:pr-7">
            <nav aria-label="主导航">
              {navItems.map(({ to, label, key, num }) => {
                const active = navActive(pathname, key);
                return (
                  <NavLink key={to} to={to} className={`nav-rail-item ${active ? "nav-rail-item-active" : ""}`}>
                    <span className="nav-num">{num}</span>
                    <span>{label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto">
              <div className="border-t border-[var(--line)] pt-4">
                <p className="mono-label">当前门店</p>
                <p className="mt-2 text-[12px] font-medium leading-5">{store.name}</p>
                <p className="mt-1 text-[10.5px] leading-5 text-[var(--muted)]">
                  {store.profile.city || "城市未配置"} · {store.profile.businessHours || "营业时间未配置"}
                </p>
                <NavLink to="/settings" className="mt-3 inline-flex border-b border-[var(--red)] pb-0.5 text-[11px] text-[var(--red)]">
                  补门店资料
                </NavLink>
              </div>

              <div className="mt-6 border-t border-[var(--line)] pt-4">
                <p className="mono-label">资料来源</p>
                <p className="mt-2 text-[10.5px] leading-5 text-[var(--muted)]">资料截至 2026-10-17。价格和库存以门店当天为准。</p>
              </div>
            </div>
          </aside>
        )}

        <main className={`min-w-0 flex-1 ${flush ? "" : "px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-12 md:pl-10 md:pr-10 lg:pt-8"}`}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav md:hidden" aria-label="移动端主导航">
        {navItems.map(({ to, label, icon: Icon, key }) => {
          const active = navActive(pathname, key);
          return (
            <NavLink key={to} to={to} className={`bottom-nav-item ${active ? "bottom-nav-item-active" : ""}`}>
              <Icon className="h-[18px] w-[18px]" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
