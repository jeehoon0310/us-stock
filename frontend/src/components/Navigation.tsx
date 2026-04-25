"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/board",       icon: "forum",          labelKey: "nav.board",        adminOnly: false },
  { href: "/overview",    icon: "dashboard",       labelKey: "nav.overview",     adminOnly: false },
  { href: "/regime",      icon: "analytics",       labelKey: "nav.regime",       adminOnly: false },
  { href: "/top-picks",   icon: "star",            labelKey: "nav.topPicks",     adminOnly: false },
  { href: "/ai",          icon: "psychology",      labelKey: "nav.ai",           adminOnly: false },
  { href: "/forecast",    icon: "insights",        labelKey: "nav.forecast",     adminOnly: false },
  { href: "/ml",          icon: "leaderboard",     labelKey: "nav.ml",           adminOnly: false },
  { href: "/risk",        icon: "security",        labelKey: "nav.risk",         adminOnly: false },
  { href: "/performance", icon: "trending_up",     labelKey: "nav.performance",  adminOnly: false },
  { href: "/profile",     icon: "person_search",   labelKey: "nav.profile",      adminOnly: false },
  { href: "/download",    icon: "download",        labelKey: "nav.download",     adminOnly: false },
  // 관리자 전용 (하단 배치)
  { href: "/costs",       icon: "payments",        labelKey: "nav.costs",        adminOnly: true  },
  { href: "/sector",      icon: "pie_chart",       labelKey: "nav.sector",       adminOnly: true  },
  { href: "/chat-logs",   icon: "chat",            labelKey: "nav.chatLogs",     adminOnly: true  },
  { href: "/graph",       icon: "hub",             labelKey: "nav.graph",        adminOnly: true  },
  { href: "/ai-builder",  icon: "smart_toy",       labelKey: "nav.aiBuilder",    adminOnly: true  },
];

const MOBILE_NAV = [
  { href: "/board",       icon: "forum",        labelKey: "nav.mobile.board"       },
  { href: "/overview",    icon: "dashboard",    labelKey: "nav.mobile.overview"    },
  { href: "/regime",      icon: "analytics",    labelKey: "nav.mobile.regime"      },
  { href: "/top-picks",   icon: "star",         labelKey: "nav.mobile.topPicks"    },
  { href: "/ai",          icon: "psychology",   labelKey: "nav.mobile.ai"          },
  { href: "/forecast",    icon: "insights",     labelKey: "nav.mobile.forecast"    },
  { href: "/ml",          icon: "leaderboard",  labelKey: "nav.mobile.ml"          },
  { href: "/risk",        icon: "security",     labelKey: "nav.mobile.risk"        },
  { href: "/performance", icon: "trending_up",  labelKey: "nav.mobile.performance" },
  { href: "/profile",     icon: "person_search",labelKey: "nav.mobile.profile"     },
  { href: "/download",    icon: "download",     labelKey: "nav.mobile.download"    },
  { href: "/costs",       icon: "payments",     labelKey: "nav.mobile.costs",       adminOnly: true },
  { href: "/sector",      icon: "pie_chart",    labelKey: "nav.mobile.sector",      adminOnly: true },
  { href: "/graph",       icon: "hub",          labelKey: "nav.mobile.graph",       adminOnly: true },
  { href: "/ai-builder",  icon: "smart_toy",    labelKey: "nav.mobile.aiBuilder",   adminOnly: true },
];

function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.is_admin) setIsAdmin(true); })
      .catch(() => {});
  }, []);
  return isAdmin;
}

export function SideNav({ syncedAt }: { syncedAt: string }) {
  const pathname = usePathname();
  const t = useT();
  const isAdmin = useIsAdmin();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  const publicItems = NAV.filter((i) => !i.adminOnly);
  const adminItems  = NAV.filter((i) => i.adminOnly);

  const navLink = (item: typeof NAV[0]) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={
          active
            ? "flex items-center gap-4 px-6 py-3 text-primary font-bold border-r-2 border-primary bg-surface-container-high/50 transition-all active:translate-x-1"
            : "flex items-center gap-4 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all active:translate-x-1"
        }
      >
        <span className="material-symbols-outlined">{item.icon}</span>
        <span className="text-sm">{t(item.labelKey)}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-surface-container-low flex-col py-8 z-40 mt-16">
      <div className="px-6 mb-8">
        <h2 className="text-lg font-bold text-on-surface tracking-tight">{t("side.title")}</h2>
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-tighter opacity-60">
          {t("side.subtitle")}
        </p>
      </div>
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {publicItems.map(navLink)}

        {isAdmin && (
          <>
            <div className="mx-6 my-2 border-t border-outline-variant/20" />
            {adminItems.map(navLink)}
            <Link
              href="/admin"
              className={
                isActive("/admin")
                  ? "flex items-center gap-4 px-6 py-3 text-primary font-bold border-r-2 border-primary bg-surface-container-high/50 transition-all"
                  : "flex items-center gap-4 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
              }
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span className="text-sm">Admin</span>
            </Link>
          </>
        )}
      </nav>
      <div className="px-6 mt-auto">
        <div className="flex justify-end gap-1 mb-3">
          <LangToggle />
          <ThemeToggle />
        </div>
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-glow"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t("side.status")}
            </span>
          </div>
          <div className="text-[11px] text-on-surface-variant leading-relaxed">
            {t("side.synced")}: {syncedAt}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const t = useT();
  const isAdmin = useIsAdmin();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  const visibleItems = MOBILE_NAV.filter((i) => !(i as { adminOnly?: boolean }).adminOnly || isAdmin);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-low flex items-center h-16 z-50 border-t border-outline-variant/10 overflow-x-auto scrollbar-none">
      {visibleItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[56px] flex-shrink-0 h-full px-1 ${active ? "text-primary" : "text-on-surface-variant"}`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span className="text-[9px] font-bold mt-0.5 leading-none">{t(item.labelKey)}</span>
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          className={`flex flex-col items-center justify-center min-w-[56px] flex-shrink-0 h-full px-1 ${isActive("/admin") ? "text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
          <span className="text-[9px] font-bold mt-0.5 leading-none">Admin</span>
        </Link>
      )}
    </nav>
  );
}
