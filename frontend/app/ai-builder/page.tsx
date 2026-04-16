"use client";
import Link from "next/link";

const AGENTS = [
  {
    id: "perf-lead",
    icon: "monitoring",
    title: "전략 백테스트",
    desc: "투자 전략 성과를 분석하고 개선점을 찾습니다",
    team: "performance",
    teamColor: "#4ade80",
    templates: [
      "오늘 성능 개선 사이클 실행해줘",
      "최근 백테스트 결과 요약해줘",
      "Sharpe 개선 방안 제안해줘",
    ],
  },
  {
    id: "equity-lead",
    icon: "trending_up",
    title: "종목 분석",
    desc: "특정 종목의 팩터와 기관 자금흐름을 분석합니다",
    team: "equity",
    teamColor: "#60a5fa",
    templates: [
      "AAPL 팩터 분석해줘",
      "현재 상위 종목 추천해줘",
      "IT 섹터 집중도 분석해줘",
    ],
  },
  {
    id: "macro-lead",
    icon: "public",
    title: "시장 체제 진단",
    desc: "거시경제 지표로 현재 시장 체제를 진단합니다",
    team: "macro",
    teamColor: "#f59e0b",
    templates: [
      "현재 시장 체제 분석해줘",
      "VIX와 금리 상황 요약해줘",
      "Yield Curve 신호 확인해줘",
    ],
  },
  {
    id: "research-lead",
    icon: "science",
    title: "팩터 리서치",
    desc: "최신 논문과 팩터를 발굴하고 구현 가능성을 평가합니다",
    team: "research",
    teamColor: "#a78bfa",
    templates: [
      "신규 팩터 리서치해줘",
      "오늘 아이디어 3개 제안해줘",
      "Short-Term Reversal 성과 검토해줘",
    ],
  },
  {
    id: "service-evolver",
    icon: "auto_fix_high",
    title: "시스템 점검",
    desc: "전체 시스템을 진단하고 오늘의 개선 항목을 파악합니다",
    team: "mlops",
    teamColor: "#f87171",
    templates: [
      "오늘 개선 항목 파악해줘",
      "전체 시스템 점검해줘",
      "아키텍처 현황 요약해줘",
    ],
  },
];

export default function AIBuilderPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">smart_toy</span>
            AI Builder
          </h2>
          <p className="text-sm text-on-surface-variant">
            전문 AI 에이전트에게 작업을 맡기세요 — 코드 작성 없이 분석·개선·리서치
          </p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined" style={{ fontSize: "120px" }}>
            smart_toy
          </span>
        </div>
      </div>

      {/* 에이전트 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => (
          <Link
            key={agent.id}
            href={`/ai-builder/${agent.id}`}
            className="group bg-surface-container-low border border-outline-variant/10 rounded-xl p-6 flex flex-col gap-4 hover:border-primary/40 hover:bg-surface-container-high transition-all"
          >
            {/* 아이콘 + 팀 배지 */}
            <div className="flex items-start justify-between">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: agent.teamColor + "20" }}
              >
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ color: agent.teamColor }}
                >
                  {agent.icon}
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                style={{ background: agent.teamColor + "20", color: agent.teamColor }}
              >
                {agent.team}
              </span>
            </div>

            {/* 제목 + 설명 */}
            <div>
              <h3 className="font-bold text-on-surface mb-1">{agent.title}</h3>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">{agent.desc}</p>
            </div>

            {/* 템플릿 프롬프트 */}
            <div className="flex flex-col gap-1.5 mt-auto">
              {agent.templates.map((t) => (
                <span
                  key={t}
                  className="text-[11px] text-on-surface-variant/70 px-2 py-1 rounded-md bg-surface-container-highest/40 group-hover:text-on-surface-variant transition-colors truncate"
                >
                  "{t}"
                </span>
              ))}
            </div>

            {/* 실행 화살표 */}
            <div className="flex items-center justify-end gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <span>실행하기</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </div>
          </Link>
        ))}
      </div>

      {/* 안내 */}
      <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">info</span>
          <div>
            <p className="text-sm font-bold text-on-surface mb-1">AI Builder 사용 안내</p>
            <ul className="text-[12px] text-on-surface-variant space-y-1 leading-relaxed">
              <li>• 각 에이전트는 Claude Code를 통해 실제 코드베이스를 읽고 분석합니다</li>
              <li>• 작업 완료까지 30초~3분 소요될 수 있습니다</li>
              <li>• 실행 중 실시간 진행 상황이 표시됩니다</li>
              <li>• 민감한 파일 수정은 에이전트가 직접 하지 않습니다 (Read 전용)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
