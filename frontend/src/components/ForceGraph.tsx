"use client";
import React, { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// react-force-graph-2d는 window를 참조하므로 SSR 비활성화 필수
// ComponentType<any>로 캐스팅하여 ref + 임의 props 수용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#0f172a] rounded-xl">
      <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
    </div>
  ),
}) as React.ComponentType<any>;

export type GraphNode = {
  id: string;
  name: string;
  type:
    | "data_source"
    | "collector"
    | "analyzer"
    | "signal"
    | "output"
    | "page"
    | "ticker"
    | "sector";
  description?: string;
  href?: string;
  sector?: string;
  weight?: number;
  color?: string;
  // force graph adds these at runtime
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

export type GraphEdge = {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  value?: number;
  label?: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const TYPE_COLORS: Record<string, string> = {
  data_source: "#60a5fa",
  collector:   "#a78bfa",
  analyzer:    "#fb923c",
  signal:      "#facc15",
  output:      "#4ade80",
  page:        "#22d3ee",
  ticker:      "#f472b6",
  sector:      "#86efac",
};

const TYPE_SIZES: Record<string, number> = {
  data_source: 6,
  collector:   8,
  analyzer:    10,
  signal:      12,
  output:      9,
  page:        7,
  ticker:      9,
  sector:      11,
};

interface ForceGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  height?: number;
}

export function ForceGraph({ data, onNodeClick, height = 600 }: ForceGraphProps) {
  const fgRef = useRef<unknown>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const containerRef = useRef<HTMLDivElement>(null);

  // 컨테이너 폭 감지
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions((d) => ({ ...d, width: entry.contentRect.width }));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const nodeCanvasObject = useCallback(
    (
      node: GraphNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = node.color ?? TYPE_COLORS[node.type] ?? "#94a3b8";
      const size = TYPE_SIZES[node.type] ?? 8;

      // 글로우 효과
      ctx.beginPath();
      ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
      ctx.fillStyle = color + "22";
      ctx.fill();

      // 노드 원
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color + "cc";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 레이블 (줌 0.7 이상에서만)
      if (globalScale >= 0.7) {
        const label = node.name.length > 18 ? node.name.slice(0, 17) + "…" : node.name;
        const fontSize = Math.max(7, 10 / globalScale);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        // 텍스트 배경
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "#0f172acc";
        ctx.fillRect(x - tw / 2 - 2, y + size + 1, tw + 4, fontSize + 2);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(label, x, y + size + 2);
      }
    },
    []
  );

  const linkColor = useCallback((link: GraphEdge) => {
    const colors: Record<string, string> = {
      feeds:       "#ffffff18",
      produces:    "#4ade8038",
      determines:  "#facc1538",
      gates:       "#fb923c38",
      enhances:    "#a78bfa38",
      displays:    "#22d3ee28",
      correlation: "#f472b680",
      sector_peer: "#86efac28",
    };
    return colors[link.type] ?? "#ffffff12";
  }, []);

  const linkWidth = useCallback((link: GraphEdge) => {
    if (link.type === "correlation") return 2;
    if (link.type === "determines" || link.type === "gates") return 1.5;
    return 1;
  }, []);

  const handleEngineStop = useCallback(() => {
    const fg = fgRef.current as {
      zoomToFit: (duration: number, padding: number) => void;
    } | null;
    fg?.zoomToFit(500, 60);
  }, []);

  const handleNodeClick = useCallback(
    (node: unknown) => {
      onNodeClick?.(node as GraphNode);
    },
    [onNodeClick]
  );

  // graphData는 links 키를 사용
  const graphData = {
    nodes: data.nodes,
    links: data.edges,
  };

  return (
    <div
      ref={containerRef}
      style={{ background: "#0f172a", borderRadius: "12px", overflow: "hidden", height }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={height}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.9}
        backgroundColor="#0f172a"
        onNodeClick={handleNodeClick}
        cooldownTicks={120}
        onEngineStop={handleEngineStop}
        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
          const size = (TYPE_SIZES[node.type] ?? 8) + 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, size, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
    </div>
  );
}
