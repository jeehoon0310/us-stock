"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { HelpBtn } from "@/components/HelpBtn";

// ── 타입 ────────────────────────────────────────────────────────────────────

type PhaseScores = Record<string, number>;

type SectorRotation = {
  current_phase: string;
  phase_scores: PhaseScores;
  leading_sectors: string[];
  lagging_sectors: string[];
  angle: number;
};

type HeatmapItem = {
  ticker: string;
  name: string;
  color: string;
  current_price: number;
  change_pct: number;
};

type OptionsDetail = {
  ticker: string;
  current_price: number;
  pc_vol_ratio: number;
  pc_oi_ratio: number;
  sentiment: string;
  sentiment_score: number;
  activity: string;
  unusual_call_count: number;
  unusual_put_count: number;
};

type OptionsFlow = {
  overall_sentiment: number;
  stocks_analyzed: number;
  unusual_activity_count: number;
  details: OptionsDetail[];
};

type SectorData = {
  generated_at?: string;
  sector_rotation?: SectorRotation;
  sector_heatmap?: HeatmapItem[] | Record<string, never>;
  options_flow?: OptionsFlow | Record<string, never>;
};

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

const PHASE_STYLE: Record<string, { text: string; border: string; bg: string }> = {
  "Early Cycle": { text: "text-primary",   border: "border-primary",   bg: "bg-primary/15"   },
  "Mid Cycle":   { text: "text-tertiary",  border: "border-tertiary",  bg: "bg-tertiary/15"  },
  "Late Cycle":  { text: "text-secondary", border: "border-secondary", bg: "bg-secondary/15" },
  "Recession":   { text: "text-error",     border: "border-error",     bg: "bg-error/15"     },
};
const PHASE_ICON: Record<string, string> = {
  "Early Cycle": "trending_up",
  "Mid Cycle":   "bar_chart",
  "Late Cycle":  "trending_flat",
  "Recession":   "trending_down",
};

function heatBg(pct: number) {
  if (pct >= 2)   return "border-primary/70 bg-primary/25";
  if (pct >= 0)   return "border-primary/30 bg-primary/10";
  if (pct >= -2)  return "border-error/30 bg-error/10";
  return               "border-error/70 bg-error/25";
}
function heatText(pct: number) {
  return pct >= 0 ? "text-primary" : "text-error";
}

function sentimentStyle(score: number) {
  if (score >= 70) return { text: "text-primary",   bg: "bg-primary/15"   };
  if (score >= 50) return { text: "text-secondary",  bg: "bg-secondary/15" };
  return                  { text: "text-error",      bg: "bg-error/15"     };
}

