import Link from "next/link";
import { data } from "@/lib/data";
import { gradeClass, barColor } from "@/lib/ui";

export default function TopPicksPage() {
  const FR = data.top10;
  const t = FR?.top10 ?? [];

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden">
      <div className="px-8 py-6 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-high/50">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Smart Money Top 10</h3>
          <p className="text-xs text-on-surface-variant font-medium">
            Real-time institutional flow and AI scoring · {FR?.total_screened ?? 0} screened ·{" "}
            {FR?.ai_analyzed ?? 0} AI
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-surface-container-highest rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-bright transition-colors">
            Export
          </button>
          <button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
            Scan Now
          </button>
        </div>
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
                Grade
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Intelligence Score
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                Quant
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                AI
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                Tech
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">
                Fund
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                RS vs SPY
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {t.map((s, i) => {
              const gc = gradeClass(s.grade);
              const bw = Math.min(s.final_score, 100);
              const bc = barColor(bw);
              const rsCol = (s.rs_vs_spy ?? 0) > 0 ? "text-primary" : "text-error";
              const rec = s.ai_recommendation ?? "HOLD";
              const recBg =
                typeof rec === "string" && rec.includes("적극")
                  ? "bg-primary-container text-on-primary font-bold ring-2 ring-primary/20"
                  : typeof rec === "string" && rec.includes("매수")
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
                      <Link
                        href={`/ai#ai-${s.ticker}`}
                        className="text-sm font-black tracking-tight group-hover:text-primary transition-colors"
                      >
                        {s.ticker}
                      </Link>
                      <span className="text-[10px] text-on-surface-variant">
                        {s.company_name ?? ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${gc}`}
                    >
                      {s.grade}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{s.final_score}</span>
                      <div className="flex-1 h-1.5 w-24 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={`${bc} h-full`} style={{ width: `${bw}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center text-sm font-medium">{s.quant_score}</td>
                  <td
                    className={`px-6 py-5 text-center text-sm font-medium ${(s.ai_score ?? 0) > 0 ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {(s.ai_score ?? 0) > 0 ? "+" : ""}
                    {s.ai_score ?? 0}
                  </td>
                  <td className="px-6 py-5 text-center text-sm font-medium">{s.tech_score}</td>
                  <td className="px-6 py-5 text-center text-sm font-medium">{s.fund_score}</td>
                  <td className="px-6 py-5">
                    <span className={`text-sm font-bold ${rsCol}`}>
                      {(s.rs_vs_spy ?? 0) > 0 ? "+" : ""}
                      {s.rs_vs_spy ?? 0}%
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-tighter font-bold ${recBg}`}
                      >
                        {rec}
                      </span>
                      <a
                        href={`https://kr.tradingview.com/chart/?symbol=${s.ticker}`}
                        target="_blank"
                        rel="noopener"
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
    </section>
  );
}
