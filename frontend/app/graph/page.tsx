"use client";
import { useEffect, useState, useCallback } from "react";
import { ForceGraph, GraphData, GraphNode, TYPE_COLORS } from "@/components/ForceGraph";
import { HelpBtn } from "@/components/HelpBtn";

// ── 타입 ─────────────────────────────────────────────────────────

type GraphJson = {
  generated_at: string;
  system_graph: GraphData;
  stock_graph: GraphData;
  stock_market_graph: GraphData;
};

type TabId = "system" | "stock" | "market";

// ── 노드 타입 레이블 ─────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  data_source: "Data Source",
  collector:   "Collector",
  analyzer:    "Analyzer",
  signal:      "Signal",
  output:      "Output",
  page:        "Dashboard Page",
  ticker:      "Stock Ticker",
  sector:      "Sector",
  agent:       "AI Agent",
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  feeds:       "데이터 공급",
  produces:    "결과 생성",
  determines:  "판정 영향",
  gates:       "진입 게이팅",
  enhances:    "점수 보강",
  displays:    "페이지 표시",
  correlation: "가격 상관관계",
  sector_peer: "동일 섹터",
};

// ── 페이지 ───────────────────────────────────────────────────────

export default function GraphPage() {
  const [data, setData] = useState<GraphJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    fetch("/data/graph.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: GraphJson) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setSelectedNode(null);
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
          데이터 없음 — generate_graph.py를 실행하세요
        </p>
      </div>
    );
  }

  const currentGraph =
    activeTab === "system" ? data.system_graph :
    activeTab === "stock"  ? data.stock_graph  :
    (data.stock_market_graph ?? data.stock_graph);

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
      {/* Header */}
      <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            System Knowledge Graph <HelpBtn topic="performance" />
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
        <div className="flex gap-2 flex-wrap">
          {(["system", "stock", "market"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab
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
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(TYPE_LABELS)
            .filter(([type]) => {
              if (activeTab === "system") return !["ticker", "sector", "agent"].includes(type);
              if (activeTab === "stock")  return ["ticker", "sector"].includes(type);
              return ["ticker", "signal", "page", "agent"].includes(type);
            })
            .map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="text-[10px] text-on-surface-variant">{label}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 메인: 그래프 + 상세 패널 */}
      <div className="flex gap-4">
        {/* 그래프 */}
        <div className="flex-1 min-w-0">
          <ForceGraph
            data={currentGraph}
            onNodeClick={handleNodeClick}
            height={580}
          />
          <p className="text-[10px] text-on-surface-variant mt-2 text-center">
            드래그로 이동 · 스크롤로 줌 · 노드 클릭 시 상세 정보
          </p>
        </div>

        {/* 상세 패널 */}
        {selectedNode && (
          <div className="w-72 flex-shrink-0 bg-surface-container-low rounded-xl p-5 space-y-4">
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
                {TYPE_LABELS[selectedNode.type] ?? selectedNode.type}
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
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
                      className="flex items-center gap-2 text-[10px] text-on-surface-variant"
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{
                          color:
                            TYPE_COLORS[otherNode?.type ?? ""] ?? "#888",
                        }}
                      >
                        {isOutgoing ? "arrow_forward" : "arrow_back"}
                      </span>
                      <span className="truncate">{otherNode?.name ?? otherNodeId}</span>
                      <span className="ml-auto text-[9px] text-on-surface-variant/50 shrink-0">
                        {EDGE_TYPE_LABELS[e.type] ?? e.type}
                      </span>
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
        <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
          엣지 타입
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
