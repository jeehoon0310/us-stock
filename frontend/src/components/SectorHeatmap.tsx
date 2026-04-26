"use client";

interface SectorData {
  sector?: string;
  name?: string;
  change_pct?: number;
  change_1d?: number;
  momentum?: number;
  [key: string]: unknown;
}

interface Props {
  sectors: SectorData[];
}

function heatBg(pct: number): string {
  if (pct >= 2)  return "border-primary/70 bg-primary/25";
  if (pct >= 0)  return "border-primary/30 bg-primary/10";
  if (pct >= -2) return "border-error/30 bg-error/10";
  return              "border-error/70 bg-error/25";
}

function heatText(pct: number): string {
  return pct >= 0 ? "text-primary" : "text-error";
}

export default function SectorHeatmap({ sectors }: Props) {
  if (!sectors || sectors.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
        섹터 수익률 히트맵
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sectors.map((s, i) => {
          const pct = s.change_pct ?? s.change_1d ?? s.momentum ?? 0;
          const label = s.name ?? s.sector ?? String(i);
          return (
            <div
              key={label}
              className={`rounded-xl p-3 border text-center ${heatBg(pct)}`}
            >
              <div className="text-[10px] font-medium text-on-surface-variant truncate">{label}</div>
              <div className={`text-lg font-black ${heatText(pct)}`}>
                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
