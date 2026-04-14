"use client";
import { useEffect, useState } from "react";
import { HelpBtn } from "@/components/HelpBtn";

type KeyDriver = {
  feature: string;
  importance: number;
  value: number;
  direction: "bullish" | "bearish" | string;
};

type DirectionalPrediction = {
  direction: "bullish" | "bearish" | string;
  probability_up: number;
  predicted_return: number;
  confidence: string;
  confidence_pct: number;
  key_drivers?: KeyDriver[];
  model_accuracy?: number;
  model_trained_at?: string;
};

type MLPredictor = {
  spy?: DirectionalPrediction;
  qqq?: DirectionalPrediction;
};

type DailyReport = {
  data_date?: string;
  market_timing?: { ml_predictor?: MLPredictor };
};

type HistoryEntry = {
  date?: string;
  spy?: { direction?: string; probability?: number };
  qqq?: { direction?: string; probability?: number };
  model_accuracy?: number;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function DirectionCard({ tk, p }: { tk: string; p?: DirectionalPrediction }) {
  if (!p) {
    return (
      <div className="bg-surface-container-low rounded-xl p-8 text-center text-on-surface-variant">
        {tk}: 데이터 없음
      </div>
    );
  }
  const bull = p.direction === "bullish";
  const dc = bull ? "text-primary" : "text-error";
  const arrow = bull ? "arrow_upward" : "arrow_downward";
  const prob = (p.probability_up * 100).toFixed(1);
  const w = Math.min(Math.max(p.probability_up * 100, 0), 100);
  const bc = w >= 60 ? "bg-primary" : w >= 40 ? "bg-tertiary" : "bg-error";
  const rc = p.predicted_return > 0 ? "text-primary" : "text-error";
  const cf =
    p.confidence === "high"
      ? "bg-primary/20 text-primary border-primary/40"
      : p.confidence === "moderate"
        ? "bg-tertiary/20 text-tertiary border-tertiary/40"
        : "bg-surface-container-highest text-on-surface-variant border-outline-variant/30";

  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
            <span className="text-sm font-bold">{tk}</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${dc}`}>
            <span className="material-symbols-outlined text-sm">{arrow}</span>
            {p.direction.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${cf}`}>
            {p.confidence} {p.confidence_pct}%
          </span>
          <HelpBtn topic="ml" value={`${p.direction}:${p.confidence_pct}`} />
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
            Probability (UP) <HelpBtn topic="probability" />
          </p>
          <p className={`text-xs font-bold ${dc}`}>{prob}%</p>
        </div>
        <div className="relative h-3 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full ${bc} transition-all`} style={{ width: `${w}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-surface-container-lowest p-3 rounded-lg">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Predicted Return</p>
          <p className={`text-xl font-black ${rc}`}>
            {p.predicted_return > 0 ? "+" : ""}
            {p.predicted_return}%
          </p>
        </div>
        <div className="bg-surface-container-lowest p-3 rounded-lg">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Model Acc</p>
          <p className="text-xl font-black text-on-surface">
            {p.model_accuracy != null ? (p.model_accuracy * 100).toFixed(1) + "%" : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Drivers({ drivers }: { drivers?: KeyDriver[] }) {
  if (!drivers?.length)
    return <div className="text-xs text-on-surface-variant">No drivers</div>;
  const mx = Math.max(...drivers.map((d) => d.importance), 0.0001);
  return (
    <div className="space-y-3">
      {drivers.map((d, i) => {
        const w = mx > 0 ? (d.importance / mx) * 100 : 0;
        const dcl =
          d.direction === "bullish"
            ? "text-primary"
            : d.direction === "bearish"
              ? "text-error"
              : "text-tertiary";
        const bcl =
          d.direction === "bullish"
            ? "bg-primary"
            : d.direction === "bearish"
              ? "bg-error"
              : "bg-tertiary";
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs font-medium text-on-surface truncate flex-1">
                {d.feature}
              </span>
              <span className={`text-[10px] font-bold ${dcl} uppercase`}>{d.direction}</span>
              <span className="text-xs font-mono text-on-surface-variant w-14 text-right">
                {d.value}
              </span>
            </div>
            <div className="relative h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className={`h-full ${bcl}`} style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ForecastPage() {
  const [date, setDate] = useState<string>(todayStr());
  const [predictor, setPredictor] = useState<MLPredictor | null>(null);
  const [status, setStatus] = useState<string>("로딩 중...");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function loadReport(dateStr: string) {
    const ymd = dateStr.replace(/-/g, "");
    try {
      const r = await fetch(`/data/reports/daily_report_${ymd}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as DailyReport;
      setPredictor(d.market_timing?.ml_predictor ?? null);
      setDate(dateStr);
      setStatus("");
    } catch {
      setPredictor(null);
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
          setPredictor(data.market_timing?.ml_predictor ?? null);
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
        setPredictor(d.market_timing?.ml_predictor ?? null);
        setDate(dateStr);
        setStatus("");
      })
      .catch(() => setStatus("데이터 없음"));

    fetch("/data/prediction_history.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: HistoryEntry[]) => setHistory(d.slice(-20)))
      .catch(() => {});
  }, []);

  const spy = predictor?.spy;
  const qqq = predictor?.qqq;
  const noData = !spy && !qqq;

  const W = 600;
  const H = 80;
  const P = 4;
  const pts = (data: HistoryEntry[], key: "spy" | "qqq") =>
    data
      .map((h, i) => {
        const v = h[key]?.probability ?? 0.5;
        const x = P + (i / Math.max(data.length - 1, 1)) * (W - 2 * P);
        const y = H - P - v * (H - 2 * P);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">Index Forecast <HelpBtn topic="ml" value={spy ? `${spy.direction}:${spy.confidence_pct}` : undefined} /></h3>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">
              다음 5 거래일 방향 예측 · GradientBoosting + TimeSeriesSplit CV
            </p>
          </div>
          {/* Date Navigation */}
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
      </header>

      {/* Direction Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {noData ? (
          <div className="md:col-span-2 bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant">
            {status === "로딩 중..." ? "로딩 중..." : "해당 날짜에 예측 데이터가 없습니다"}
          </div>
        ) : (
          <>
            <DirectionCard tk="SPY" p={spy} />
            <DirectionCard tk="QQQ" p={qqq} />
          </>
        )}
      </section>

      {!noData && (
        <>
          {/* Key Drivers */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface-container-low rounded-xl p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4 flex items-center gap-2">
                Key Drivers (SPY) <HelpBtn topic="drivers" />
              </h4>
              <Drivers drivers={spy?.key_drivers} />
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4 flex items-center gap-2">
                Key Drivers (QQQ) <HelpBtn topic="drivers" />
              </h4>
              <Drivers drivers={qqq?.key_drivers} />
            </div>
          </section>

          {/* Model Info */}
          <section className="bg-surface-container-low rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                Model Info
              </h4>
              <span className="text-[10px] text-on-surface-variant">SPY/QQQ · 5-day horizon</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">SPY CV Acc</p>
                <p className="text-2xl font-black text-primary">
                  {spy?.model_accuracy != null ? (spy.model_accuracy * 100).toFixed(1) + "%" : "—"}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">QQQ CV Acc</p>
                <p className="text-2xl font-black text-primary">
                  {qqq?.model_accuracy != null ? (qqq.model_accuracy * 100).toFixed(1) + "%" : "—"}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Trained</p>
                <p className="text-lg font-bold text-on-surface">
                  {spy?.model_trained_at?.substring(0, 10) ?? "—"}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Features</p>
                <p className="text-2xl font-black text-on-surface">27</p>
              </div>
            </div>
          </section>

          {/* Prediction History */}
          {history.length > 0 && (
            <section className="bg-surface-container-low rounded-xl p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
                Prediction History
              </h4>
              <div className="mb-4">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
                  <line
                    x1="0"
                    y1={H / 2}
                    x2={W}
                    y2={H / 2}
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="2,2"
                  />
                  <polyline
                    points={pts(history, "spy")}
                    fill="none"
                    stroke="#3fe56c"
                    strokeWidth="2"
                    opacity="0.85"
                  />
                  <polyline
                    points={pts(history, "qqq")}
                    fill="none"
                    stroke="#fdd400"
                    strokeWidth="2"
                    opacity="0.85"
                  />
                </svg>
                <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                  <span>
                    <span className="inline-block w-2 h-2 bg-primary rounded-full mr-1"></span>
                    SPY prob_up
                  </span>
                  <span>
                    <span className="inline-block w-2 h-2 bg-tertiary rounded-full mr-1"></span>
                    QQQ prob_up
                  </span>
                  <span className="font-mono">{history.length} entries · 0.5 = neutral</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">SPY</th>
                      <th className="px-4 py-2">SPY Prob</th>
                      <th className="px-4 py-2">QQQ</th>
                      <th className="px-4 py-2">QQQ Prob</th>
                      <th className="px-4 py-2 text-right">Model Acc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {history
                      .slice()
                      .reverse()
                      .map((h, i) => {
                        const sp = h.spy ?? {};
                        const qq = h.qqq ?? {};
                        const sD =
                          sp.direction === "bullish" ? (
                            <span className="text-primary font-bold">↑ UP</span>
                          ) : sp.direction === "bearish" ? (
                            <span className="text-error font-bold">↓ DN</span>
                          ) : (
                            "—"
                          );
                        const qD =
                          qq.direction === "bullish" ? (
                            <span className="text-primary font-bold">↑ UP</span>
                          ) : qq.direction === "bearish" ? (
                            <span className="text-error font-bold">↓ DN</span>
                          ) : (
                            "—"
                          );
                        return (
                          <tr key={i} className="hover:bg-surface-bright/10">
                            <td className="px-4 py-2 text-xs font-mono">{h.date ?? "—"}</td>
                            <td className="px-4 py-2 text-sm">{sD}</td>
                            <td className="px-4 py-2 text-xs font-mono">
                              {sp.probability != null
                                ? (sp.probability * 100).toFixed(1) + "%"
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-sm">{qD}</td>
                            <td className="px-4 py-2 text-xs font-mono">
                              {qq.probability != null
                                ? (qq.probability * 100).toFixed(1) + "%"
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-right">
                              {h.model_accuracy != null ? h.model_accuracy.toFixed(1) + "%" : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
