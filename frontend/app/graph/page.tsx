"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ForceGraph, GraphData, GraphNode, TYPE_COLORS } from "@/components/ForceGraph";
import { HelpBtn } from "@/components/HelpBtn";
import { CalendarPicker } from "@/components/CalendarPicker";
import { gradeClass } from "@/lib/ui";
import { useT } from "@/lib/i18n";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type DatePickRow = { ticker: string; grade: string; action?: string };

type StockPick = {
  ticker: string; company_name?: string; composite_score?: number;
  grade: string; action?: string; strategy?: string; setup?: string;
  technical_score?: number; fundamental_score?: number; analyst_score?: number;
  rs_score?: number; volume_score?: number; "13f_score"?: number;
  rs_vs_spy?: number;
};
type KeyDriver = { feature: string; direction: "bullish" | "bearish"; value: number };
type MarketTiming = {
  regime: string; regime_confidence?: number; gate?: string;
  signals?: Record<string, string>;
  ml_predictor?: {
    spy?: { direction: string; confidence_pct?: number; predicted_return?: number; key_drivers?: KeyDriver[] };
    qqq?: { direction: string; confidence_pct?: number; key_drivers?: KeyDriver[] };
  };
};
type DailyReport = {
  data_date?: string;
  verdict?: string;
  stock_picks?: StockPick[];
  market_timing?: MarketTiming;
};
type RiskSummary = {
  portfolio_summary?: {
    invested_pct?: number;
    cash_pct?: number;
    total_var_dollar?: number;
    risk_budget_status?: string;
  };
  alerts?: Array<{ level: string }>;
};

// ── 타입 ─────────────────────────────────────────────────────────

type GraphJson = {
  generated_at: string;
  system_graph: GraphData;
  stock_graph: GraphData;
  stock_market_graph: GraphData;
};

type TabId = "system" | "stock" | "market";

// ── 노드 타입 레이블 ─────────────────────────────────────────────

const TYPE_LABEL_KEYS: Record<string, string> = {
  data_source: "graph.typeDataSource",
  collector:   "graph.typeCollector",
  analyzer:    "graph.typeAnalyzer",
  signal:      "graph.typeSignal",
  output:      "graph.typeOutput",
  page:        "graph.typeDashboardPage",
  ticker:      "graph.typeStockTicker",
  sector:        "graph.typeSector",
  agent:         "graph.typeAiAgent",
  sub_indicator: "graph.typeSubIndicator",
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  feeds:       "데이터 공급",
  produces:    "결과 생성",
  determines:  "판정 영향",
  gates:       "진입 게이팅",
  enhances:    "분석 보강",
  displays:    "페이지 표시",
  correlation: "가격 상관관계",
  sector_peer: "동일 섹터",
};

// ── 비개발자용 관계 맥락 설명 ────────────────────────────────────────
function getEdgeContext(
  isOutgoing: boolean,
  edgeType: string,
  thisName: string,
  otherName: string
): string {
  if (isOutgoing) {
    switch (edgeType) {
      case "determines":  return `${thisName} 상태가 ${otherName} 투자 판단에 직접 영향을 줍니다`;
      case "gates":       return `${thisName} 신호에 따라 ${otherName} 진입 여부가 결정됩니다`;
      case "correlation": return `${thisName} 방향과 ${otherName}는 가격 상관관계가 있습니다`;
      case "displays":    return `${otherName} 페이지에 이 분석 결과가 표시됩니다`;
      case "enhances":    return `AI Builder가 ${otherName}에 인사이트를 제공합니다`;
      case "feeds":       return `${thisName} 데이터가 ${otherName}으로 공급됩니다`;
      case "produces":    return `${thisName}이 ${otherName}을 생성합니다`;
      case "sector_peer": return `${otherName}와 같은 섹터 종목입니다`;
      default: return EDGE_TYPE_LABELS[edgeType] ?? edgeType;
    }
  } else {
    switch (edgeType) {
      case "determines":  return `${otherName} 신호가 이 종목 투자 판단에 직접 영향을 줍니다`;
      case "gates":       return `${otherName} 신호가 이 종목 진입 여부를 결정합니다`;
      case "correlation": return `${otherName} 방향과 이 종목은 가격 상관관계가 있습니다`;
      case "displays":    return `이 분석 결과가 ${otherName} 페이지에 표시됩니다`;
      case "enhances":    return `${otherName}이 이 노드 분석을 강화합니다`;
      case "feeds":       return `${otherName} 데이터가 이 노드로 공급됩니다`;
      case "produces":    return `${otherName}이 이 노드를 생성합니다`;
      case "sector_peer": return `${otherName}와 같은 섹터 종목입니다`;
      default: return EDGE_TYPE_LABELS[edgeType] ?? edgeType;
    }
  }
}

