// Build-time JSON imports. Next.js statically analyzes and bakes these into the bundle.
import regimeConfigRaw from "../../public/data/regime_config.json";
import regimeResultRaw from "../../public/data/regime_result.json";
import marketGateRaw from "../../public/data/market_gate.json";
import finalTop10Raw from "../../public/data/final_top10_report.json";
import aiSummariesRaw from "../../public/data/ai_summaries.json";
import gbmPredictionsRaw from "../../public/data/gbm_predictions.json";
import indexPredictionRaw from "../../public/data/index_prediction.json";
import predictionHistoryRaw from "../../public/data/prediction_history.json";
import latestReportRaw from "../../public/data/latest_report.json";

export type Regime = "risk_on" | "neutral" | "risk_off" | "crisis";
export type SignalState = "risk_on" | "neutral" | "risk_off";
export type GateState = "GO" | "CAUTION" | "STOP";
export type Recommendation = "BUY" | "WATCH" | "SMALL BUY" | "HOLD" | string;
export type Grade = "A" | "B" | "C" | "D" | "F" | string;

export interface RegimeConfig {
  regime: Regime;
  weighted_score: number;
  confidence: number;
  signals: {
    vix: SignalState;
    trend: SignalState;
    breadth: SignalState;
    credit: SignalState;
    yield_curve: SignalState;
  };
  adaptive_params: {
    stop_loss: string;
    max_drawdown_warning: string;
  };
}

export interface SectorSignal {
  name: string;
  ticker: string;
  score: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | string;
  price: number;
  change_1d: number;
  rsi: number;
  rs_vs_spy: number;
}

export interface MarketGate {
  gate: GateState;
  score: number;
  reasons: string[];
  metrics: {
    avg_score: number;
    bullish_sectors: number;
    bearish_sectors: number;
    top_sector: string;
    bottom_sector: string;
  };
  sectors: SectorSignal[];
  spy_divergence?: {
    signal: string;
    label: string;
    severity: string;
    spy_price?: number;
    change_10d_pct?: number;
    vol_ratio_2d_vs_20d_avg?: number;
  };
}

export interface TopPick {
  ticker: string;
  quant_score: number;
  grade: Grade;
  ai_score?: number;
  ai_recommendation?: Recommendation;
  ai_contribution?: number;
  final_score: number;
  has_ai?: boolean;
  tech_score?: number;
  fund_score?: number;
  rs_vs_spy?: number;
  company_name?: string;
  sector?: string;
}

export interface Top10Report {
  generated_at: string;
  total_screened: number;
  ai_analyzed: number;
  top10: TopPick[];
}

export type AIPoint = string | { point: string; evidence?: string };

export interface AISummary {
  thesis: string;
  catalysts: AIPoint[];
  bear_cases: AIPoint[];
  recommendation: Recommendation;
  confidence: number | string;
}

export function renderAIPoint(p: AIPoint): { point: string; evidence?: string } {
  if (typeof p === "string") return { point: p };
  return { point: p.point, evidence: p.evidence };
}

export type AISummaries = Record<string, AISummary>;

export interface GbmPrediction {
  ticker: string;
  gbm_score: number;
  gbm_rank: number;
  company_name?: string;
  sector?: string;
}

export interface GbmPredictions {
  total: number;
  top: GbmPrediction[];
  model: string;
  generated_from: string;
}

export interface KeyDriver {
  feature: string;
  importance: number;
  value: number;
  direction: "bullish" | "bearish" | string;
}

export interface DirectionalPrediction {
  direction: "bullish" | "bearish" | string;
  probability_up: number;
  predicted_return: number;
  confidence: string;
  confidence_pct: number;
  key_drivers: KeyDriver[];
}

export interface IndexPrediction {
  date: string;
  predictions: {
    spy: DirectionalPrediction;
    qqq: DirectionalPrediction;
  };
}

export interface PredictionHistoryEntry {
  date: string;
  spy: Partial<DirectionalPrediction>;
  qqq: Partial<DirectionalPrediction>;
  model_accuracy?: number;
}

export interface StockPick {
  ticker: string;
  company_name?: string;
  composite_score?: number;
  grade: Grade;
  grade_label?: string;
  strategy?: string;
  setup?: string;
  technical_score?: number;
  fundamental_score?: number;
  analyst_score?: number;
  rs_score?: number;
  volume_score?: number;
  rs_vs_spy?: number;
  action?: string;
}

export interface DailyReportSummary {
  total_screened?: number;
  grade_distribution?: Record<string, number>;
  strategy_distribution?: Record<string, number>;
  action_distribution?: Record<string, number>;
}

export interface LatestReport {
  generated_at?: string;
  data_date?: string;
  market_timing?: {
    regime: Regime;
    regime_score: number;
    regime_confidence: number;
    gate: GateState;
    gate_score: number;
    ml_predictor?: {
      spy?: DirectionalPrediction;
      qqq?: DirectionalPrediction;
    };
  };
  verdict?: string;
  stock_picks?: StockPick[];
  summary?: DailyReportSummary;
}

export const data = {
  regime: regimeConfigRaw as unknown as RegimeConfig,
  regimeResult: regimeResultRaw as unknown as Record<string, unknown>,
  marketGate: marketGateRaw as unknown as MarketGate,
  top10: finalTop10Raw as unknown as Top10Report,
  aiSummaries: aiSummariesRaw as unknown as AISummaries,
  gbmPredictions: gbmPredictionsRaw as unknown as GbmPredictions,
  indexPrediction: indexPredictionRaw as unknown as IndexPrediction,
  predictionHistory: predictionHistoryRaw as unknown as PredictionHistoryEntry[],
  latestReport: latestReportRaw as unknown as LatestReport,
};

// Helper to format generated_at as KST-friendly string
export function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "—";
  return ts;
}

// Regime color helper
export function regimeColor(r: Regime | string): string {
  switch (r) {
    case "risk_on": return "text-emerald-400";
    case "neutral": return "text-yellow-400";
    case "risk_off": return "text-orange-400";
    case "crisis": return "text-red-500";
    default: return "text-zinc-400";
  }
}

export function gateColor(g: GateState | string): string {
  switch (g) {
    case "GO": return "text-emerald-400";
    case "CAUTION": return "text-yellow-400";
    case "STOP": return "text-red-500";
    default: return "text-zinc-400";
  }
}

export function gradeColor(g: Grade | string): string {
  switch (g) {
    case "A": return "bg-emerald-500 text-black";
    case "B": return "bg-lime-500 text-black";
    case "C": return "bg-yellow-500 text-black";
    case "D": return "bg-orange-500 text-black";
    case "F": return "bg-red-500 text-white";
    default: return "bg-zinc-700 text-white";
  }
}
