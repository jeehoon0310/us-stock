"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

// --- 타입 ---

type RiskProfile = "very_conservative" | "conservative" | "neutral" | "aggressive" | "very_aggressive";

type StockPick = {
  ticker: string;
  company_name: string;
  composite_score: number;
  grade: string;
  grade_label: string;
  strategy: string;
  setup: string;
  rs_vs_spy: number;
  action: string;
  rs_score: number;
};

type ChatMsg = { role: "ai" | "user"; text: string };

// --- 상수 ---

const SECTORS = [
  { key: "tech",             label: "기술 (IT)",    score:  2 },
  { key: "comm",             label: "커뮤니케이션",  score:  1 },
  { key: "consumer_disc",    label: "임의소비재",    score:  1 },
  { key: "energy",           label: "에너지",       score:  0 },
  { key: "financials",       label: "금융",         score:  0 },
  { key: "industrials",      label: "산업재",       score:  0 },
  { key: "materials",        label: "소재",         score:  0 },
  { key: "real_estate",      label: "부동산",       score: -1 },
  { key: "healthcare",       label: "헬스케어",     score: -1 },
  { key: "consumer_staples", label: "필수소비재",   score: -2 },
  { key: "utilities",        label: "유틸리티",     score: -2 },
];

const PURPOSES = [
  { key: "preserve", label: "자본보전 / 노후대비",  score: -2 },
  { key: "stable",   label: "안정적 수익 창출",    score: -1 },
  { key: "grow",     label: "자산 증식",           score:  0 },
  { key: "lump_sum", label: "목돈 마련",            score:  1 },
  { key: "fast",     label: "빠른 자산 증대",      score:  2 },
];

const EXPERIENCE_OPTIONS = [
  { key: 0,  label: "0~1년",   score: -2 },
  { key: 2,  label: "2~3년",   score: -1 },
  { key: 4,  label: "4~5년",   score:  0 },
  { key: 6,  label: "6~9년",   score:  1 },
  { key: 10, label: "10년+",   score:  2 },
];

const DURATION_OPTIONS = [
  { key: 1,  label: "1년"  },
  { key: 3,  label: "3년"  },
  { key: 5,  label: "5년"  },
  { key: 10, label: "10년" },
];

type ProfileMeta = {
  label: string;
  color: string;
  borderColor: string;
  bgAccent: string;
  icon: string;
  sectors: string[];
  description: string;
  gradeFilter: string[];
  meterPct: number;
};

const PROFILE_META: Record<RiskProfile, ProfileMeta> = {
  very_conservative: {
    label: "매우 보수적",
    color: "text-blue-400",
    borderColor: "border-blue-400",
    bgAccent: "bg-blue-400/10",
    icon: "shield",
    sectors: ["헬스케어", "유틸리티", "필수소비재"],
    description:
      "원금 보전을 최우선으로 두는 유형입니다. 변동성이 낮은 방어적 섹터와 배당주 중심으로 포트폴리오를 구성하세요. Grade A~B 우량주에 집중하고 손절선을 엄격히 지키세요.",
    gradeFilter: ["A", "B"],
    meterPct: 10,
  },
  conservative: {
    label: "보수적",
    color: "text-teal-400",
    borderColor: "border-teal-400",
    bgAccent: "bg-teal-400/10",
    icon: "trending_flat",
    sectors: ["금융", "헬스케어", "필수소비재"],
    description:
      "안정성을 중시하면서 적절한 성장도 추구합니다. 우량주 중심으로 분산 투자하고 시장 하락 시에도 방어력을 갖춘 포트폴리오를 권장합니다.",
    gradeFilter: ["A", "B", "C"],
    meterPct: 30,
  },
  neutral: {
    label: "중립적",
    color: "text-yellow-400",
    borderColor: "border-yellow-400",
    bgAccent: "bg-yellow-400/10",
    icon: "balance",
    sectors: ["IT", "금융", "헬스케어"],
    description:
      "안정성과 성장성의 균형을 추구합니다. GO 신호 시 적극 매수, STOP 시 현금 비중을 높이는 유연한 전략이 적합합니다.",
    gradeFilter: ["A", "B", "C"],
    meterPct: 50,
  },
  aggressive: {
    label: "공격적",
    color: "text-orange-400",
    borderColor: "border-orange-400",
    bgAccent: "bg-orange-400/10",
    icon: "rocket_launch",
    sectors: ["IT", "임의소비재", "커뮤니케이션"],
    description:
      "높은 수익률을 위해 상당한 변동성을 감내합니다. 모멘텀 강한 고성장 종목 중심으로 집중 투자하되 손절선(-5~-8%) 설정은 필수입니다.",
    gradeFilter: ["A", "B"],
    meterPct: 75,
  },
  very_aggressive: {
    label: "매우 공격적",
    color: "text-red-400",
    borderColor: "border-red-400",
    bgAccent: "bg-red-400/10",
    icon: "local_fire_department",
    sectors: ["IT", "커뮤니케이션", "에너지"],
    description:
      "최대 수익률을 목표로 하는 고위험 투자자입니다. RS vs SPY 상위 종목에 집중하되 큰 손실 가능성을 항상 인지하고 리스크 관리를 철저히 해야 합니다.",
    gradeFilter: ["A"],
    meterPct: 95,
  },
};

