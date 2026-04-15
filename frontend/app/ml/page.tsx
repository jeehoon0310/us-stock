"use client";
import { useEffect, useState } from "react";
import { gradeClass, barColor } from "@/lib/ui";
import { HelpBtn } from "@/components/HelpBtn";
import { CalendarPicker } from "@/components/CalendarPicker";

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
  "13f_score"?: number;
  rs_vs_spy?: number;
  action?: string;
};

type DailyReport = {
  data_date?: string;
  generated_at?: string;
  stock_picks?: StockPick[];
  summary?: { total_screened?: number };
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function MLPage() {
  const [date, setDate] = useState<string>(todayStr());
  const [picks, setPicks] = useState<StockPick[]>([]);
  const [screened, setScreened] = useState<number>(0);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [status, setStatus] = useState<string>("로딩 중...");
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as DailyReport;
      setPicks(d.stock_picks ?? []);
      setScreened(d.summary?.total_screened ?? d.stock_picks?.length ?? 0);
      setGeneratedAt(d.generated_at ?? dateStr);
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
          setGeneratedAt(data.generated_at ?? dateStr);
          setDate(dateStr);
          setStatus("");
          return;
        }
      } catch { /* 계속 탐색 */ }
    }
    setStatus("데이터 없음");
  }

  useEffect(() => {
    fetch("/data/dates_manifest.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { dates: string[] }) => setAvailableDates(new Set(d.dates)));

    fetch("/data/latest_report.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DailyReport) => {
        const dateStr = d.data_date ?? todayStr();
        setPicks(d.stock_picks ?? []);
        setScreened(d.summary?.total_screened ?? d.stock_picks?.length ?? 0);
        setGeneratedAt(d.generated_at ?? dateStr);
        setDate(dateStr);
        setStatus("");
      })
      .catch(() => setStatus("데이터 없음"));
  }, []);

  const maxScore = Math.max(...picks.map((p) => p.composite_score ?? 0), 0.001);

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-high/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Quantitative Score Breakdown</h3>
            <p className="text-xs text-on-surface-variant font-medium">
              Multi-factor scoring · {screened} screened · {generatedAt}
            </p>
          </div>
          {/* Date nav */}
          <CalendarPicker
            value={date}
            availableDates={availableDates}
            onChange={(d) => void loadReport(d)}
            onShift={shiftDate}
            status={status}
          />
        </div>
      </div>

      {/* Score legend */}
      <div className="p-4 bg-surface-container-high/20 text-[10px] text-on-surface-variant border-b border-outline-variant/10">
        <b className="text-on-surface">Composite Score</b> — 6개 팩터 가중 합산 (Technical +
        Fundamental + Analyst + RS + Volume + 13F). 높을수록 당일 스크리닝 상위권.
      </div>

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
                  { label: "Composite", topic: "composite_score" },
                  { label: "Tech", topic: "technical_score" },
                  { label: "Fund", topic: "fundamental_score" },
                  { label: "Analyst", topic: "analyst_score" },
                  { label: "RS Score", topic: "rs_score" },
                  { label: "Volume", topic: "volume_score" },
                  { label: "13F", topic: "score_13f" },
                  { label: "RS vs SPY", topic: "rs_vs_spy" },
                  { label: "Strength" },
                ] as { label: string; topic?: string }[]).map((h) => (
                  <th
                    key={h.label}
                    className="px-5 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">{h.label}{h.topic && <HelpBtn topic={h.topic} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {picks.map((s, i) => {
                const score = s.composite_score ?? 0;
                const pct = (score / maxScore) * 100;
                const gc = gradeClass(s.grade);
                const rsCol = (s.rs_vs_spy ?? 0) > 0 ? "text-primary" : "text-error";

                return (
                  <tr
                    key={s.ticker}
                    className="hover:bg-surface-bright/30 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm font-bold text-on-surface-variant">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <a
                          href={`https://kr.tradingview.com/chart/?symbol=${s.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-on-surface hover:text-primary transition-colors"
                        >
                          {s.ticker}
                        </a>
                        <span className="text-[10px] text-on-surface-variant">
                          {s.company_name ?? ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${gc}`}
                      >
                        {s.grade}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-sm font-black ${score >= 75 ? "text-primary" : score >= 50 ? "text-secondary" : "text-error"}`}>
                      {score.toFixed(1)}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s.technical_score ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s.fundamental_score ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s.analyst_score ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s.rs_score != null ? s.rs_score.toFixed(0) : "—"}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s.volume_score != null ? s.volume_score.toFixed(0) : "—"}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium">
                      {s["13f_score"] ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold ${rsCol}`}>
                        {(s.rs_vs_spy ?? 0) > 0 ? "+" : ""}
                        {s.rs_vs_spy ?? 0}%
                      </span>
                    </td>
                    <td className="px-5 py-4 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant w-6 text-right">
                          {Math.round(pct)}
                        </span>
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
