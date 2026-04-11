export default function CostsPage() {
  return (
    <div>
      <div className="bg-surface-container-low rounded-xl p-6 mb-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-6">
          API Pricing
        </h4>
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
          Estimated Cost (10 stocks)
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
