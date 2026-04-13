import { data } from "@/lib/data";
import { barColor } from "@/lib/ui";

export default function MLPage() {
  const GBM = data.gbmPredictions;
  const rows = GBM?.top ?? [];
  const maxScore = Math.max(...rows.map((r) => r.gbm_score), 0.001);

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden mb-6">
      <div className="px-8 py-6 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-high/50">
        <div>
          <h3 className="text-xl font-bold tracking-tight">GBM Cross-Sectional Rankings</h3>
          <p className="text-xs text-on-surface-variant font-medium">
            {rows.length
              ? `${GBM?.model ?? "GBM"} · top ${rows.length} cross-sectional picks`
              : "no data"}
          </p>
        </div>
        <span className="px-4 py-2 bg-surface-container-highest rounded-lg text-[10px] font-bold uppercase tracking-wider">
          20-day horizon
        </span>
      </div>
      <div className="p-4 bg-surface-container-high/20 text-[10px] text-on-surface-variant border-b border-outline-variant/10">
        <b className="text-on-surface">GBM 점수란?</b> — GradientBoosting 모델이 S&amp;P500 전
        종목을 대상으로 20거래일 후 기대 수익률을 예측한 점수(0~1). 높을수록 상대적으로 초과수익
        가능성이 높다는 뜻이며, 같은 시점 전체 종목 분포 내에서의 순위(cross-sectional)입니다.
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/20">
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                #
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Ticker
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Company
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Sector
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                GBM Score
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                Strength
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-xs text-on-surface-variant">
                  output/gbm_predictions.json 없음
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const pct = (r.gbm_score / maxScore) * 100;
                return (
                  <tr key={r.ticker} className="hover:bg-surface-bright/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-on-surface-variant">
                      {r.gbm_rank}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-on-surface">{r.ticker}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface">{r.company_name ?? ""}</td>
                    <td className="px-6 py-4 text-[10px] text-on-surface-variant">
                      {r.sector ?? ""}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-primary">
                      {r.gbm_score.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="flex-1 max-w-[120px] h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className={`h-full ${barColor(pct)}`} style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant w-8 text-right">
                          {Math.round(pct)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
