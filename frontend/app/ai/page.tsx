import { data, renderAIPoint } from "@/lib/data";

export default function AIPage() {
  const AI = data.aiSummaries ?? {};
  const entries = Object.entries(AI);
  const generatedAt = data.top10?.generated_at ?? "";

  if (entries.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant">
        No AI analysis data. Run ai_summary_generator.py first.
      </div>
    );
  }

  return (
    <div>
      {entries.map(([tk, d]) => {
        const rcBg =
          d.recommendation === "BUY"
            ? "from-primary to-primary-container text-on-primary"
            : "from-error to-error-container text-on-error";
        const conf = d.confidence ?? 0;
        const sector = (d as unknown as { sector?: string }).sector ?? "";
        const dataConflicts =
          ((d as unknown as { data_conflicts?: unknown[] }).data_conflicts as unknown[]) ?? [];

        return (
          <div
            key={tk}
            id={`ai-${tk}`}
            className="glass-panel rounded-xl overflow-hidden mb-6 ring-1 ring-outline-variant/30"
          >
            {/* Header */}
            <header className="flex justify-between items-center px-8 py-6 bg-surface-container-lowest/50 border-b border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-on-surface">
                    {tk} AI Analysis
                  </h2>
                  <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">
                    {sector}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${d.recommendation === "BUY" ? "bg-primary/10 text-primary" : "bg-error/10 text-error"}`}
              >
                {d.recommendation ?? "HOLD"}
              </span>
            </header>

            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Thesis + Signal */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                    Investment Thesis
                  </h3>
                  <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20 leading-relaxed text-on-surface">
                    {d.thesis ?? "N/A"}
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/30 flex flex-col items-center text-center">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter mb-2">
                      AI Signal Strength
                    </span>
                    <div className="text-4xl font-black text-primary tracking-tighter text-glow-primary mb-4">
                      {conf}%
                    </div>
                    <div
                      className={`w-full py-3 rounded-lg bg-gradient-to-br ${rcBg} font-bold text-lg text-center`}
                    >
                      {d.recommendation ?? "HOLD"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Catalysts / Bear / Conflicts */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {d.catalysts && d.catalysts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-sm">trending_up</span>
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        Bull Catalysts
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {d.catalysts.map((c, i) => {
                        const r = renderAIPoint(c);
                        return (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-surface-container-lowest border-l-4 border-primary"
                          >
                            <p className="text-sm font-semibold text-on-surface">{r.point}</p>
                            {r.evidence && (
                              <p className="text-xs text-on-surface-variant mt-1 italic">
                                {r.evidence}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div></div>
                )}

                {d.bear_cases && d.bear_cases.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-error">
                      <span className="material-symbols-outlined text-sm">report_problem</span>
                      <h4 className="text-xs font-bold uppercase tracking-widest">Bear Risks</h4>
                    </div>
                    <div className="space-y-3">
                      {d.bear_cases.map((b, i) => {
                        const r = renderAIPoint(b);
                        return (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-surface-container-lowest border-l-4 border-error"
                          >
                            <p className="text-sm font-semibold text-on-surface">{r.point}</p>
                            {r.evidence && (
                              <p className="text-xs text-on-surface-variant mt-1 italic">
                                {r.evidence}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div></div>
                )}

                {dataConflicts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-tertiary">
                      <span className="material-symbols-outlined text-sm">error_med</span>
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        Data Conflicts
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {dataConflicts.map((c, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg bg-surface-container-lowest border-l-4 border-tertiary"
                        >
                          <p className="text-sm font-semibold text-on-surface">{String(c)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div></div>
                )}
              </section>
            </div>

            {/* Footer */}
            <footer className="px-8 py-4 bg-surface-container-lowest/80 flex justify-between items-center text-[10px] text-on-surface-variant/60 uppercase font-medium border-t border-outline-variant/10">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow"></span>
                <span>AI Engine - Neural Analysis Active</span>
              </div>
              <div>{generatedAt}</div>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
