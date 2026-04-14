"use client";
import { useEffect, useState } from "react";
import { C, SIGNAL_NAMES, SIGNAL_WEIGHTS, regimeLabel, strategyLabel } from "@/lib/ui";
import { HelpBtn } from "@/components/HelpBtn";
import Link from "next/link";

type SectorItem = {
  name: string;
  ticker: string;
  score: number;
  signal: string;
  rsi: number;
  rs_vs_spy: number;
  change_1d: number;
};

type MarketTiming = {
  regime?: string;
  regime_score?: number;
  regime_confidence?: number;
  signals?: Record<string, string>;
  adaptive_params?: { stop_loss?: string; max_drawdown_warning?: string };
  gate?: string;
  gate_score?: number;
  sectors?: SectorItem[];
  gate_metrics?: {
    avg_score?: number;
    bullish_sectors?: number;
    bearish_sectors?: number;
    top_sector?: string;
    bottom_sector?: string;
  };
  spy_divergence?: {
    signal?: string;
    label?: string;
    severity?: string;
    spy_price?: number;
    change_10d_pct?: number;
    vol_ratio_2d_vs_20d_avg?: number;
  };
};

type DailyReport = {
  data_date?: string;
  generated_at?: string;
  market_timing?: MarketTiming;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function RegimePage() {
  const [date, setDate] = useState<string>(todayStr());
  const [mt, setMt] = useState<MarketTiming>({});
  const [status, setStatus] = useState<string>("로딩 중...");

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const res = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as DailyReport;
      setMt(d.market_timing ?? {});
      setDate(d.data_date ?? dateStr);
      setStatus("");
    } catch {
      setMt({});
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
        const res = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as DailyReport;
          setMt(data.market_timing ?? {});
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
        setMt(d.market_timing ?? {});
        setDate(dateStr);
        setStatus("");
      })
      .catch(() => setStatus("데이터 없음"));
  }, []);

  // 변수 바인딩 (기존 UI 변수명 유지)
  const r = mt.regime ?? "neutral";
  const p = mt.adaptive_params ?? { stop_loss: "N/A", max_drawdown_warning: "N/A" };
  const signals = mt.signals ?? {};
  const stratLabel = strategyLabel(r);
  const sectors = (mt.sectors ?? []).slice().sort((a, b) => b.score - a.score);
  const m = mt.gate_metrics ?? {};
  const g = mt.gate ?? "CAUTION";
  const gateBadgeBg =
    g === "GO"
      ? "bg-primary-container text-on-primary-container"
      : g === "STOP"
        ? "bg-error-container text-on-error-container"
        : "bg-secondary-container text-on-secondary-container";

  const d = mt.spy_divergence ?? {};
  const divSig = d.signal ?? "none";
  const sev = d.severity ?? "neutral";
  const isWarn = sev === "warning";
  const isOpp = sev === "opportunity";
  const cardBg = isWarn
    ? "bg-error-container/40 border-error/40"
    : isOpp
      ? "bg-primary-container/30 border-primary/40"
      : "bg-surface-container-high/30";
  const iconColor = isWarn ? "text-error" : isOpp ? "text-primary" : "text-on-surface-variant";
  const icon = isWarn ? "warning" : isOpp ? "trending_up" : "check_circle";
  const priceChg = d.change_10d_pct ?? 0;
  const priceCls = priceChg >= 0 ? "text-primary" : "text-error";

  return (
    <div>
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 px-5 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">analytics</span>
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

      {/* Regime Header Bento */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-7 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: "80px" }}>
              analytics
            </span>
          </div>
          <div className="flex flex-col gap-1 z-10">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
              Global Status <HelpBtn topic="regime" />
            </span>
            <div className="flex items-baseline gap-4 mt-2">
              <h1 className="text-5xl md:text-6xl font-black text-on-surface tracking-tighter leading-none">
                {regimeLabel(r)}
              </h1>
              <div
                className="w-4 h-4 rounded-full"
                style={{ background: C[r], boxShadow: `0 0 15px ${C[r]}50` }}
              />
            </div>
          </div>
          <div className="mt-10 flex gap-8 md:gap-12 z-10">
            <div>
              <p className="text-xs font-medium text-on-surface-variant uppercase flex items-center gap-1">Regime Score <HelpBtn topic="regime_score" /></p>
              <p className={`text-3xl font-bold ${(mt.regime_score ?? 0) >= 2 ? "text-primary" : (mt.regime_score ?? 0) >= 1 ? "text-secondary" : "text-error"}`}>{mt.regime_score ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-on-surface-variant uppercase flex items-center gap-1">Stop Loss <HelpBtn topic="stop_loss" /></p>
              <p className="text-3xl font-bold text-error">{p.stop_loss ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-on-surface-variant uppercase flex items-center gap-1">MDD Warning <HelpBtn topic="mdd_warning" /></p>
              <p className="text-3xl font-bold text-error/80">
                {p.max_drawdown_warning ?? "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div className="md:col-span-5 grid grid-cols-2 gap-4">
          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 flex flex-col justify-between">
            <span className="material-symbols-outlined text-primary text-3xl">trending_up</span>
            <div className="mt-4">
              <p className="text-xs font-medium text-on-surface-variant uppercase flex items-center gap-1">Confidence <HelpBtn topic="confidence" /></p>
              <p className="text-xl font-bold text-on-surface">{mt.regime_confidence ?? 0}%</p>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 flex flex-col justify-between">
            <span className="material-symbols-outlined text-tertiary text-3xl">hub</span>
            <div className="mt-4">
              <p className="text-xs font-medium text-on-surface-variant uppercase">Strategy</p>
              <p className="text-xl font-bold text-on-surface">{stratLabel}</p>
            </div>
          </div>
          <Link
            href="/ai"
            className="bg-surface-container-high p-6 rounded-xl col-span-2 flex items-center justify-between hover:bg-surface-bright transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
              </div>
              <div>
                <p className="text-sm font-bold">AI Insight</p>
                <p className="text-xs text-on-surface-variant">
                  {r === "risk_on"
                    ? "Market expansion — momentum active"
                    : "Market consolidating before expansion"}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </Link>
        </div>
      </section>

      {/* 5 Sensors */}
      <div className="bg-surface-container-low rounded-xl p-6 mb-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6 flex items-center gap-2">
          5 Sensor Status <HelpBtn topic="regime" />
        </h4>
        {Object.keys(signals).length === 0 ? (
          <p className="text-xs text-on-surface-variant/60">센서 데이터 없음</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(signals).map(([k, v]) => (
              <div
                key={k}
                className="bg-surface-container-high/40 p-5 rounded-xl border border-outline-variant/10"
                style={{ borderTop: `3px solid ${C[v as string] ?? "#888"}` }}
              >
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                  {SIGNAL_NAMES[k] ?? k} · {SIGNAL_WEIGHTS[k] ?? ""}
                </p>
                <p className="text-base font-bold mt-2" style={{ color: C[v as string] ?? "#888" }}>
                  {regimeLabel(String(v))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adaptive Params */}
      <div className="bg-surface-container-low rounded-xl p-6 mb-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6 flex items-center gap-2">
          Adaptive Parameters <HelpBtn topic="stop_loss" />
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2 flex items-center gap-1">
              Stop Loss <HelpBtn topic="stop_loss" />
            </p>
            <p className="text-2xl font-bold text-error">{p.stop_loss ?? "N/A"}</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2 flex items-center gap-1">
              MDD Warning <HelpBtn topic="mdd_warning" />
            </p>
            <p className="text-2xl font-bold text-tertiary">{p.max_drawdown_warning ?? "N/A"}</p>
          </div>
          <div className="bg-surface-container-high/40 p-6 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2 flex items-center gap-1">
              Strategy <HelpBtn topic="strategy" />
            </p>
            <p className="text-2xl font-bold text-on-surface">{stratLabel}</p>
          </div>
        </div>
      </div>

      {/* Volume-Price Divergence */}
      <div className="bg-surface-container-low rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
            Volume-Price Divergence (SPY) <HelpBtn topic="spy_divergence" />
          </h4>
          <span className="text-[10px] text-on-surface-variant">
            거래량-가격 불일치 / Climax 경보
          </span>
        </div>
        {divSig === "none" ? (
          <div className="flex items-center gap-4 p-4 bg-surface-container-high/30 rounded-lg">
            <span className="material-symbols-outlined text-on-surface-variant text-3xl">
              check_circle
            </span>
            <div>
              <p className="text-sm font-bold text-on-surface">특이 신호 없음</p>
              <p className="text-[10px] text-on-surface-variant mt-1">
                SPY 거래량-가격 다이버전스 탐지되지 않음 (lookback 10일)
              </p>
            </div>
          </div>
        ) : (
          <div className={`p-5 rounded-lg border ${cardBg}`}>
            <div className="flex items-start gap-4">
              <span
                className={`material-symbols-outlined text-4xl ${iconColor}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-base font-bold text-on-surface uppercase tracking-wider">
                    {divSig.replace("_", " ")}
                  </p>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded ${isWarn ? "bg-error text-on-error" : isOpp ? "bg-primary text-on-primary" : "bg-surface-container-highest"}`}
                  >
                    {sev.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-3">{d.label ?? ""}</p>
                <div className="flex flex-wrap gap-4 text-[10px]">
                  <span>SPY ${d.spy_price ?? "-"}</span>
                  <span className={priceCls}>
                    10D {priceChg >= 0 ? "+" : ""}
                    {priceChg}%
                  </span>
                  <span>Vol 2D/20D ratio: {d.vol_ratio_2d_vs_20d_avg ?? "-"}x</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sector Gate */}
      <div className="bg-surface-container-low rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
              Sector Gate · 11 SPDR ETFs <HelpBtn topic="gate" />
            </h4>
            <p className="text-[10px] text-on-surface-variant mt-1">
              평균 {m.avg_score ?? mt.gate_score ?? 0}점 · 강세 {m.bullish_sectors ?? 0} / 약세{" "}
              {m.bearish_sectors ?? 0} · Top: {m.top_sector ?? "-"} · Bottom: {m.bottom_sector ?? "-"}
            </p>
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded ${gateBadgeBg}`}
          >
            {g}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectors.length === 0 ? (
            <p className="text-xs text-on-surface-variant col-span-full">
              섹터 게이트 데이터 없음
            </p>
          ) : (
            sectors.map((s) => {
              const sig = s.signal ?? "NEUTRAL";
              const sigCls =
                sig === "BULLISH"
                  ? "text-primary"
                  : sig === "BEARISH"
                    ? "text-error"
                    : "text-secondary";
              const rsCls = s.rs_vs_spy >= 0 ? "text-primary" : "text-error";
              const borderTop =
                sig === "BULLISH" ? "#3fe56c" : sig === "BEARISH" ? "#ffb4ab" : "#fdd400";
              const chgCls = s.change_1d >= 0 ? "text-primary" : "text-error";
              return (
                <div
                  key={s.ticker}
                  className="bg-surface-container-high/40 p-4 rounded-lg border border-outline-variant/10"
                  style={{ borderTop: `3px solid ${borderTop}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface">{s.name}</p>
                    <span className="text-[9px] font-bold text-on-surface-variant">
                      {s.ticker}
                    </span>
                  </div>
                  <p className={`text-2xl font-black ${sigCls} leading-none mb-2`}>{s.score}</p>
                  <p className={`text-[10px] font-bold ${sigCls} mb-2`}>{sig}</p>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                    <span>RSI {s.rsi}</span>
                    <span className={rsCls}>
                      RS {s.rs_vs_spy >= 0 ? "+" : ""}
                      {(s.rs_vs_spy * 100).toFixed(2)}%
                    </span>
                    <span className={chgCls}>
                      {s.change_1d >= 0 ? "+" : ""}
                      {s.change_1d}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="text-[9px] text-on-surface-variant mt-4">
          점수 ≥60 BULLISH · 40~60 NEUTRAL · &lt;40 BEARISH · 공식: RSI 30% + MACD 30% + Volume
          20% + RS vs SPY 20%
        </p>
      </div>
    </div>
  );
}