// ── 종목 중심 그래프 빌더 ─────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  spy_vol_trend_5d:      "SPY 5D VOL",
  yield_spread_proxy:    "YIELD SPREAD",
  spy_price_vs_50ma_pct: "SPY VS 50MA",
  xlu_relative_1m:       "XLU 1M RS",
  spy_return_1m:         "SPY 1M RET",
};

function buildTickerGraph(ticker: string, report: DailyReport, risk?: RiskSummary | null): GraphData {
  const pick = report.stock_picks?.find((p) => p.ticker === ticker);
  const mt = report.market_timing;
  const sigs = mt?.signals ?? {};

  const regimeColor = (r?: string) =>
    r === "risk_on" ? "#4ade80" : r === "risk_off" ? "#f87171" : "#facc15";
  const dirColor = (d?: string) =>
    d === "bullish" ? "#4ade80" : d === "bearish" ? "#f87171" : "#facc15";
  const gradeColor = (g?: string) =>
    g === "A" ? "#4ade80" : g === "B" ? "#86efac" : g === "C" ? "#facc15" : "#f87171";
  const scoreColor = (v?: number) =>
    v === undefined ? "#64748b" : v >= 75 ? "#4ade80" : v >= 50 ? "#facc15" : "#f87171";
  const gateColor = (g?: string) =>
    g === "GO" ? "#4ade80" : g === "STOP" ? "#f87171" : "#facc15";
  const riskBudgetColor = (s?: string) =>
    s === "EXCEEDED" ? "#f87171" : s === "WARNING" ? "#facc15" : "#4ade80";

  const crit = risk?.alerts?.filter((a) => a.level === "CRITICAL").length ?? 0;
  const warn = risk?.alerts?.filter((a) => a.level === "WARNING").length ?? 0;
  const riskStatusColor = crit > 0 ? "#f87171" : warn > 0 ? "#facc15" : "#4ade80";
  const budgetStatus = risk?.portfolio_summary?.risk_budget_status;

  const sub = (id: string, name: string, color: string, desc?: string): GraphNode => ({
    id, name, type: "sub_indicator", color, description: desc,
  });

  const spyKd = mt?.ml_predictor?.spy?.key_drivers?.slice(0, 5) ?? [];

  const nodes: GraphNode[] = [
    // ── Level 1: ticker ──────────────────────────────────────────────
    {
      id: ticker, name: ticker, type: "ticker",
      description: `${pick?.company_name ?? ""} · Grade ${pick?.grade ?? "?"} · Score ${pick?.composite_score?.toFixed(1) ?? "?"}`,
      color: gradeColor(pick?.grade),
      weight: 14,
    },
    // ── Level 2: 6 indicator nodes ───────────────────────────────────
    {
      id: "ind_regime", name: "Market Regime", type: "signal",
      description: `${mt?.regime?.toUpperCase() ?? "—"} · 신뢰도 ${mt?.regime_confidence?.toFixed(0) ?? "?"}% · Gate ${mt?.gate ?? "?"}`,
      color: regimeColor(mt?.regime),
    },
    {
      id: "ind_ai", name: "AI Analysis", type: "agent",
      description: "AI 심층 분석 (thesis + catalysts + bear cases)",
      color: "#a78bfa",
    },
    {
      id: "ind_forecast", name: "Index Forecast", type: "signal",
      description: `SPY ${mt?.ml_predictor?.spy?.direction?.toUpperCase() ?? "—"} · ${((mt?.ml_predictor?.spy?.predicted_return ?? 0) * 100).toFixed(2)}% · 신뢰도 ${mt?.ml_predictor?.spy?.confidence_pct?.toFixed(0) ?? "?"}%`,
      color: dirColor(mt?.ml_predictor?.spy?.direction),
    },
    {
      id: "ind_ml", name: "ML Rankings", type: "analyzer",
      description: `Composite ${pick?.composite_score?.toFixed(1) ?? "?"} · Tech ${pick?.technical_score ?? "?"} / Fund ${pick?.fundamental_score ?? "?"} / Analyst ${pick?.analyst_score ?? "?"}`,
      color: gradeColor(pick?.grade),
    },
    {
      id: "ind_risk", name: "Risk Monitor", type: "output",
      description: `Adaptive stop-loss ${mt?.ml_predictor?.spy?.direction === "bearish" ? "강화" : "기준"} · 포지션 진입 전 확인`,
      color: "#fb923c",
    },
    {
      id: "ind_perf", name: "Performance", type: "output",
      description: `vs SPY ${pick?.rs_vs_spy !== undefined ? (pick.rs_vs_spy >= 0 ? "+" : "") + pick.rs_vs_spy.toFixed(1) + "%" : "—"} · ${pick?.strategy ?? "?"} / ${pick?.setup ?? "?"}`,
      color: (pick?.rs_vs_spy ?? 0) >= 0 ? "#4ade80" : "#f87171",
    },
    // ── Level 3: Market Regime 서브 9개 ─────────────────────────────
    sub("sub_r_spy5d", "SPY 5D",      dirColor(mt?.ml_predictor?.spy?.direction)),
    sub("sub_r_qqq5d", "QQQ 5D",      dirColor(mt?.ml_predictor?.qqq?.direction)),
    sub("sub_r_gate",  "GATE",        gateColor(mt?.gate)),
    sub("sub_r_vix",   "VIX",         regimeColor(sigs.vix)),
    sub("sub_r_trend", "TREND",       regimeColor(sigs.trend)),
    sub("sub_r_bread", "BREADTH",     regimeColor(sigs.breadth)),
    sub("sub_r_cred",  "CREDIT",      regimeColor(sigs.credit)),
    sub("sub_r_yield", "YIELD CURVE", regimeColor(sigs.yield_curve)),
    sub("sub_r_pc",    "PUT/CALL",    regimeColor(sigs.put_call)),
    // ── Level 3: AI Analysis 서브 5개 ───────────────────────────────
    sub("sub_ai_comp", "COMPOSITE",   scoreColor(pick?.composite_score)),
    sub("sub_ai_tech", "TECHNICAL",   scoreColor(pick?.technical_score)),
    sub("sub_ai_fund", "FUNDAMENTAL", scoreColor(pick?.fundamental_score)),
    sub("sub_ai_anl",  "ANALYST",     scoreColor(pick?.analyst_score)),
    sub("sub_ai_rs",   "RS VS SPY",   (pick?.rs_vs_spy ?? 0) >= 0 ? "#4ade80" : "#f87171"),
    // ── Level 3: Index Forecast 서브 SPY + QQQ ──────────────────────
    sub("sub_fc_spy", "SPY", dirColor(mt?.ml_predictor?.spy?.direction)),
    sub("sub_fc_qqq", "QQQ", dirColor(mt?.ml_predictor?.qqq?.direction)),
    // ── Level 4: SPY Key Drivers 5개 ────────────────────────────────
    ...spyKd.map((kd, i) =>
      sub(`sub_fc_kd_${i}`, FEATURE_LABELS[kd.feature] ?? kd.feature, dirColor(kd.direction))
    ),
    // ── Level 3: ML Rankings 서브 9개 ───────────────────────────────
    sub("sub_ml_comp", "COMPOSITE", scoreColor(pick?.composite_score)),
    sub("sub_ml_tech", "TECH",      scoreColor(pick?.technical_score)),
    sub("sub_ml_fund", "FUND",      scoreColor(pick?.fundamental_score)),
    sub("sub_ml_anl",  "ANALYST",   scoreColor(pick?.analyst_score)),
    sub("sub_ml_rs",   "RS SCORE",  scoreColor(pick?.rs_score)),
    sub("sub_ml_vol",  "VOLUME",    scoreColor(pick?.volume_score)),
    sub("sub_ml_13f",  "13F",       scoreColor(pick?.["13f_score"])),
    sub("sub_ml_spy",  "RS VS SPY", (pick?.rs_vs_spy ?? 0) >= 0 ? "#4ade80" : "#f87171"),
    sub("sub_ml_str",  "STREND",    scoreColor(pick?.composite_score)),
    // ── Level 3: Risk Monitor 서브 4개 ──────────────────────────────
    sub("sub_rk_stat",  "RISK STATUS", riskStatusColor),
    sub("sub_rk_alloc", "ALLOCATION",  "#22d3ee"),
    sub("sub_rk_var",   "VAR(5D)",     riskBudgetColor(budgetStatus)),
    sub("sub_rk_budg",  "RISK BUDGET", riskBudgetColor(budgetStatus)),
  ];

  const edges = [
    // ── Level 1→2 ────────────────────────────────────────────────────
    { source: "ind_regime",   target: ticker, type: "determines" },
    { source: "ind_ai",       target: ticker, type: "enhances" },
    { source: "ind_forecast", target: ticker, type: "determines" },
    { source: "ind_ml",       target: ticker, type: "produces" },
    { source: "ind_risk",     target: ticker, type: "gates" },
    { source: "ind_perf",     target: ticker, type: "displays" },
    // ── Market Regime 서브 ───────────────────────────────────────────
    { source: "ind_regime", target: "sub_r_spy5d", type: "feeds" },
    { source: "ind_regime", target: "sub_r_qqq5d", type: "feeds" },
    { source: "ind_regime", target: "sub_r_gate",  type: "feeds" },
    { source: "ind_regime", target: "sub_r_vix",   type: "feeds" },
    { source: "ind_regime", target: "sub_r_trend", type: "feeds" },
    { source: "ind_regime", target: "sub_r_bread", type: "feeds" },
    { source: "ind_regime", target: "sub_r_cred",  type: "feeds" },
    { source: "ind_regime", target: "sub_r_yield", type: "feeds" },
    { source: "ind_regime", target: "sub_r_pc",    type: "feeds" },
    // ── AI Analysis 서브 ─────────────────────────────────────────────
    { source: "ind_ai", target: "sub_ai_comp", type: "feeds" },
    { source: "ind_ai", target: "sub_ai_tech", type: "feeds" },
    { source: "ind_ai", target: "sub_ai_fund", type: "feeds" },
    { source: "ind_ai", target: "sub_ai_anl",  type: "feeds" },
    { source: "ind_ai", target: "sub_ai_rs",   type: "feeds" },
    // ── Index Forecast 서브 ──────────────────────────────────────────
    { source: "ind_forecast", target: "sub_fc_spy", type: "feeds" },
    { source: "ind_forecast", target: "sub_fc_qqq", type: "feeds" },
    ...spyKd.map((_, i) => ({ source: "sub_fc_spy", target: `sub_fc_kd_${i}`, type: "feeds" })),
    // ── ML Rankings 서브 ─────────────────────────────────────────────
    { source: "ind_ml", target: "sub_ml_comp", type: "feeds" },
    { source: "ind_ml", target: "sub_ml_tech", type: "feeds" },
    { source: "ind_ml", target: "sub_ml_fund", type: "feeds" },
    { source: "ind_ml", target: "sub_ml_anl",  type: "feeds" },
    { source: "ind_ml", target: "sub_ml_rs",   type: "feeds" },
    { source: "ind_ml", target: "sub_ml_vol",  type: "feeds" },
    { source: "ind_ml", target: "sub_ml_13f",  type: "feeds" },
    { source: "ind_ml", target: "sub_ml_spy",  type: "feeds" },
    { source: "ind_ml", target: "sub_ml_str",  type: "feeds" },
    // ── Risk Monitor 서브 ────────────────────────────────────────────
    { source: "ind_risk", target: "sub_rk_stat",  type: "feeds" },
    { source: "ind_risk", target: "sub_rk_alloc", type: "feeds" },
    { source: "ind_risk", target: "sub_rk_var",   type: "feeds" },
    { source: "ind_risk", target: "sub_rk_budg",  type: "feeds" },
  ];

  return { nodes, edges };
}

