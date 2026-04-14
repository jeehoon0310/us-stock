"use client";
import { useEffect, useState } from "react";
import { gradeClass, barColor } from "@/lib/ui";
import { HelpBtn } from "@/components/HelpBtn";

type StockPick = {
  ticker: string;
  company_name?: string;
  composite_score?: number;
  grade: string;
  grade_label?: string;
  strategy?: string;
  setup?: string;
  technical_score?: number;
  fundamental_score?: number;
  analyst_score?: number;
  rs_score?: number;
  volume_score?: number;
  rs_vs_spy?: number;
  action?: string;
};

type DailyReport = {
  data_date?: string;
  stock_picks?: StockPick[];
  summary?: { total_screened?: number };
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TopPicksPage() {
  const [date, setDate] = useState<string>(todayStr());
  const [picks, setPicks] = useState<StockPick[]>([]);
  const [screened, setScreened] = useState<number>(0);
  const [status, setStatus] = useState<string>("로딩 중...");

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as DailyReport;
      setPicks(d.stock_picks ?? []);
      setScreened(d.summary?.total_screened ?? d.stock_picks?.length ?? 0);
      setDate(dateStr);
      setStatus("");
    } catch {
      setPicks([]);
      setDate(dateStr);
      setStatus("데이터 없음");
    }
  }

  async function shiftDate(delta: number) {
    const d = new Date(date);
    for (let attempt = 0; attempt < 7; attempt++) {
      d.setDate(d.getDate() + delta);
      const dateStr = d.toISOString().slice(0, 10);
      const ymd = dateStr.replace(/-/g, "");
      try {
        const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as DailyReport;
          setPicks(data.stock_picks ?? []);
          setScreened(data.summary?.total_screened ?? data.stock_picks?.length ?? 0);
          setDate(dateStr);
          setStatus("");
          return;
        }
      } catch { /* 계속 탐색 */ }
    }
    setStatus("데이터 없음");
  }

  useEffect(() => {
    fetch("/data/latest_report.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DailyReport) => {
        const dateStr = d.data_date ?? todayStr();
        setPicks(d.stock_picks ?? []);
        setScreened(d.summary?.total_screened ?? d.stock_picks?.length ?? 0);
        setDate(dateStr);
        setStatus("");
      })
      .catch(() => setStatus("데이터 없음"));
  }, []);

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-high/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Smart Money Top 10</h3>
            <p className="text-xs text-on-surface-variant font-medium">
              Institutional flow &amp; AI scoring · {screened} screened
            </p>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center text-sm"
              title="이전 날짜"
            >
              ◀
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => void loadReport(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 py-1.5 text-sm font-bold text-primary outline-none focus:border-primary transition-colors"
              style={{ colorScheme: "dark" }}
            />
            <button
              onClick={() => shiftDate(1)}
              className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center text-sm"
              title="다음 날짜"
            >
              ▶
            </button>
            {status && (
              <span className="text-[10px] text-on-surface-variant ml-1">{status}</span>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {picks.length === 0 ? (
        <div className="p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-3">
            event_busy
          </span>
          <p className="text-sm text-on-surface-variant/60">
            {status === "로딩 중..." ? "로딩 중..." : "해당 날짜에 리포트가 없습니다"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/20">
                {([
                  { label: "#" },
                  { label: "Ticker" },
                  { label: "Grade", topic: "grade" },
                  { label: "Composite Score", topic: "composite_score" },
                  { label: "Strategy", topic: "strategy" },
                  { label: "Setup", topic: "setup" },
                  { label: "Tech", topic: "technical_score" },
                  { label: "Fund", topic: "fundamental_score" },
                  { label: "Analyst", topic: "analyst_score" },
                  { label: "RS vs SPY", topic: "rs_vs_spy" },
                  { label: "Action", topic: "action" },
                ] as { label: string; topic?: string }[]).map((h) => (
                  <th
                    key={h.label}
                    className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">{h.label}{h.topic && <HelpBtn topic={h.topic} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {picks.map((s, i) => {
                const gc = gradeClass(s.grade);
                const score = s.composite_score ?? 0;
                const bw = Math.min(score, 100);
                const bc = barColor(bw);
                const rsCol = (s.rs_vs_spy ?? 0) > 0 ? "text-primary" : "text-error";
                const action = s.action ?? "WATCH";
                const actionBg =
                  action === "BUY" || action === "STRONG BUY"
                    ? "bg-primary-container text-on-primary font-bold ring-2 ring-primary/20"
                    : action === "WATCH"
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30";

                return (
                  <tr
                    key={s.ticker}
                    className={`hover:bg-surface-bright/30 transition-colors group animate-fade-in-up stagger-${Math.min(i + 1, 10)}`}
                  >
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant">
                      {String(i + 1).padStart(2, "0")}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <a
                          href={`https://kr.tradingview.com/chart/?symbol=${s.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-black tracking-tight group-hover:text-primary transition-colors"
                        >
                          {s.ticker}
                        </a>
                        <span className="text-[10px] text-on-surface-variant">
                          {s.company_name ?? ""}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-col items-start gap-0.5">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${gc}`}
                        >
                          {s.grade}
                        </span>
                        {s.grade_label && (
                          <span className="text-[9px] text-on-surface-variant leading-tight max-w-[90px]">
                            {s.grade_label}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">{score.toFixed(1)}</span>
                        <div className="flex-1 h-1.5 w-24 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className={`${bc} h-full`} style={{ width: `${bw}%` }} />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-sm text-on-surface-variant">
                      {s.strategy ?? "—"}
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant">
                      {s.setup ?? "—"}
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-medium">
                      {s.technical_score ?? "—"}
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-medium">
                      {s.fundamental_score ?? "—"}
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-medium">
                      {s.analyst_score ?? "—"}
                    </td>

                    <td className="px-6 py-5">
                      <span className={`text-sm font-bold ${rsCol}`}>
                        {(s.rs_vs_spy ?? 0) > 0 ? "+" : ""}
                        {s.rs_vs_spy ?? 0}%
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-tighter font-bold ${actionBg}`}
                        >
                          {action}
                        </span>
                        <a
                          href={`https://kr.tradingview.com/chart/?symbol=${s.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-primary/10 transition-colors"
                          title="TradingView 차트"
                        >
                          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-base">
                            open_in_new
                          </span>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
