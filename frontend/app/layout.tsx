import type { Metadata } from "next";
import "./globals.css";
import { data } from "@/lib/data";
import { SideNav, MobileNav } from "@/components/Navigation";
import { QuotesTicker } from "@/components/QuotesTicker";

export const metadata: Metadata = {
  title: "Market Intelligence Terminal",
  description: "US Stock Market Intelligence · Regime · Smart Money · AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const syncedAt = data.top10?.generated_at ?? data.latestReport?.generated_at ?? "Live Feed Active";

  return (
    <html lang="ko" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-container-lowest text-on-surface selection:bg-primary selection:text-on-primary">
        {/* TopNavBar */}
        <header className="fixed top-0 z-50 flex items-center w-full px-6 h-16 bg-surface-container-lowest border-b border-outline-variant/10">
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="text-xl font-black text-on-surface tracking-tighter">
              <span className="text-primary">Market</span> Intelligence
            </span>
          </div>
          <QuotesTicker />
          <div className="flex items-center gap-6 flex-shrink-0">
            <nav className="hidden md:flex items-center gap-8 text-xs font-medium uppercase tracking-widest">
              <span className="text-primary font-bold cursor-pointer">Terminal</span>
              <span className="text-on-surface/60 hover:text-on-surface cursor-pointer transition-colors">
                Insights
              </span>
              <span className="text-on-surface/60 hover:text-on-surface cursor-pointer transition-colors">
                Reports
              </span>
            </nav>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-surface-container-high rounded-lg transition-colors">
                <span className="material-symbols-outlined text-on-surface">sensors</span>
              </button>
              <button className="p-2 hover:bg-surface-container-high rounded-lg transition-colors">
                <span className="material-symbols-outlined text-on-surface">schedule</span>
              </button>
            </div>
          </div>
        </header>

        {/* SideNavBar */}
        <SideNav syncedAt={syncedAt} />

        {/* Main Content */}
        <main className="md:ml-64 pt-16 min-h-screen bg-surface-container-lowest">
          <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 pb-24 md:pb-8">{children}</div>
        </main>

        {/* Mobile Bottom Nav */}
        <MobileNav />
      </body>
    </html>
  );
}