function etfLabel(ticker: string): string {
  const MAP: Record<string, string> = {
    XLK: "Tech", XLF: "Fin", XLV: "Health", XLY: "Con.D",
    XLP: "Con.S", XLE: "Energy", XLI: "Indust", XLB: "Material",
    XLRE: "R.Est", XLU: "Util", XLC: "Comm",
  };
  return MAP[ticker] ?? ticker;
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">{title}</h2>
        {sub && <p className="text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CycleSection({ rotation }: { rotation: SectorRotation }) {
  const phase = rotation.current_phase;
  const style = PHASE_STYLE[phase] ?? { text: "text-on-surface", border: "border-outline", bg: "bg-surface-container-high" };
  const icon  = PHASE_ICON[phase] ?? "analytics";
  const scores = rotation.phase_scores ?? {};
  const maxScore = Math.max(...Object.values(scores));
  const minScore = Math.min(...Object.values(scores));
  const range = maxScore - minScore || 1;

  return (
    <div className="bg-surface-container-low rounded-xl p-6 mb-6">
      <SectionHeader icon="rotate_right" title="경기 사이클 · Sector Rotation" sub="11개 SPDR ETF 다기간 수익률 가중 평균" />

      {/* Current Phase Hero */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className={`md:col-span-5 rounded-xl p-6 border-2 ${style.border} ${style.bg} flex flex-col justify-between`}>
          <span className={`material-symbols-outlined text-4xl ${style.text}`}>{icon}</span>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              현재 경기 국면
            </p>
            <p className={`text-3xl font-black ${style.text} leading-none`}>{phase}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              각도 {rotation.angle}° · {
                phase === "Early Cycle" ? "금융·소비재·산업재 주도" :
                phase === "Mid Cycle"  ? "기술·통신·소재 주도" :
                phase === "Late Cycle" ? "에너지·리츠 주도" :
                                        "유틸·필수소비재·헬스케어 방어"
              }
            </p>
          </div>
        </div>

        {/* Phase Score Bars */}
        <div className="md:col-span-7 grid grid-cols-2 gap-3">
          {Object.entries(scores).map(([ph, sc]) => {
            const s = PHASE_STYLE[ph] ?? style;
            const isActive = ph === phase;
            const barW = Math.max(8, ((sc - minScore) / range) * 100);
            return (
              <div
                key={ph}
                className={`rounded-xl p-4 border ${isActive ? `${s.border} ${s.bg}` : "border-outline-variant/10 bg-surface-container-high/30"}`}
              >
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">{ph}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isActive ? s.bg.replace('/15','') : 'bg-outline-variant/40'}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${isActive ? s.text : "text-on-surface-variant"}`}>
                    {sc >= 0 ? "+" : ""}{sc.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leading / Lagging */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-container-high/30 rounded-xl p-4">
          <p className="text-[10px] font-bold text-primary uppercase mb-3">↑ 주도 섹터 (Leading)</p>
          <div className="flex flex-wrap gap-2">
            {(rotation.leading_sectors ?? []).map((t) => (
              <span key={t} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary">
                {t} · {etfLabel(t)}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface-container-high/30 rounded-xl p-4">
          <p className="text-[10px] font-bold text-error uppercase mb-3">↓ 열위 섹터 (Lagging)</p>
          <div className="flex flex-wrap gap-2">
            {(rotation.lagging_sectors ?? []).map((t) => (
              <span key={t} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-error/15 text-error">
                {t} · {etfLabel(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapSection({ items }: { items: HeatmapItem[] }) {
  const sorted = [...items].sort((a, b) => b.change_pct - a.change_pct);
  return (
    <div className="bg-surface-container-low rounded-xl p-6 mb-6">
      <SectionHeader icon="grid_view" title="섹터 히트맵 · 11 SPDR ETFs" sub="당일 등락폭 기준 색상 (≥+2% 진초록 / ≤-2% 진빨강)" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sorted.map((s) => (
          <div
            key={s.ticker}
            className={`rounded-xl p-4 border ${heatBg(s.change_pct)} flex flex-col gap-1`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant">{s.ticker}</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: s.color }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant truncate">{s.name}</p>
            <p className={`text-xl font-black ${heatText(s.change_pct)} leading-none`}>
              {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
            </p>
            <p className="text-[10px] text-on-surface-variant">${s.current_price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionsSection({ flow }: { flow: OptionsFlow }) {
  const ss = sentimentStyle(flow.overall_sentiment ?? 50);
  return (
    <div className="bg-surface-container-low rounded-xl p-6">
      <SectionHeader
        icon="candlestick_chart"
        title="옵션 플로우 · Options Flow"
        sub="P/C Ratio 기반 기관 심리 분석"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-5 ${ss.bg}`}>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">전체 심리</p>
          <p className={`text-3xl font-black ${ss.text}`}>{flow.overall_sentiment?.toFixed(1)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">
            {(flow.overall_sentiment ?? 50) >= 70 ? "Very Bullish" :
             (flow.overall_sentiment ?? 50) >= 50 ? "Neutral~Bullish" : "Bearish"}
          </p>
        </div>
        <div className="rounded-xl p-5 bg-surface-container-high/40">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">분석 종목</p>
          <p className="text-3xl font-black text-on-surface">{flow.stocks_analyzed ?? 0}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">종목</p>
        </div>
        <div className="rounded-xl p-5 bg-surface-container-high/40">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Unusual</p>
          <p className={`text-3xl font-black ${(flow.unusual_activity_count ?? 0) > 0 ? "text-tertiary" : "text-on-surface"}`}>
            {flow.unusual_activity_count ?? 0}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1">비정상 활동 종목</p>
        </div>
      </div>

      {/* Per-ticker Table */}
      {(flow.details ?? []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["Ticker", "가격", "P/C Vol", "심리", "Activity"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-on-surface-variant uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flow.details.map((d) => {
                const ds = sentimentStyle(d.sentiment_score ?? 50);
                const isUnusual = d.activity !== "Normal Activity";
                return (
                  <tr
                    key={d.ticker}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-high/20 ${isUnusual ? "bg-tertiary/5" : ""}`}
                  >
                    <td className="py-2 px-3 font-bold text-on-surface">{d.ticker}</td>
                    <td className="py-2 px-3 text-on-surface-variant">
                      ${(d.current_price ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${(d.pc_vol_ratio ?? 1) < 0.7 ? "text-primary" : (d.pc_vol_ratio ?? 1) > 1.3 ? "text-error" : "text-secondary"}`}>
                        {(d.pc_vol_ratio ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ds.bg} ${ds.text}`}>
                        {d.sentiment}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {isUnusual ? (
                        <span className="text-[10px] font-bold text-tertiary">{d.activity}</span>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant">{d.activity}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function SectorPage() {
  const t = useT();
  const [data, setData] = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/data/sector", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SectorData | null) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">pie_chart</span>
        <p className="text-sm font-bold text-on-surface">섹터 데이터 없음</p>
        <p className="text-xs text-on-surface-variant text-center">
          아래 명령어를 실행한 뒤 새로고침하세요
        </p>
        <code className="text-xs bg-surface-container-high px-4 py-2 rounded-lg font-mono text-tertiary">
          python src/us_market/sector_report.py
        </code>
      </div>
    );
  }

  const heatmap = Array.isArray(data.sector_heatmap) ? data.sector_heatmap : [];
  const hasFlow  = data.options_flow && "stocks_analyzed" in (data.options_flow as object);
  const generatedAt = data.generated_at
    ? new Date(data.generated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "";

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 px-5 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">pie_chart</span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Sector Analysis
          </span>
        </div>
        {generatedAt && (
          <span className="text-[10px] text-on-surface-variant">{generatedAt} 기준</span>
        )}
      </div>

      {/* 1. 섹터 순환 */}
      {data.sector_rotation?.current_phase ? (
        <CycleSection rotation={data.sector_rotation} />
      ) : (
        <div className="bg-surface-container-low rounded-xl p-6 mb-6 text-center text-xs text-on-surface-variant">
          섹터 순환 데이터 없음
        </div>
      )}

      {/* 2. 섹터 히트맵 */}
      {heatmap.length > 0 ? (
        <HeatmapSection items={heatmap} />
      ) : (
        <div className="bg-surface-container-low rounded-xl p-6 mb-6 text-center text-xs text-on-surface-variant">
          섹터 히트맵 데이터 없음
        </div>
      )}

      {/* 3. 옵션 플로우 */}
      {hasFlow ? (
        <OptionsSection flow={data.options_flow as OptionsFlow} />
      ) : (
        <div className="bg-surface-container-low rounded-xl p-6 text-center text-xs text-on-surface-variant">
          옵션 플로우 데이터 없음
        </div>
      )}
    </div>
  );
}
