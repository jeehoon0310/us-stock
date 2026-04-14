"use client";
import { useEffect, useState } from "react";
import { HelpBtn } from "@/components/HelpBtn";

type DailyReport = {
  data_date?: string;
  generated_at?: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CostsPage() {
  const [date, setDate] = useState<string>(todayStr());
  const [status, setStatus] = useState<string>("");

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as DailyReport;
      setDate(d.data_date ?? dateStr);
      setStatus("");
    } catch {
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
          setDate(data.data_date ?? dateStr);
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
        setDate(d.data_date ?? todayStr());
        setStatus("");
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 px-5 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">payments</span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Report Date
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center text-sm"
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
          >
            ▶
          </button>
          {status && (
            <span className="text-[10px] text-on-surface-variant ml-1">{status}</span>
          )}
        </div>
      </div>

      {/* Pricing (static) */}
      <div className="bg-surface-container-low rounded-xl p-6 mb-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-2 flex items-center gap-2">
          API Pricing <HelpBtn topic="api_costs" />
        </h4>
        <p className="text-[10px] text-on-surface-variant mb-6">As of {date}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10 text-center">
            <h4 className="text-base font-bold text-primary mb-3">Gemini Flash</h4>
            <p className="text-xs text-on-surface-variant mb-1">Input: $0.10 / 1M tokens</p>
            <p className="text-xs text-on-surface-variant mb-1">Output: $0.40 / 1M tokens</p>
            <p className="text-xs text-primary font-medium mt-2">Free tier available</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10 text-center">
            <h4 className="text-base font-bold text-secondary mb-3">GPT-5-mini</h4>
            <p className="text-xs text-on-surface-variant mb-1">Input: $0.15 / 1M tokens</p>
            <p className="text-xs text-on-surface-variant">Output: $0.60 / 1M tokens</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10 text-center">
            <h4 className="text-base font-bold text-tertiary mb-3">Perplexity Sonar</h4>
            <p className="text-xs text-on-surface-variant mb-1">$3 / 1,000 requests</p>
            <p className="text-xs text-on-surface-variant">Per-request pricing</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6">
          Estimated Cost (10 stocks · per run)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">Gemini</p>
            <p className="text-2xl font-bold text-primary">~$0.005</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">GPT</p>
            <p className="text-2xl font-bold text-secondary">~$0.008</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">
              Perplexity
            </p>
            <p className="text-2xl font-bold text-tertiary">~$0.030</p>
          </div>
        </div>
      </div>
    </div>
  );
}
