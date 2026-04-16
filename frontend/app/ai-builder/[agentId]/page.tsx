"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const AGENT_CONFIG: Record<string, {
  icon: string;
  title: string;
  desc: string;
  team: string;
  teamColor: string;
  templates: string[];
}> = {
  "perf-lead": {
    icon: "monitoring",
    title: "전략 백테스트",
    desc: "투자 전략 성과를 분석하고 개선점을 찾습니다. 백테스트 파라미터 최적화, Sharpe 개선, 전략별 신호 분석을 수행합니다.",
    team: "performance",
    teamColor: "#4ade80",
    templates: [
      "오늘 성능 개선 사이클 실행해줘",
      "최근 백테스트 결과 요약해줘",
      "Sharpe 개선 방안 제안해줘",
    ],
  },
  "equity-lead": {
    icon: "trending_up",
    title: "종목 분석",
    desc: "특정 종목의 팩터와 기관 자금흐름을 분석합니다. 13F 보유 변화, 모멘텀, 기술적 지표를 종합합니다.",
    team: "equity",
    teamColor: "#60a5fa",
    templates: [
      "AAPL 팩터 분석해줘",
      "현재 상위 종목 추천해줘",
      "IT 섹터 집중도 분석해줘",
    ],
  },
  "macro-lead": {
    icon: "public",
    title: "시장 체제 진단",
    desc: "거시경제 지표로 현재 시장 체제를 진단합니다. VIX, 금리, Yield Curve, Fear&Greed 지수를 분석합니다.",
    team: "macro",
    teamColor: "#f59e0b",
    templates: [
      "현재 시장 체제 분석해줘",
      "VIX와 금리 상황 요약해줘",
      "Yield Curve 신호 확인해줘",
    ],
  },
  "research-lead": {
    icon: "science",
    title: "팩터 리서치",
    desc: "최신 논문과 팩터를 발굴하고 구현 가능성을 평가합니다. arXiv/SSRN 스캔 및 신규 팩터 아이디어를 제안합니다.",
    team: "research",
    teamColor: "#a78bfa",
    templates: [
      "신규 팩터 리서치해줘",
      "오늘 아이디어 3개 제안해줘",
      "Short-Term Reversal 성과 검토해줘",
    ],
  },
  "service-evolver": {
    icon: "auto_fix_high",
    title: "시스템 점검",
    desc: "전체 시스템을 진단하고 오늘의 개선 항목을 파악합니다. 아키텍처 현황, 버그, 성능 병목을 찾아냅니다.",
    team: "mlops",
    teamColor: "#f87171",
    templates: [
      "오늘 개선 항목 파악해줘",
      "전체 시스템 점검해줘",
      "아키텍처 현황 요약해줘",
    ],
  },
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input?: Record<string, unknown> }
  | { type: "tool_result"; content?: string }
  | { type: "error"; text: string }
  | { type: "done"; exitCode: number | null }
  | { type: "start" };