// ── 페이지 ───────────────────────────────────────────────────────

export default function GraphPage() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<GraphJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // 날짜별 종목 검색 상태
  const [date, setDate] = useState<string>(todayStr());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [dateTickers, setDateTickers] = useState<DatePickRow[]>([]);
  const [dateStatus, setDateStatus] = useState<string>("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [fullReport, setFullReport] = useState<DailyReport | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function loadTickersForDate(dateStr: string) {
    setDateStatus("");
    setSelectedTicker(null);
    try {
      const r = await fetch(`/api/data/reports?date=${dateStr}`, { cache: "no-store" });
      if (!r.ok) {
        setDateTickers([]);
        setDate(dateStr);
        setDateStatus("데이터 없음");
        return;
      }
      const d = (await r.json()) as DailyReport & { stock_picks?: Array<StockPick & { [k: string]: unknown }> };
      setDateTickers((d.stock_picks ?? []).map((p) => ({ ticker: p.ticker, grade: p.grade, action: p.action })));
      setFullReport(d);
      setDate(d.data_date ?? dateStr);
    } catch {
      setDateTickers([]);
      setDate(dateStr);
      setDateStatus("데이터 없음");
    }
  }

  function shiftDate(delta: number) {
    if (availableDates.size === 0) return;
    const sorted = Array.from(availableDates).sort();
    const idx = sorted.indexOf(date);
    if (idx === -1) return;
    const next = sorted[idx + delta];
    if (next) void loadTickersForDate(next);
  }

  useEffect(() => {
    fetch("/api/data/graph", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: GraphJson) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 날짜 manifest + 최신 Top Picks 리스트
    fetch("/api/data/dates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { dates: string[] }) => setAvailableDates(new Set(d.dates)))
      .catch(() => {});

    fetch("/api/data/reports?date=latest", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (DailyReport & { stock_picks?: Array<StockPick & { [k: string]: unknown }> }) | null) => {
        if (!d) return;
        setDate(d.data_date ?? todayStr());
        setDateTickers((d.stock_picks ?? []).map((p) => ({ ticker: p.ticker, grade: p.grade, action: p.action })));
        setFullReport(d);
      })
      .catch(() => {});

    fetch("/api/data/risk?date=latest", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RiskSummary | null) => { if (d) setRiskSummary(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setSelectedNode(null);
    setSelectedTicker(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-container-low rounded-xl p-10 text-center">
        <p className="text-on-surface-variant">
          {t("common.noData")}
        </p>
      </div>
    );
  }

  const currentGraph =
    selectedTicker && fullReport
      ? buildTickerGraph(selectedTicker, fullReport, riskSummary)
      : activeTab === "system" ? data.system_graph
      : activeTab === "stock"  ? data.stock_graph
      : (data.stock_market_graph ?? data.stock_graph);

  // 선택된 노드의 연결 엣지 수
  const nodeEdges = selectedNode
    ? currentGraph.edges.filter((e) => {
        const src =
          typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const tgt =
          typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        return src === selectedNode.id || tgt === selectedNode.id;
      })
    : [];

  const incomingCount = nodeEdges.filter((e) => {
    const tgt =
      typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    return tgt === selectedNode?.id;
  }).length;

  const outgoingCount = nodeEdges.filter((e) => {
    const src =
      typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    return src === selectedNode?.id;
  }).length;

  return (
    <div className="space-y-6">
      {/* Explore Stock bar — date + ticker selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="material-symbols-outlined text-primary text-lg">travel_explore</span>
          <span className="hidden sm:inline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Explore Stock
          </span>
          <HelpBtn topic="picks" value={dateTickers.length} />
          <select
            value={selectedTicker ?? ""}
            onChange={(e) => {
              const tk = e.target.value;
              if (tk) {
                setSelectedTicker(tk);
                setSelectedNode(null);
              }
            }}
            disabled={dateTickers.length === 0}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1 text-sm font-bold text-primary min-w-[180px] cursor-pointer outline-none focus:border-primary transition-colors disabled:opacity-50"
            title="해당 날짜 Top Picks 종목 선택 → 종목 중심 그래프로 전환"
          >
            <option value="">
              {dateTickers.length > 0
                ? `종목 상세 이동… (${dateTickers.length}종목)`
                : dateStatus || "데이터 로딩 중…"}
            </option>
            {dateTickers.map((p, i) => (
              <option key={p.ticker} value={p.ticker}>
                #{String(i + 1).padStart(2, "0")} {p.ticker}
                {p.grade ? `  [${p.grade}]` : ""}
                {p.action ? `  · ${p.action}` : ""}
              </option>
            ))}
          </select>
          {selectedTicker ? (
            <span className="text-[10px] text-primary font-bold hidden md:inline">
              → {selectedTicker} 중심 그래프 표시 중
            </span>
          ) : (
            <span className="text-[10px] text-on-surface-variant hidden md:inline">
              → 종목 선택 시 인디케이터 연관 그래프로 전환
            </span>
          )}
        </div>
        <CalendarPicker
          value={date}
          availableDates={availableDates}
          onChange={(d) => void loadTickersForDate(d)}
          onShift={shiftDate}
          status={dateStatus || undefined}
        />
      </div>

      {/* Header */}
      <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            {t("graph.title")} <HelpBtn topic="graph" />
          </h2>
          <p className="text-sm text-on-surface-variant">
            데이터 흐름 아키텍처 + 종목 상관관계 네트워크 · 생성일{" "}
            {data.generated_at}
          </p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "120px" }}
          >
            hub
          </span>
        </div>
      </div>

      {/* 탭 + 범례 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          {(["system", "stock", "market"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab && !selectedTicker
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-base align-middle mr-1">
                {tab === "system" ? "account_tree" : tab === "stock" ? "scatter_plot" : "hub"}
              </span>
              {tab === "system" ? "시스템 아키텍처" : tab === "stock" ? "종목 네트워크" : "종목-시장 관계"}
            </button>
          ))}
          {selectedTicker && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-primary rounded-lg text-on-primary text-sm font-bold">
              <span className="material-symbols-outlined text-base align-middle">insights</span>
              <span>{selectedTicker} 중심</span>
              <button
                onClick={() => setSelectedTicker(null)}
                className="ml-1 hover:opacity-70 transition-opacity"
                title="종목 뷰 닫기"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(TYPE_LABEL_KEYS)
            .filter(([type]) => {
              if (selectedTicker) return ["ticker", "signal", "agent", "analyzer", "output", "sub_indicator"].includes(type);
              if (activeTab === "system") return !["ticker", "sector", "agent"].includes(type);
              if (activeTab === "stock")  return ["ticker", "sector"].includes(type);
              return ["ticker", "signal", "page", "agent"].includes(type);
            })
            .map(([type, key]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="text-[10px] text-on-surface-variant">{t(key)}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 종목 중심 뷰 배너 */}
      {selectedTicker && fullReport && (
        <div className="bg-surface-container-high rounded-xl p-4 flex gap-3 items-start border border-primary/20">
          <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">hub</span>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-bold text-on-surface">
              {selectedTicker} · 6개 인디케이터 · 34개 세부 항목
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Market Regime · AI Analysis · Index Forecast · ML Rankings · Risk Monitor · Performance가{" "}
              <span className="text-primary font-bold">{selectedTicker}</span>와 어떻게 연결되는지 보여줍니다.
              노드를 클릭하면 각 인디케이터의 현재 상태와 연결 의미를 확인할 수 있어요.
            </p>
          </div>
          <button
            onClick={() => router.push(`/stock/${selectedTicker}?date=${date}`)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            상세 페이지
          </button>
        </div>
      )}

      {/* 종목-시장 관계 탭 설명 배너 */}
      {activeTab === "market" && !selectedTicker && (
        <div className="bg-surface-container-high rounded-xl p-4 flex gap-3 items-start border border-outline-variant/10">
          <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">info</span>
          <div className="space-y-1">
            <p className="text-sm font-bold text-on-surface">종목-시장 관계 읽는 법</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              <span className="text-[#4ade80] font-bold">초록 노드</span> = 강세·GO·좋은 등급 &nbsp;·&nbsp;
              <span className="text-[#facc15] font-bold">노란 노드</span> = 중립·주의 &nbsp;·&nbsp;
              <span className="text-[#f87171] font-bold">빨간 노드</span> = 약세·STOP &nbsp;·&nbsp;
              <span className="text-[#a78bfa] font-bold">보라 노드</span> = AI Builder
            </p>
            <p className="text-xs text-on-surface-variant">
              화살표 방향 = 영향이 흐르는 방향. 노드를 클릭하면 각 연결의 의미를 확인할 수 있어요.
            </p>
          </div>
        </div>
      )}

      {/* 메인: 그래프 + 상세 패널 */}
      <div className="flex gap-4">
        {/* 그래프 */}
        <div className="flex-1 min-w-0 relative">
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high/80 backdrop-blur-sm text-on-surface-variant hover:text-on-surface text-xs font-medium transition-colors"
            title="전체화면"
          >
            <span className="material-symbols-outlined text-base">fullscreen</span>
          </button>
          <ForceGraph
            data={currentGraph}
            onNodeClick={handleNodeClick}
            height={580}
          />
          <p className="text-[10px] text-on-surface-variant mt-2 text-center">
            드래그로 이동 · 스크롤로 줌 · 노드 클릭 시 상세 정보
          </p>
        </div>

        {/* 전체화면 오버레이 */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-on-surface">Graph — 전체화면</p>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs transition-colors"
              >
                <span className="material-symbols-outlined text-base">fullscreen_exit</span>
                닫기 (ESC)
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ForceGraph
                data={currentGraph}
                onNodeClick={(node) => { handleNodeClick(node); setIsFullscreen(false); }}
                height={typeof window !== "undefined" ? window.innerHeight - 100 : 800}
              />
            </div>
          </div>
        )}

        {/* 상세 패널 */}
        {selectedNode && (
          <div className="w-72 flex-shrink-0 bg-surface-container-low rounded-xl p-5 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)] sticky top-4">
            {/* 헤더 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor:
                      selectedNode.color ?? TYPE_COLORS[selectedNode.type] ?? "#888",
                  }}
                />
                <h4 className="text-sm font-bold text-on-surface leading-snug">
                  {selectedNode.name}
                </h4>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-on-surface-variant hover:text-on-surface ml-2 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* 타입 뱃지 */}
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                style={{
                  background:
                    (selectedNode.color ??
                      TYPE_COLORS[selectedNode.type] ??
                      "#888") + "22",
                  color:
                    selectedNode.color ??
                    TYPE_COLORS[selectedNode.type] ??
                    "#888",
                }}
              >
                {TYPE_LABEL_KEYS[selectedNode.type] ? t(TYPE_LABEL_KEYS[selectedNode.type]) : selectedNode.type}
              </span>
            </div>

            {/* 설명 */}
            {selectedNode.description && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {selectedNode.description}
              </p>
            )}

            {/* 추가 정보 */}
            {selectedNode.sector && (
              <div className="text-xs text-on-surface-variant">
                섹터:{" "}
                <span className="text-on-surface font-bold">
                  {selectedNode.sector}
                </span>
              </div>
            )}
            {selectedNode.weight !== undefined && (
              <div className="text-xs text-on-surface-variant">
                포지션 비중:{" "}
                <span className="text-primary font-black">
                  {selectedNode.weight.toFixed(1)}%
                </span>
              </div>
            )}

            {/* 연결 수 */}
            <div className="pt-3 border-t border-outline-variant/10 space-y-2">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                연결 관계
              </p>
              <div className="flex gap-4">
                <div>
                  <p className="text-lg font-black text-primary">{incomingCount}</p>
                  <p className="text-[10px] text-on-surface-variant">입력</p>
                </div>
                <div>
                  <p className="text-lg font-black text-primary">{outgoingCount}</p>
                  <p className="text-[10px] text-on-surface-variant">출력</p>
                </div>
              </div>
            </div>

            {/* 연결된 엣지 목록 */}
            {nodeEdges.length > 0 && (
              <div className="space-y-0 max-h-64 overflow-y-auto">
                {nodeEdges.slice(0, 12).map((e, i) => {
                  const src =
                    typeof e.source === "string"
                      ? e.source
                      : (e.source as GraphNode).id;
                  const tgt =
                    typeof e.target === "string"
                      ? e.target
                      : (e.target as GraphNode).id;
                  const isOutgoing = src === selectedNode.id;
                  const otherNodeId = isOutgoing ? tgt : src;
                  const otherNode = currentGraph.nodes.find(
                    (n) => n.id === otherNodeId
                  );
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-0.5 py-1.5 border-b border-outline-variant/5 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className="material-symbols-outlined text-sm flex-shrink-0"
                          style={{ color: TYPE_COLORS[otherNode?.type ?? ""] ?? "#888" }}
                        >
                          {isOutgoing ? "arrow_forward" : "arrow_back"}
                        </span>
                        <span
                          className="font-bold truncate"
                          style={{ color: otherNode?.color ?? TYPE_COLORS[otherNode?.type ?? ""] ?? "#888" }}
                        >
                          {otherNode?.name ?? otherNodeId}
                        </span>
                        <span className="ml-auto text-[9px] text-on-surface-variant/40 shrink-0 bg-surface-container-high px-1 rounded">
                          {EDGE_TYPE_LABELS[e.type] ?? e.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/70 pl-5 leading-snug">
                        {getEdgeContext(
                          isOutgoing,
                          e.type,
                          selectedNode.name,
                          otherNode?.name ?? otherNodeId
                        )}
                      </p>
                    </div>
                  );
                })}
                {nodeEdges.length > 12 && (
                  <p className="text-[10px] text-on-surface-variant/50 text-center">
                    +{nodeEdges.length - 12}개 더
                  </p>
                )}
              </div>
            )}

            {/* 페이지/에이전트 링크 */}
            {(selectedNode.type === "page" || selectedNode.type === "agent") && selectedNode.href && (
              <a
                href={selectedNode.href}
                className="flex items-center gap-2 text-sm text-primary hover:underline pt-2 border-t border-outline-variant/10"
              >
                <span className="material-symbols-outlined text-base">
                  open_in_new
                </span>
                {selectedNode.type === "agent" ? "AI Builder 열기" : "페이지 열기"}
              </a>
            )}

            {/* 종목 노드 → Stock Detail 페이지 이동 */}
            {selectedNode.type === "ticker" && (
              <Link
                href={`/stock/${selectedNode.id}?date=${date}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline pt-2 border-t border-outline-variant/10 font-bold"
              >
                <span className="material-symbols-outlined text-base">insights</span>
                Stock Detail 페이지 열기 · {date}
                {(() => {
                  const row = dateTickers.find((p) => p.ticker.toUpperCase() === selectedNode.id.toUpperCase());
                  return row?.grade ? (
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded border ${gradeClass(row.grade)}`}>
                      {row.grade}
                    </span>
                  ) : null;
                })()}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-container-low p-5 rounded-xl text-center">
          <p className="text-3xl font-black text-primary">
            {currentGraph.nodes.length}
          </p>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
            노드
          </p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl text-center">
          <p className="text-3xl font-black text-primary">
            {currentGraph.edges.length}
          </p>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
            엣지
          </p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl text-center">
          <p className="text-3xl font-black text-primary">
            {new Set(currentGraph.nodes.map((n) => n.type)).size}
          </p>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
            노드 타입
          </p>
        </div>
      </div>

      {/* 엣지 타입 범례 */}
      <div className="bg-surface-container-low rounded-xl p-5">
        <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
          엣지 타입 <HelpBtn topic="graph" />
        </h4>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(EDGE_TYPE_LABELS).map(([type, label]) => {
            const colors: Record<string, string> = {
              feeds:       "#ffffff30",
              produces:    "#4ade8060",
              determines:  "#facc1560",
              gates:       "#fb923c60",
              enhances:    "#a78bfa60",
              displays:    "#22d3ee50",
              correlation: "#f472b6a0",
              sector_peer: "#86efac50",
            };
            return (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-5 h-0.5 rounded"
                  style={{ background: colors[type] }}
                />
                <span className="text-[10px] text-on-surface-variant">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
