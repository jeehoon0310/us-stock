"use client";
import { useEffect, useState } from "react";

type Holding = {
  ticker: string;
  company_name: string;
  buy_price: number;
  current_price: number;
  return_pct: number;
};

type Portfolio = {
  buy_date: string;
  days_held: number;
  portfolio_return_pct: number;
  best_pick: { ticker: string; return_pct: number };
  worst_pick: { ticker: string; return_pct: number };
  holdings: Holding[];
};

type PerformanceData = {
  generated_at: string;
  current_date: string;
  note: string;
  tickers: string[];
  portfolios: Portfolio[];
};

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [selected, setSelected] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/performance.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: PerformanceData) => {
        setData(d);
        // 최초 선택: Feb 17 (첫 날짜)
        if (d.portfolios.length > 0) setSelected(d.portfolios[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
      </div>
    );
  }

  if (!data || data.portfolios.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-xl p-10 text-center">
        <p className="text-on-surface-variant">수익률 데이터 없음 — generate_performance.py를 실행하세요</p>
      </div>
    );
  }

  const best = data.portfolios.reduce((a, b) =>
    a.portfolio_return_pct > b.portfolio_return_pct ? a : b
  );
  const worst = data.portfolios.reduce((a, b) =>
    a.portfolio_return_pct < b.portfolio_return_pct ? a : b
  );

  const maxAbs = Math.max(...data.portfolios.map((p) => Math.abs(p.portfolio_return_pct)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Portfolio Return Simulator</h2>
          <p className="text-sm text-on-surface-variant">
            {data.note} · 기준일 {data.current_date}
          </p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined" style={{ fontSize: "120px" }}>
            trending_up
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            Top 10 종목
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {data.tickers.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 bg-surface-container-high rounded text-xs font-bold text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-primary-container p-6 rounded-xl border-l-4 border-primary">
          <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest mb-1">
            최고 매입일
          </p>
          <p className="text-2xl font-black text-primary">{best.portfolio_return_pct > 0 ? "+" : ""}{best.portfolio_return_pct.toFixed(1)}%</p>
          <p className="text-sm font-bold text-on-primary-container mt-1">{best.buy_date}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">
            최고: {best.best_pick.ticker} {best.best_pick.return_pct > 0 ? "+" : ""}{best.best_pick.return_pct.toFixed(1)}%
          </p>
        </div>
        <div className="bg-error-container p-6 rounded-xl border-l-4 border-error">
          <p className="text-[10px] font-bold text-on-error-container uppercase tracking-widest mb-1">
            최악 매입일
          </p>
          <p className="text-2xl font-black text-error">{worst.portfolio_return_pct > 0 ? "+" : ""}{worst.portfolio_return_pct.toFixed(1)}%</p>
          <p className="text-sm font-bold text-on-error-container mt-1">{worst.buy_date}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">
            최악: {worst.worst_pick.ticker} {worst.worst_pick.return_pct > 0 ? "+" : ""}{worst.worst_pick.return_pct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Return Chart */}
      <div className="bg-surface-container-low rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
          매입일별 수익률 ({data.portfolios.length}거래일)
        </h4>
        <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
          {data.portfolios.map((p) => {
            const ret = p.portfolio_return_pct;
            const pct = Math.abs(ret) / maxAbs;
            const isSelected = selected?.buy_date === p.buy_date;
            const isPos = ret >= 0;
            return (
              <button
                key={p.buy_date}
                onClick={() => setSelected(p)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-surface-container-high ring-1 ring-primary/30"
                    : "hover:bg-surface-container-high/60"
                }`}
              >
                <span className="text-[11px] font-mono text-on-surface-variant w-24 shrink-0">
                  {p.buy_date}
                </span>
                <div className="flex-1 h-5 bg-surface-container-highest rounded-full overflow-hidden relative">
                  <div
                    className={`absolute top-0 h-full rounded-full transition-all ${
                      isPos ? "bg-primary left-1/2" : "bg-error right-1/2"
                    }`}
                    style={{ width: `${pct * 50}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[10px] font-bold ${isPos ? "text-primary" : "text-error"}`}>
                      {ret > 0 ? "+" : ""}{ret.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-on-surface-variant w-12 shrink-0 text-right">
                  {p.days_held}일
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Portfolio Detail */}
      {selected && (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest">
                {selected.buy_date} 매입 포트폴리오
              </h4>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {selected.days_held}일 보유 → 평균 수익률{" "}
                <span
                  className={`font-bold ${
                    selected.portfolio_return_pct >= 0 ? "text-primary" : "text-error"
                  }`}
                >
                  {selected.portfolio_return_pct > 0 ? "+" : ""}
                  {selected.portfolio_return_pct.toFixed(2)}%
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-on-surface-variant uppercase">$10,000 투자 시</p>
              <p
                className={`text-xl font-black ${
                  selected.portfolio_return_pct >= 0 ? "text-primary" : "text-error"
                }`}
              >
                ${(10000 * (1 + selected.portfolio_return_pct / 100)).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-high/20">
                  {["#", "종목", "매입가", "현재가", "수익률"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {selected.holdings.map((h, i) => {
                  const isPos = h.return_pct >= 0;
                  return (
                    <tr key={h.ticker} className="hover:bg-surface-bright/20 transition-colors">
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black">{h.ticker}</p>
                        <p className="text-[10px] text-on-surface-variant">{h.company_name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">${h.buy_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-mono">${h.current_price.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-black ${isPos ? "text-primary" : "text-error"}`}
                        >
                          {isPos ? "+" : ""}
                          {h.return_pct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