export default function AgentRunPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const agent = AGENT_CONFIG[agentId];

  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (!agent) {
    return (
      <div className="p-10 text-center text-on-surface-variant">
        알 수 없는 에이전트: {agentId}
        <br />
        <Link href="/ai-builder" className="text-primary hover:underline mt-2 inline-block">
          ← 목록으로
        </Link>
      </div>
    );
  }

  async function runAgent() {
    if (!task.trim() || running) return;
    setRunning(true);
    setDone(false);
    setEvents([{ type: "start" }]);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai-builder/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, task }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setEvents((prev) => [...prev, { type: "error", text: `HTTP ${res.status}` }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            setEvents((prev) => [...prev, event]);
            if (event.type === "done") {
              setDone(true);
              setRunning(false);
            }
          } catch {
            // non-JSON line
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setEvents((prev) => [...prev, { type: "error", text: String(err) }]);
      }
      setRunning(false);
    }
  }

  function stopAgent() {
    abortRef.current?.abort();
    setRunning(false);
    setDone(true);
  }

  function reset() {
    setEvents([]);
    setDone(false);
    setTask("");
  }

  const resultText = events
    .filter((e) => e.type === "text")
    .map((e) => (e as { type: "text"; text: string }).text)
    .join("");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/ai-builder"
        className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        AI Builder
      </Link>

      {/* Agent Header */}
      <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: agent.teamColor + "20" }}
          >
            <span
              className="material-symbols-outlined text-3xl"
              style={{ color: agent.teamColor }}
            >
              {agent.icon}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">{agent.title}</h2>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: agent.teamColor + "20", color: agent.teamColor }}
              >
                {agent.team}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{agent.desc}</p>
          </div>
        </div>
      </div>

      {/* Input */}
      {!running && !done && (
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            작업 입력
          </h3>

          {/* 템플릿 */}
          <div className="flex flex-wrap gap-2">
            {agent.templates.map((t) => (
              <button
                key={t}
                onClick={() => setTask(t)}
                className="text-[11px] px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
              >
                {t}
              </button>
            ))}
          </div>

          {/* 텍스트 입력 */}
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="어떤 작업을 맡길까요? 위 버튼을 누르거나 직접 입력하세요..."
            rows={3}
            className="w-full bg-surface-container-high rounded-xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 border border-outline-variant/10 focus:outline-none focus:border-primary/50 resize-none"
          />

          <button
            onClick={runAgent}
            disabled={!task.trim()}
            className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">play_arrow</span>
            에이전트 실행
          </button>
        </div>
      )}

      {/* 실행 중 / 결과 */}
      {(running || done || events.length > 0) && (
        <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
          {/* 상태 바 */}
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {running ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-bold text-primary">실행 중...</span>
                </>
              ) : done ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-bold text-green-400">완료</span>
                </>
              ) : null}
            </div>
            {running && (
              <button
                onClick={stopAgent}
                className="text-xs text-error hover:text-error/80 flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-base">stop</span>
                중지
              </button>
            )}
          </div>

          {/* 이벤트 스트림 */}
          <div className="p-6 space-y-3 max-h-[500px] overflow-y-auto">
            {events.map((event, i) => {
              if (event.type === "start") {
                return (
                  <div key={i} className="text-[11px] text-on-surface-variant/50 font-mono">
                    ▶ @{agentId} 시작 — {new Date().toLocaleTimeString("ko-KR")}
                  </div>
                );
              }
              if (event.type === "tool_use") {
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="material-symbols-outlined text-yellow-400 text-sm flex-shrink-0 mt-0.5">
                      build
                    </span>
                    <span className="text-yellow-400/80 font-mono">
                      {event.name}
                      {event.input && Object.keys(event.input).length > 0 && (
                        <span className="text-on-surface-variant/50 ml-1">
                          ({Object.entries(event.input)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                            .join(", ")})
                        </span>
                      )}
                    </span>
                  </div>
                );
              }
              if (event.type === "error") {
                return (
                  <div key={i} className="text-xs text-error bg-error/10 rounded-lg p-3 font-mono">
                    {event.text}
                  </div>
                );
              }
              if (event.type === "done") {
                return (
                  <div key={i} className="text-[11px] text-on-surface-variant/50 font-mono">
                    ✓ 완료 (exit {event.exitCode ?? 0})
                  </div>
                );
              }
              return null;
            })}

            {/* 최종 텍스트 결과 */}
            {resultText && (
              <div className="mt-4 p-4 bg-surface-container-high rounded-xl border border-outline-variant/10">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  결과
                </p>
                <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                  {resultText}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 완료 후 액션 */}
          {done && (
            <div className="px-6 py-4 border-t border-outline-variant/10 flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
              >
                다시 실행
              </button>
              <Link
                href="/ai-builder"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                에이전트 목록
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