// --- 로직 ---

function calcRequiredReturn(investable: number, target: number, years: number): number {
  if (investable <= 0 || target <= 0) return 0;
  if (target <= investable) return ((target / investable) - 1) * 100 / Math.max(years, 1);
  return (Math.pow(target / investable, 1 / years) - 1) * 100;
}

function calcRiskScore(inputs: {
  age: number;
  experience: number;
  requiredReturn: number;
  purpose: string;
  sectors: string[];
}): number {
  let score = 0;

  if (inputs.age < 30) score += 3;
  else if (inputs.age < 40) score += 2;
  else if (inputs.age < 50) score += 1;
  else if (inputs.age < 60) score += 0;
  else score -= 1;

  const exp = EXPERIENCE_OPTIONS.find((e) => e.key === inputs.experience);
  if (exp) score += exp.score;

  const r = inputs.requiredReturn;
  if (r < 5) score -= 2;
  else if (r < 10) score -= 1;
  else if (r < 15) score += 0;
  else if (r < 20) score += 1;
  else if (r < 30) score += 2;
  else if (r < 50) score += 3;
  else score += 4;

  const p = PURPOSES.find((p) => p.key === inputs.purpose);
  if (p) score += p.score;

  if (inputs.sectors.length > 0) {
    const avg =
      inputs.sectors
        .map((k) => SECTORS.find((s) => s.key === k)?.score ?? 0)
        .reduce((a, b) => a + b, 0) / inputs.sectors.length;
    score += Math.round(Math.max(-2, Math.min(2, avg)));
  }

  return score;
}

function scoreToProfile(score: number): RiskProfile {
  if (score <= -3) return "very_conservative";
  if (score <= 0) return "conservative";
  if (score <= 3) return "neutral";
  if (score <= 6) return "aggressive";
  return "very_aggressive";
}

const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

function filterPicks(picks: StockPick[], profile: RiskProfile): StockPick[] {
  const { gradeFilter } = PROFILE_META[profile];
  const filtered = picks.filter((p) => gradeFilter.includes(p.grade));
  if (profile === "very_aggressive" || profile === "aggressive") {
    return [...filtered].sort((a, b) => b.rs_vs_spy - a.rs_vs_spy).slice(0, 5);
  }
  return [...filtered]
    .sort((a, b) => {
      const ga = GRADE_ORDER[a.grade] ?? 0;
      const gb = GRADE_ORDER[b.grade] ?? 0;
      return gb !== ga ? gb - ga : b.composite_score - a.composite_score;
    })
    .slice(0, 5);
}

// --- 서브 컴포넌트 ---

const SEGMENT_COLORS = ["bg-blue-400", "bg-teal-400", "bg-yellow-400", "bg-orange-400", "bg-red-400"];
const SEGMENT_TEXT   = ["text-blue-400", "text-teal-400", "text-yellow-400", "text-orange-400", "text-red-400"];
const SEGMENT_LABELS = ["매우보수", "보수적", "중립", "공격적", "매우공격"];
const METER_THRESHOLDS = [10, 30, 50, 75, 95];

