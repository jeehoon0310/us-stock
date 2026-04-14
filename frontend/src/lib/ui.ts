// Shared UI helpers ported from dashboard/index.html

export const C: Record<string, string> = {
  risk_on: "#3fe56c",
  neutral: "#fdd400",
  risk_off: "#ffb4ab",
  crisis: "#93000a",
};

export const CB: Record<string, string> = {
  risk_on: "rgba(63,229,108,.08)",
  neutral: "rgba(253,212,0,.08)",
  risk_off: "rgba(255,180,171,.08)",
  crisis: "rgba(147,0,10,.08)",
};

export const CG: Record<string, string> = {
  risk_on: "glow-primary",
  neutral: "glow-secondary",
  risk_off: "glow-error",
  crisis: "glow-error",
};

export function gradeClass(g: string | undefined): string {
  const m: Record<string, string> = {
    A: "bg-primary/10 border-primary/20 text-primary",
    B: "bg-secondary/10 border-secondary/20 text-secondary",
    C: "bg-tertiary/10 border-tertiary/20 text-tertiary",
    D: "bg-error/10 border-error/20 text-error",
    F: "bg-error/10 border-error/20 text-error",
  };
  const k = (g ?? "B").charAt(0).toUpperCase();
  return m[k] ?? m.B;
}

export function barColor(s: number): string {
  if (s >= 80) return "bg-primary shadow-[0_0_8px_rgba(63,229,108,.5)]";
  if (s >= 60) return "bg-secondary";
  return "bg-error";
}

export const SIGNAL_NAMES: Record<string, string> = {
  vix: "VIX",
  trend: "Trend",
  breadth: "Breadth",
  credit: "Credit",
  yield_curve: "Yield Curve",
};

export const SIGNAL_WEIGHTS: Record<string, string> = {
  vix: "30%",
  trend: "25%",
  breadth: "18%",
  credit: "15%",
  yield_curve: "12%",
};

export function regimeLabel(r: string): string {
  return r.replace("_", " ").toUpperCase();
}

export function strategyLabel(r: string): string {
  if (r === "risk_on") return "Aggressive";
  if (r === "neutral") return "Balanced";
  return "Defensive";
}

/**
 * 배지 Tailwind className 반환.
 * neutral 은 "" 반환 → regimeBadgeStyle() 로 inline style 처리.
 */
export function regimeBadgeCls(v: string): string {
  if (v === "neutral") return "";
  if (v === "risk_on" || v === "bullish" || v === "GO")
    return "bg-primary-container text-on-primary-container";
  if (v === "risk_off" || v === "crisis" || v === "bearish" || v === "STOP")
    return "bg-error-container text-on-error-container";
  return "bg-secondary-container text-on-secondary-container"; // CAUTION, default
}

/**
 * neutral 전용 inline style (어두운 bg + 노란 텍스트).
 * 나머지 값은 undefined 반환.
 */
export function regimeBadgeStyle(v: string): { background: string; color: string } | undefined {
  if (v === "neutral") return { background: CB.neutral, color: C.neutral };
  return undefined;
}
