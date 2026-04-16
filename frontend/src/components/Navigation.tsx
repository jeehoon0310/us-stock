"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/", icon: "dashboard", label: "Overview", key: "dashboard" },
  { href: "/regime", icon: "analytics", label: "Market Regime", key: "regime" },
  { href: "/top-picks", icon: "star", label: "Top Picks", key: "top10" },
  { href: "/ai", icon: "psychology", label: "AI Analysis", key: "ai" },
  { href: "/forecast", icon: "insights", label: "Index Forecast", key: "prediction" },
  { href: "/ml", icon: "leaderboard", label: "ML Rankings", key: "gbm" },
  { href: "/risk", icon: "security", label: "Risk Monitor", key: "risk" },
  { href: "/performance", icon: "trending_up", label: "Performance", key: "performance" },
  { href: "/graph", icon: "hub", label: "System Graph", key: "graph" },
  { href: "/ai-builder", icon: "smart_toy", label: "AI Builder", key: "ai-builder" },
  { href: "/board", icon: "forum", label: "Board", key: "board" },
  { href: "/costs", icon: "payments", label: "API Costs", key: "cost" },
];

const MOBILE_NAV = [
  { href: "/", icon: "dashboard", label: "Overview" },
  { href: "/regime", icon: "analytics", label: "Regime" },
  { href: "/top-picks", icon: "star", label: "Picks" },
  { href: "/ai", icon: "psychology", label: "AI" },
  { href: "/forecast", icon: "insights", label: "Forecast" },
  { href: "/ml", icon: "leaderboard", label: "ML" },
  { href: "/risk", icon: "security", label: "Risk" },
  { href: "/performance", icon: "trending_up", label: "Perf" },
  { href: "/graph", icon: "hub", label: "Graph" },
  { href: "/ai-builder", icon: "smart_toy", label: "Builder" },
  { href: "/board", icon: "forum", label: "Board" },
  { href: "/costs", icon: "payments", label: "Cost" },
];

export function SideNav({ syncedAt }: { syncedAt: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-surface-container-low flex-col py-8 z-40 mt-16">
      <div className="px-6 mb-8">
        <h2 className="text-lg font-bold text-on-surface tracking-tight">Frindle Tools</h2>
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-tighter opacity-60">
          Executive Intelligence
        </p>
      </div>
      <nav className="flex-1 flex flex-col gap-1">
        {NAV.map((item) => {
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
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 mt-auto">
        <div className="flex justify-end mb-3">
          <ThemeToggle />
        </div>
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-glow"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              System Status
            </span>
          </div>
          <div className="text-[11px] text-on-surface-variant leading-relaxed">
            Synced: {syncedAt}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-low flex items-center h-16 z-50 border-t border-outline-variant/10 overflow-x-auto scrollbar-none">
      {MOBILE_NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[56px] flex-shrink-0 h-full px-1 ${active ? "text-primary" : "text-on-surface-variant"}`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span className="text-[9px] font-bold mt-0.5 leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