function RiskMeter({ meterPct }: { meterPct: number }) {
  const active = METER_THRESHOLDS.findIndex((t) => meterPct <= t);
  const idx = active === -1 ? 4 : active;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 h-3 rounded-full overflow-hidden">
        {SEGMENT_COLORS.map((c, i) => (
          <div key={i} className={`flex-1 transition-all duration-700 ${c} ${i === idx ? "opacity-100" : "opacity-15"}`} />
        ))}
      </div>
      <div className="flex">
        {SEGMENT_LABELS.map((label, i) => (
          <div key={i} className={`flex-1 text-center text-[9px] font-bold ${i === idx ? SEGMENT_TEXT[i] : "text-on-surface-variant/40"}`}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeChip({ grade }: { grade: string }) {
  const cls: Record<string, string> = {
    A: "text-primary bg-primary/10",
    B: "text-blue-400 bg-blue-400/10",
    C: "text-yellow-400 bg-yellow-400/10",
    D: "text-orange-400 bg-orange-400/10",
    F: "text-red-400 bg-red-400/10",
  };
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${cls[grade] ?? "text-on-surface-variant bg-surface-container-high"}`}>
      {grade}
    </span>
  );
}

function ActionChip({ action }: { action: string }) {
  const cls: Record<string, string> = {
    BUY: "text-primary bg-primary/10",
    "SMALL BUY": "text-teal-400 bg-teal-400/10",
    WATCH: "text-yellow-400 bg-yellow-400/10",
    HOLD: "text-on-surface-variant bg-surface-container-high",
  };
  const labels: Record<string, string> = { BUY: "매수", "SMALL BUY": "소량매수", WATCH: "관찰", HOLD: "보유" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${cls[action] ?? "text-on-surface-variant bg-surface-container-high"}`}>
      {labels[action] ?? action}
    </span>
  );
}

// --- 메인 페이지 ---

export default function ProfilePage() {
  // 폼 상태
  const [age, setAge] = useState(35);
  const [experience, setExperience] = useState(4);
  const [investable, setInvestable] = useState("");
  const [target, setTarget] = useState("");
  const [duration, setDuration] = useState(3);
  const [purpose, setPurpose] = useState("grow");
  const [sectors, setSectors] = useState<string[]>([]);

  // 분석 결과
  const [result, setResult] = useState<{
    profile: RiskProfile;
    score: number;
    requiredReturn: number;
    age: number;
    experience: number;
    purpose: string;
    sectors: string[];
  } | null>(null);

  // 종목 데이터
  const [picks, setPicks] = useState<StockPick[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(true);

  // 사용자 정보
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userLoading, setUserLoading] = useState(true);

  // 채팅 상태
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId] = useState(() => `profile-${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/data/reports?date=latest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setPicks(d?.stock_picks ?? []); })
      .catch(() => {})
      .finally(() => setLoadingPicks(false));
    fetch("/auth/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) { window.location.href = "/login"; return null; }
        return r.json();
      })
      .then((d) => { if (d) { setUserName(d.name ?? ""); setUserEmail(d.email ?? ""); } })
      .catch(() => { window.location.href = "/login"; })
      .finally(() => setUserLoading(false));
  }, []);

  // 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  const sendToAI = useCallback(async (content: string) => {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, content, username: userName, email: userEmail }),
      });
      const data = await res.json();
      setChatMsgs((prev) => [...prev, { role: "ai", text: data.reply ?? "답변을 가져올 수 없습니다." }]);
    } catch {
      setChatMsgs((prev) => [...prev, { role: "ai", text: "일시적으로 AI에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setChatLoading(false);
    }
  }, [sessionId, chatLoading]);

  // 분석 결과가 나오면 AI 자동 요청
  useEffect(() => {
    if (!result) return;
    const meta = PROFILE_META[result.profile];
    const expLabel = EXPERIENCE_OPTIONS.find((e) => e.key === result.experience)?.label ?? "";
    const purposeLabel = PURPOSES.find((p) => p.key === result.purpose)?.label ?? "";
    const sectorLabels = result.sectors.map((k) => SECTORS.find((s) => s.key === k)?.label ?? k).join(", ") || "없음";

    const autoPrompt = `[투자 성향 분석 결과]
성향 코드: ${result.profile}
성향 라벨: ${meta.label} (점수 ${result.score > 0 ? "+" : ""}${result.score})
나이: ${result.age}세 / 투자 경험: ${expLabel}
필요 연평균 수익률: ${result.requiredReturn > 0 ? `${result.requiredReturn.toFixed(1)}%` : "미입력"}
투자 목적: ${purposeLabel}
관심 섹터: ${sectorLabels}

지식베이스의 "${result.profile}" 전략 가이드를 참고하여, 이 투자자에게 맞는 구체적인 투자 전략(포지션 관리·손절선·진입 타이밍·추천 섹터)을 3~5문장으로 설명해주세요.`;

    setChatMsgs([]);
    sendToAI(autoPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const toggleSector = (key: string) =>
    setSectors((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const liveReturn =
    investable && target && Number(investable) > 0 && Number(target) > 0
      ? calcRequiredReturn(Number(investable), Number(target), duration)
      : null;

  const analyze = async () => {
    const inv = Number(investable) || 0;
    const tgt = Number(target) || 0;
    const requiredReturn = calcRequiredReturn(inv, tgt, duration);
    const score = calcRiskScore({ age, experience, requiredReturn, purpose, sectors });
    const profile = scoreToProfile(score);
    setResult({ profile, score, requiredReturn, age, experience, purpose, sectors });

    // 저장 시점에 userName이 없으면 /auth/me 재확인
    let saveName = userName;
    let saveEmail = userEmail;
    if (!saveName) {
      try {
        const r = await fetch("/auth/me", { credentials: "include" });
        if (!r.ok) { window.location.href = "/login"; return; }
        const d = await r.json();
        saveName = d.name ?? "";
        saveEmail = d.email ?? "";
        setUserName(saveName);
        setUserEmail(saveEmail);
      } catch {
        window.location.href = "/login";
        return;
      }
    }

    // 결과 저장 (fire-and-forget)
    fetch("/api/admin/profile-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: saveName || "익명",
        user_email: saveEmail || undefined,
        profile,
        score,
        age,
        experience,
        purpose,
        sectors,
        required_return: requiredReturn,
        investable: inv || undefined,
        target: tgt || undefined,
        duration,
      }),
    }).catch(() => {});
  };

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatMsgs((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    sendToAI(text);
  };

  const meta = result ? PROFILE_META[result.profile] : null;
  const matchedPicks = result ? filterPicks(picks, result.profile) : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person_search</span>
            투자 성향 분석
          </h2>
          <p className="text-sm text-on-surface-variant">
            나이 · 경험 · 투자 목표를 입력하면 맞춤형 투자 성향과 AI 가이드를 제공합니다.
          </p>
          <p className="text-[11px] text-on-surface-variant/50 mt-1">
            AWS AgentCore Lab 1 알고리즘 기반 · AI 조언은 Claude Code CLI 호출
          </p>
        </div>
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <span className="material-symbols-outlined" style={{ fontSize: 120 }}>person_search</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── 입력 폼 ── */}
        <div className="space-y-5">

          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">person</span>
              기본 정보
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface-variant">나이</label>
                <span className="text-primary font-black text-base">{age}세</span>
              </div>
              <input
                type="range" min={18} max={80} value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full accent-primary" style={{ height: "6px" }}
              />
              <div className="flex justify-between text-[10px] text-on-surface-variant/60">
                <span>18세</span>
                <span>~30대 공격적 · 50대+ 보수적~</span>
                <span>80세</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">주식 투자 경험</label>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_OPTIONS.map((e) => (
                  <button key={e.key} onClick={() => setExperience(e.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${experience === e.key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"}`}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">savings</span>
              투자 목표
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant">투자 가능 금액 (만원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={investable ? Number(investable).toLocaleString() : ""}
                  onChange={(e) => setInvestable(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 10,000"
                  className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant">목표 금액 (만원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={target ? Number(target).toLocaleString() : ""}
                  onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 20,000"
                  className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none focus:border-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">투자 기간</label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button key={d.key} onClick={() => setDuration(d.key)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${duration === d.key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {liveReturn !== null && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-on-surface-variant">필요 연평균 수익률</p>
                  <p className="text-[10px] text-on-surface-variant/60">{investable}만 → {target}만 · {duration}년</p>
                </div>
                <span className={`text-xl font-black ${liveReturn >= 0 ? "text-primary" : "text-error"}`}>
                  {liveReturn > 0 ? "+" : ""}{liveReturn.toFixed(1)}%
                  <span className="text-xs font-normal text-on-surface-variant">/년</span>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant">투자 목적</label>
              <div className="space-y-1.5">
                {PURPOSES.map((p) => (
                  <button key={p.key} onClick={() => setPurpose(p.key)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${purpose === p.key ? "bg-primary/10 border-primary/30 text-primary font-bold" : "bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:text-on-surface"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">pie_chart</span>
              관심 섹터
              <span className="text-[10px] font-normal normal-case text-on-surface-variant">(복수 선택 가능)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => (
                <button key={s.key} onClick={() => toggleSector(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${sectors.includes(s.key) ? "bg-primary text-on-primary border-transparent" : "bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:text-on-surface"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={analyze} disabled={userLoading}
            className="w-full py-4 rounded-xl text-base font-black bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined">analytics</span>
            {userLoading ? "사용자 확인 중..." : "투자 성향 분석하기"}
          </button>
        </div>

        {/* ── 결과 패널 ── */}
        <div className="space-y-5">
          {!result ? (
            <div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center justify-center gap-4 text-center border border-outline-variant/10">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">person_search</span>
              <p className="text-sm text-on-surface-variant">
                정보를 입력하고<br />
                <span className="font-bold text-primary">분석하기</span> 버튼을 클릭하세요.
              </p>
            </div>
          ) : (
            <>
              {/* 위험 성향 카드 */}
              <div className={`bg-surface-container-low rounded-xl p-6 border ${meta!.borderColor}/20 space-y-5`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">투자 성향 프로필</h3>
                  <span className="text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-lg">
                    점수 {result.score > 0 ? "+" : ""}{result.score}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 ${meta!.borderColor} ${meta!.bgAccent}`}>
                    <span className={`material-symbols-outlined text-2xl ${meta!.color}`}>{meta!.icon}</span>
                  </div>
                  <div>
                    <p className={`text-2xl font-black ${meta!.color}`}>{meta!.label}</p>
                    <p className="text-xs text-on-surface-variant">투자 성향 판정</p>
                  </div>
                </div>
                <RiskMeter meterPct={meta!.meterPct} />
                <p className="text-sm text-on-surface-variant leading-relaxed">{meta!.description}</p>
              </div>

              {/* 수익률 + 추천 섹터 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low rounded-xl p-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">percent</span>
                    필요 연평균 수익률
                  </p>
                  {result.requiredReturn > 0 ? (
                    <>
                      <p className="text-3xl font-black text-primary">+{result.requiredReturn.toFixed(1)}%</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {investable && target ? `${Number(investable).toLocaleString()}만 → ${Number(target).toLocaleString()}만 · ${duration}년` : "금액 미입력"}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-black text-on-surface-variant">—</p>
                  )}
                </div>
                <div className="bg-surface-container-low rounded-xl p-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">pie_chart</span>
                    추천 섹터
                  </p>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {meta!.sectors.map((s, i) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-[10px] text-on-surface-variant/60 w-4">#{i + 1}</span>
                        <span className={`text-sm font-bold ${meta!.color}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 점수 분해 */}
              <div className="bg-surface-container-low rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">점수 분해</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "나이", val: age < 30 ? 3 : age < 40 ? 2 : age < 50 ? 1 : age < 60 ? 0 : -1 },
                    { label: "투자 경험", val: EXPERIENCE_OPTIONS.find((e) => e.key === experience)?.score ?? 0 },
                    {
                      label: "목표 수익률",
                      val: result.requiredReturn < 5 ? -2 : result.requiredReturn < 10 ? -1 : result.requiredReturn < 15 ? 0 : result.requiredReturn < 20 ? 1 : result.requiredReturn < 30 ? 2 : result.requiredReturn < 50 ? 3 : 4,
                    },
                    { label: "투자 목적", val: PURPOSES.find((p) => p.key === purpose)?.score ?? 0 },
                    {
                      label: "관심 섹터",
                      val: sectors.length > 0
                        ? Math.round(Math.max(-2, Math.min(2, sectors.map((k) => SECTORS.find((s) => s.key === k)?.score ?? 0).reduce((a, b) => a + b, 0) / sectors.length)))
                        : null,
                    },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between bg-surface-container-high/50 rounded-lg px-3 py-2">
                      <span className="text-on-surface-variant">{label}</span>
                      <span className={`font-black ${val === null ? "text-on-surface-variant/30" : val > 0 ? "text-primary" : val < 0 ? "text-error" : "text-on-surface-variant"}`}>
                        {val === null ? "미선택" : val > 0 ? `+${val}` : val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 맞춤 종목 */}
              <div className="bg-surface-container-low rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">star</span>
                    성향 맞춤 종목
                  </h4>
                  <span className="text-[10px] text-on-surface-variant">
                    {loadingPicks ? "로딩 중..." : `Grade ${PROFILE_META[result.profile].gradeFilter.join("/")} 기준`}
                  </span>
                </div>
                {loadingPicks ? (
                  <div className="p-6 flex items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  </div>
                ) : matchedPicks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-on-surface-variant">해당 조건의 종목이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-outline-variant/10">
                    {matchedPicks.map((pick, i) => (
                      <div key={pick.ticker} className="px-6 py-4 flex items-center gap-3 hover:bg-surface-container-high/30 transition-colors">
                        <span className="text-[10px] text-on-surface-variant/50 w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-on-surface">{pick.ticker}</span>
                            <GradeChip grade={pick.grade} />
                            <ActionChip action={pick.action} />
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate">{pick.company_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-on-surface">{pick.composite_score.toFixed(0)}점</p>
                          <p className={`text-[10px] font-bold ${pick.rs_vs_spy >= 0 ? "text-primary" : "text-error"}`}>
                            RS {pick.rs_vs_spy > 0 ? "+" : ""}{pick.rs_vs_spy.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setResult(null)}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all">
                입력값 수정하기
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── AI 채팅 섹션 ── */}
      {result && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0e0e0e" }}>
          {/* 채팅 메시지 영역 */}
          <div className="p-6 space-y-4 min-h-[180px] max-h-[480px] overflow-y-auto">
            {chatMsgs.length === 0 && !chatLoading && (
              <div className="flex items-end gap-3">
                <div className="shrink-0 w-12 h-12 relative">
                  <Image src="/ai-tok.png" alt="프린들 AI" fill className="object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
                </div>
                <div className="max-w-[75%] bg-[#1e1e1e] text-white text-sm px-4 py-3 rounded-2xl rounded-bl-sm leading-relaxed">
                  친절한 프린들 AI입니다.<br />분석 결과를 기다리고 있어요!
                </div>
              </div>
            )}

            {chatMsgs.map((msg, i) => (
              msg.role === "ai" ? (
                <div key={i} className="flex items-end gap-3">
                  <div className="shrink-0 w-12 h-12 relative">
                    <Image src="/ai-tok.png" alt="프린들 AI" fill className="object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
                  </div>
                  <div className="max-w-[75%] bg-[#1e1e1e] text-white text-sm px-4 py-3 rounded-2xl rounded-bl-sm leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[70%] bg-primary text-on-primary text-sm px-4 py-3 rounded-2xl rounded-br-sm leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              )
            ))}

            {chatLoading && (
              <div className="flex items-end gap-3">
                <div className="shrink-0 w-12 h-12 relative">
                  <Image src="/ai-tok.png" alt="프린들 AI" fill className="object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
                </div>
                <div className="bg-[#1e1e1e] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 */}
          <div className="border-t border-white/5 px-4 py-3 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="추가로 궁금한 점을 물어보세요..."
              disabled={chatLoading}
              className="flex-1 bg-[#1e1e1e] text-white placeholder-white/30 text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:outline-none focus:border-primary disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || chatLoading}
              className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-40 transition-opacity flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </div>
        </div>
      )}

      {/* 투자 유의사항 */}
      <div className="rounded-xl p-4 border border-outline-variant/10 bg-surface-container-lowest">
        <p className="text-[10px] text-on-surface-variant/50 leading-relaxed">
          ⚠️ 본 분석은 교육·참고 목적이며 투자 권유가 아닙니다. 투자의 모든 책임은 투자자 본인에게 있으며, 과거 성과가 미래 수익을 보장하지 않습니다. 금융 투자는 원금 손실 가능성이 있습니다.
        </p>
      </div>
    </div>
  );
}
