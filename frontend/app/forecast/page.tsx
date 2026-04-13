import { data } from "@/lib/data";
import type { DirectionalPrediction, KeyDriver } from "@/lib/data";

function DirectionCard({ tk, p }: { tk: string; p?: DirectionalPrediction }) {
  if (!p) {
    return (
      <div className="bg-surface-container-low rounded-xl p-8 text-center text-on-surface-variant">
        {tk}: no data
      </div>
    );
  }
  const bull = p.direction === "bullish";
  const dc = bull ? "text-primary" : "text-error";
  const dg = bull ? "glow-primary" : "glow-error";
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
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${dc} ${dg}`}
          >
            <span className="material-symbols-outlined text-sm">{arrow}</span>
            {p.direction.toUpperCase()}
          </span>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${cf}`}
        >
          {p.confidence} {p.confidence_pct}%
        </span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Probability (UP)
          </p>
          <p className={`text-xs font-bold ${dc}`}>{prob}%</p>
        </div>
        <div className="relative h-3 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full ${bc} transition-all`} style={{ width: `${w}%` }}></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-surface-container-lowest p-3 rounded-lg">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">
            Predicted Return
          </p>
          <p className={`text-xl font-black ${rc}`}>
            {p.predicted_return > 0 ? "+" : ""}
            {p.predicted_return}%
          </p>
        </div>
        <div className="bg-surface-container-lowest p-3 rounded-lg">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Horizon</p>
          <p className="text-xl font-black text-on-surface">5D</p>
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
              <div className={`h-full ${bcl}`} style={{ width: `${w}%` }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ForecastPage() {
  const IP = data.indexPrediction;
  const IH = data.predictionHistory ?? [];
  const preds = (IP?.predictions ?? {}) as { spy?: DirectionalPrediction; qqq?: DirectionalPrediction };
  const noData = !preds.spy && !preds.qqq;

  const spyP = preds.spy as DirectionalPrediction | undefined;
  const qqqP = preds.qqq as DirectionalPrediction | undefined;
  const spyExtra = spyP as unknown as { model_accuracy?: number; model_trained_at?: string } | undefined;
  const qqqExtra = qqqP as unknown as { model_accuracy?: number } | undefined;
  const spyAcc =
    spyExtra?.model_accuracy != null ? (spyExtra.model_accuracy * 100).toFixed(1) : "—";
  const qqqAcc =
    qqqExtra?.model_accuracy != null ? (qqqExtra.model_accuracy * 100).toFixed(1) : "—";
  const trainedAt = spyExtra?.model_trained_at?.substring(0, 10) ?? "—";
  const aD: number | string = spyExtra?.model_trained_at
    ? Math.floor((Date.now() - new Date(spyExtra.model_trained_at).getTime()) / 86400000)
    : "—";

  const hist = (IH ?? []).slice(-20);
  const W = 600;
  const H = 80;
  const P = 4;
  const pts = (k: "spy" | "qqq") =>
    hist
      .map((h, i) => {
        const obj = (h as unknown as Record<string, { probability?: number }>)[k] ?? {};
        const v = obj.probability ?? 0.5;
        const x = P + (i / Math.max(hist.length - 1, 1)) * (W - 2 * P);
        const y = H - P - v * (H - 2 * P);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-on-surface">Index Forecast</h3>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">
              다음 5 거래일 방향 예측 · GradientBoosting + TimeSeriesSplit CV
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              As of
            </p>
            <p className="text-sm font-bold text-primary">{IP?.date ?? "—"}</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {noData ? (
          <div className="md:col-span-2 bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant">
            모델 미학습.{" "}
            <code className="bg-surface-container-highest px-2 py-1 rounded text-xs">
              python us_market/index_predictor.py
            </code>{" "}
            를 먼저 실행하세요.
          </div>
        ) : (
          <>
            <DirectionCard tk="SPY" p={spyP} />
            <DirectionCard tk="QQQ" p={qqqP} />
          </>
        )}
      </section>

      {!noData && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface-container-low rounded-xl p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
                Key Drivers (SPY)
              </h4>
              <Drivers drivers={spyP?.key_drivers} />
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
                Key Drivers (QQQ)
              </h4>
              <Drivers drivers={qqqP?.key_drivers} />
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                Model Info
              </h4>
              <span className="text-[10px] text-on-surface-variant">SPY/QQQ · 5-day horizon</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                  SPY CV Acc
                </p>
                <p className="text-2xl font-black text-primary">{spyAcc}%</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                  QQQ CV Acc
                </p>
                <p className="text-2xl font-black text-primary">{qqqAcc}%</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Trained</p>
                <p className="text-lg font-bold text-on-surface">{trainedAt}</p>
                <p className="text-[10px] text-on-surface-variant">
                  {aD === "—" ? "—" : `${aD}d ago`}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Features</p>
                <p className="text-2xl font-black text-on-surface">27</p>
              </div>
            </div>

            <details className="bg-surface-container-high/30 rounded-lg p-4 mb-3">
              <summary className="text-xs font-bold text-on-surface cursor-pointer select-none flex items-center justify-between">
                <span>27개 피처 · 8개 카테고리 (클릭해서 펼치기)</span>
                <span className="material-symbols-outlined text-sm text-on-surface-variant">
                  expand_more
                </span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">SPY · 7개</p>
                  <p className="text-on-surface-variant">
                    returns(1d/1w/1m), SMA 편차, RSI, MACD, BB 위치
                  </p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-error/20">
                  <p className="font-bold text-error mb-1">
                    VIX · 4개 <span className="text-[9px]">(INVERSE)</span>
                  </p>
                  <p className="text-on-surface-variant">
                    value, change, percentile, above_20. 양수=bearish
                  </p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">QQQ · 2개</p>
                  <p className="text-on-surface-variant">return_1w, RSI</p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">시장폭 · 2개</p>
                  <p className="text-on-surface-variant">
                    50MA 상회 %, Advance/Decline(Laplace smoothed)
                  </p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">섹터 · 3개</p>
                  <p className="text-on-surface-variant">XLK / XLU* / XLY 상대강도 vs SPY (1M)</p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-error/20">
                  <p className="font-bold text-error mb-1">
                    매크로 · 3개 <span className="text-[9px]">(일부 INVERSE)</span>
                  </p>
                  <p className="text-on-surface-variant">TNX-FVX 스프레드, GOLD, DXY*</p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">거래량 · 3개</p>
                  <p className="text-on-surface-variant">SPY/QQQ 거래량 비율, 5일 추세</p>
                </div>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/10">
                  <p className="font-bold text-primary mb-1">모멘텀 · 3개</p>
                  <p className="text-on-surface-variant">ROC_10d, 50MA %, RSI slope</p>
                </div>
              </div>
              <p className="text-[9px] text-error mt-3 italic">
                * INVERSE 피처: 값이 오르면 시장엔 악재로 작용 (vix_*, xlu_relative, dxy_return)
              </p>
            </details>

            <details className="bg-surface-container-high/30 rounded-lg p-4">
              <summary className="text-xs font-bold text-on-surface cursor-pointer select-none flex items-center justify-between">
                <span>Confidence 등급 기준</span>
                <span className="material-symbols-outlined text-sm text-on-surface-variant">
                  expand_more
                </span>
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 rounded bg-primary-container/20 border border-primary/30">
                  <p className="font-bold text-primary mb-1">HIGH ≥ 70%</p>
                  <p className="text-on-surface-variant">
                    예측 확률이 70% 이상. 신호 강도 강함.
                  </p>
                </div>
                <div className="p-3 rounded bg-secondary-container/20 border border-secondary/30">
                  <p className="font-bold text-secondary mb-1">MODERATE 60~70%</p>
                  <p className="text-on-surface-variant">60~70% 사이. 참고용, 단독 결정 금물.</p>
                </div>
                <div className="p-3 rounded bg-error-container/20 border border-error/30">
                  <p className="font-bold text-error mb-1">LOW &lt; 60%</p>
                  <p className="text-on-surface-variant">60% 미만. 시장 불확실성 신호.</p>
                </div>
              </div>
            </details>
          </section>

          <section className="bg-surface-container-low rounded-xl p-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
              Prediction History
            </h4>
            {hist.length > 0 && (
              <div className="mb-4">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-20"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="0"
                    y1={H / 2}
                    x2={W}
                    y2={H / 2}
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="2,2"
                  />
                  <polyline
                    points={pts("spy")}
                    fill="none"
                    stroke="#3fe56c"
                    strokeWidth="2"
                    opacity="0.85"
                  />
                  <polyline
                    points={pts("qqq")}
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
                  <span className="font-mono">
                    {hist.length}/{IH.length} entries · 0.5 = neutral
                  </span>
                </div>
              </div>
            )}
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
                  {hist.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-xs text-on-surface-variant"
                      >
                        No history yet
                      </td>
                    </tr>
                  ) : (
                    hist
                      .slice()
                      .reverse()
                      .map((h, i) => {
                        const sp =
                          (h as unknown as { spy?: { direction?: string; probability?: number } })
                            .spy ?? {};
                        const qq =
                          (h as unknown as { qqq?: { direction?: string; probability?: number } })
                            .qqq ?? {};
                        const sD = sp.direction ? (
                          sp.direction === "bullish" ? (
                            <span className="text-primary font-bold">↑ UP</span>
                          ) : (
                            <span className="text-error font-bold">↓ DN</span>
                          )
                        ) : (
                          "—"
                        );
                        const qD = qq.direction ? (
                          qq.direction === "bullish" ? (
                            <span className="text-primary font-bold">↑ UP</span>
                          ) : (
                            <span className="text-error font-bold">↓ DN</span>
                          )
                        ) : (
                          "—"
                        );
                        const sP =
                          sp.probability != null ? (sp.probability * 100).toFixed(1) + "%" : "—";
                        const qP =
                          qq.probability != null ? (qq.probability * 100).toFixed(1) + "%" : "—";
                        const acc = (h as unknown as { model_accuracy?: number }).model_accuracy;
                        return (
                          <tr key={i} className="hover:bg-surface-bright/10">
                            <td className="px-4 py-2 text-xs font-mono">
                              {(h as unknown as { date?: string }).date ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-sm">{sD}</td>
                            <td className="px-4 py-2 text-xs font-mono">{sP}</td>
                            <td className="px-4 py-2 text-sm">{qD}</td>
                            <td className="px-4 py-2 text-xs font-mono">{qP}</td>
                            <td className="px-4 py-2 text-xs font-mono text-right">
                              {acc != null ? acc.toFixed(1) + "%" : "—"}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
