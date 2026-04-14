"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LatestReport, RegimeConfig, StockPick } from "@/lib/data";
import { C, CB, gradeClass, SIGNAL_NAMES, regimeLabel } from "@/lib/ui";
import { HelpBtn } from "@/components/HelpBtn";

type Props = {
  initial: LatestReport;
  regime: RegimeConfig;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardClient({ initial, regime }: Props) {
  const [date, setDate] = useState<string>(initial.data_date ?? todayStr());
  const [report, setReport] = useState<LatestReport | null>(initial ?? null);
  const [status, setStatus] = useState<string>("");

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as LatestReport;
      setReport(data);
      setDate(dateStr);
      setStatus("");
    } catch {
      setReport(null);
      setDate(dateStr);
      setStatus("데이터 없음");
    }
  }

  async function shiftDate(delta: number) {
    const d = new Date(date);
    // 주말·공휴일 자동 skip: 최대 7일 탐색
    for (let attempt = 0; attempt < 7; attempt++) {
      d.setDate(d.getDate() + delta);
      const dateStr = d.toISOString().slice(0, 10);
      const ymd = dateStr.replace(/-/g, "");
      try {
        const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as LatestReport;
          setReport(data);
          setDate(dateStr);
          setStatus("");
          return;
        }
      } catch {
        // 계속 탐색
      }
    }
    setStatus("데이터 없음");
  }

  useEffect(() => {
    // no-op: initial state already set
  }, []);

  const mt = report?.market_timing;
  const r = mt?.regime ?? regime.regime ?? "neutral";
  const score = mt?.regime_score ?? regime.weighted_score ?? 0;
  const conf = mt?.regime_confidence ?? regime.confidence ?? 0;
  const gate = mt?.gate ?? "CAUTION";
  const gateScore = mt?.gate_score ?? 0;
  const verdict = report?.verdict ?? "CAUTION";
  const picks: StockPick[] = report?.stock_picks ?? [];
  const summary = report?.summary ?? {};
  const spy = mt?.ml_predictor?.spy;
  const qqq = mt?.ml_predictor?.qqq;
  const signals = regime.signals ?? {};
  const adaptive = regime.adaptive_params ?? { stop_loss: "N/A", max_drawdown_warning: "N/A" };

  const verdictColor =
    verdict === "GO" ? C.risk_on : verdict === "STOP" ? C.crisis : C.neutral;
  const gateIcon =
    verdict === "GO" ? "check_circle" : verdict === "STOP" ? "block" : "warning";
  const gateBg =
    verdict === "GO"
      ? "bg-primary-container text-on-primary-container border-primary"
      : verdict === "STOP"
        ? "bg-error-container text-on-error-container border-error"
        : "bg-secondary-container text-black border-secondary-container";

  return (
    <div>
      {/* Hero */}
      <div className="bg-surface-container-low p-8 rounded-xl mb-6 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-2 flex items-center gap-3">
            US Stock Market Intelligence <HelpBtn topic="verdict" />
          </h2>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              LIVE
            </span>
            <p className="text-sm text-on-surface-variant">
              Real-time regime detection · Smart money screening · AI analysis
            </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined" style={{ fontSize: "120px" }}>
            monitoring
          </span>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 px-5 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Report Date
          </span>
        </div>
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
          <span className="text-[10px] text-on-surface-variant ml-2">{status}</span>
        </div>
      </div>

      {!report ? (
        <div className="bg-surface-container-low rounded-xl p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-4">
            event_busy
          </span>
          <p className="text-lg font-bold text-on-surface-variant mb-2">{date}</p>
          <p className="text-sm text-on-surface-variant/60">해당 날짜에 리포트가 없습니다</p>
          <p className="text-xs text-on-surface-variant/40 mt-2">
            다른 날짜를 선택하거나 파이프라인을 실행해주세요
          </p>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1">
                Verdict <HelpBtn topic="verdict" />
              </p>
              <p className="text-3xl font-black tracking-tighter" style={{ color: verdictColor }}>
                {verdict}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Regime {r.replace("_", " ")}</p>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                Confidence
              </p>
              <p className="text-3xl font-black tracking-tighter text-primary">{conf}%</p>
              <p className="text-xs text-on-surface-variant mt-1">Score {score}</p>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                Screened
              </p>
              <p className="text-3xl font-black tracking-tighter text-on-surface">
                {summary.total_screened ?? picks.length}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">stocks analyzed</p>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl border border-primary/20">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1">
                Market Gate <HelpBtn topic="gate" />
              </p>
              <p
                className="text-3xl font-black tracking-tighter"
                style={{
                  color: gate === "GO" ? C.risk_on : gate === "STOP" ? C.crisis : C.neutral,
                }}
              >
                {gate}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Score {gateScore}</p>
            </div>
          </div>

          {/* 2-col */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Signals */}
              <div className="bg-surface-container-low rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6">
                  Core Regime Indicators
                </h4>
                <div className="flex flex-wrap gap-4">
                  {spy?.direction && (
                    <div className="bg-surface-container-lowest p-4 rounded-lg flex-1 min-w-[140px] border border-outline-variant/5">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                        SPY 5D <HelpBtn topic="ml" />
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${spy.direction === "bullish" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"}`}
                      >
                        {spy.direction.toUpperCase()}{" "}
                        {spy.predicted_return > 0 ? "+" : ""}
                        {spy.predicted_return}%
                      </span>
                      <p className="text-[9px] text-on-surface-variant mt-1">
                        신뢰도 {spy.confidence_pct ?? 0}%
                      </p>
                    </div>
                  )}
                  {qqq?.direction && (
                    <div className="bg-surface-container-lowest p-4 rounded-lg flex-1 min-w-[140px] border border-outline-variant/5">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                        QQQ 5D <HelpBtn topic="ml" />
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${qqq.direction === "bullish" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"}`}
                      >
                        {qqq.direction.toUpperCase()}{" "}
                        {qqq.predicted_return > 0 ? "+" : ""}
                        {qqq.predicted_return}%
                      </span>
                      <p className="text-[9px] text-on-surface-variant mt-1">
                        신뢰도 {qqq.confidence_pct ?? 0}%
                      </p>
                    </div>
                  )}
                  <div className="bg-surface-container-lowest p-4 rounded-lg flex-1 min-w-[140px] border border-outline-variant/5">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                      Regime <HelpBtn topic="regime" />
                    </p>
                    <span
                      className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold"
                      style={{ background: CB[r], color: C[r] }}
                    >
                      {regimeLabel(r)}
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg flex-1 min-w-[140px] border border-outline-variant/5">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                      Gate <HelpBtn topic="gate" />
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${gate === "GO" ? "bg-primary-container text-on-primary-container" : gate === "STOP" ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"}`}
                    >
                      {gate}
                    </span>
                  </div>
                  {/* Sensor fallback */}
                  {Object.entries(signals).map(([k, v]) => {
                    const cls =
                      v === "risk_on"
                        ? "bg-primary-container text-on-primary-container glow-primary"
                        : v === "risk_off"
                          ? "bg-error-container text-on-error-container glow-error"
                          : "bg-secondary-container text-on-secondary-container";
                    return (
                      <div
                        key={k}
                        className="bg-surface-container-lowest p-4 rounded-lg flex-1 min-w-[140px] border border-outline-variant/5"
                      >
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-1">
                          {SIGNAL_NAMES[k] ?? k} <HelpBtn topic="regime" />
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${cls}`}
                        >
                          {regimeLabel(String(v))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 5 Alpha Picks */}
              <div className="bg-surface-container-low rounded-xl overflow-hidden">
                <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                    Top 5 Alpha Picks
                  </h4>
                  <Link
                    href="/top-picks"
                    className="text-xs font-bold text-primary flex items-center gap-1"
                  >
                    Full Terminal View{" "}
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                </div>
                <div>
                  {picks.slice(0, 5).map((stock, i) => {
                    const action = stock.action ?? "WATCH";
                    const actBg =
                      action === "BUY" || action === "SMALL BUY"
                        ? "bg-primary/10 text-primary"
                        : action === "HOLD"
                          ? "bg-error/10 text-error"
                          : "bg-secondary/10 text-secondary";
                    return (
                      <div
                        key={stock.ticker}
                        className={`flex items-center px-6 py-4 hover:bg-surface-bright/30 transition-colors border-b border-outline-variant/5 animate-fade-in-up stagger-${i + 1}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-xs font-bold mr-4">
                          {stock.ticker.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-on-surface">{stock.ticker}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {stock.company_name ?? ""}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold mr-3 ${actBg}`}
                        >
                          {action}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold mr-4 ${gradeClass(stock.grade)}`}
                        >
                          {stock.grade}
                        </span>
                        <p className="text-sm font-bold text-on-surface mr-3">
                          {stock.composite_score ?? 0}
                        </p>
                        <a
                          href={`https://kr.tradingview.com/chart/?symbol=${stock.ticker}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-primary/10 transition-colors"
                          title="TradingView"
                        >
                          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary text-base">
                            open_in_new
                          </span>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Market Gate card */}
              <div
                className={`${gateBg} rounded-xl p-8 shadow-2xl border-l-8 flex flex-col items-center text-center`}
              >
                <span
                  className="material-symbols-outlined text-5xl mb-4"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {gateIcon}
                </span>
                <h5 className="text-3xl font-black tracking-tighter mb-2">{verdict}</h5>
                <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-6 flex items-center justify-center gap-2">
                  Integrated Verdict <HelpBtn topic="verdict" />
                </p>
                <div className="w-full bg-black/10 p-4 rounded-lg mb-4">
                  <p className="text-[10px] font-bold uppercase mb-1">Gate Score</p>
                  <p className="text-4xl font-black">{gateScore}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span>Regime: {r.replace("_", " ")}</span>
                  <span>Conf: {conf}%</span>
                </div>
                <div className="flex gap-4 text-[10px] mt-2 opacity-80">
                  <span>Stop: {adaptive.stop_loss}</span>
                  <span>MDD: {adaptive.max_drawdown_warning}</span>
                </div>
              </div>

              {/* Breadth Gauge */}
              <div className="bg-surface-container-low rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6">
                  Breadth Gauge
                </h4>
                <div className="relative h-4 w-full bg-surface-container-highest rounded-full overflow-hidden mb-2">
                  <div className="absolute top-0 left-0 h-full w-[60%] bg-gradient-to-r from-secondary-fixed-dim to-primary"></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase">
                  <span>Bearish</span>
                  <span>Neutral</span>
                  <span>Bullish</span>
                </div>
              </div>

              {/* AI Feed */}
              <div className="bg-surface-container-low rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6">
                  AI Feed
                </h4>
                <div className="space-y-4">
                  {picks.slice(0, 3).map((stock) => {
                    const isUp = (stock.rs_vs_spy ?? 0) > 0;
                    return (
                      <div key={stock.ticker} className="flex gap-4">
                        <div
                          className={`w-1 h-10 rounded-full ${isUp ? "bg-primary" : "bg-error"}`}
                        ></div>
                        <div>
                          <p className="text-xs text-on-surface font-bold">
                            {stock.action ?? "WATCH"}: {stock.ticker}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            Grade {stock.grade} · Score {stock.composite_score ?? 0} · RS{" "}
                            {(stock.rs_vs_spy ?? 0) > 0 ? "+" : ""}
                            {stock.rs_vs_spy ?? 0}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
