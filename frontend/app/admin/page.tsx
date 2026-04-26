"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileResult {
  id: string;
  user_name: string;
  user_email: string | null;
  profile: string;
  score: number;
  age: number;
  experience: number;
  purpose: string;
  sectors: string;
  required_return: number;
  investable: number | null;
  target: number | null;
  duration: number;
  created_at: string;
}

const PROFILE_META: Record<string, { label: string; color: string }> = {
  very_conservative: { label: "매우 보수적", color: "text-blue-400" },
  conservative:      { label: "보수적",      color: "text-teal-400" },
  neutral:           { label: "중립적",      color: "text-yellow-400" },
  aggressive:        { label: "공격적",      color: "text-orange-400" },
  very_aggressive:   { label: "매우 공격적", color: "text-red-400" },
};

const EXPERIENCE_LABELS: Record<number, string> = { 0: "0~1년", 2: "2~3년", 4: "4~5년", 6: "6~9년", 10: "10년+" };
const PURPOSE_LABELS: Record<string, string> = {
  preserve: "자본보전/노후대비", stable: "안정적 수익", grow: "자산 증식", lump_sum: "목돈 마련", fast: "빠른 자산 증대",
};

interface ChatLog {
  id: number;
  session_id: string;
  username: string;
  email: string;
  question: string;
  answer: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

interface MpvaPost {
  ntt_no: string;
  title: string;
  author: string;
  department: string;
  contact: string;
  content: string;
  date: string;
  views: number;
  url: string;
  files: Array<{ filename: string; url: string; local_path: string }>;
  fetched_at: string;
}

interface HistoryEntry {
  date: string;
  status: "success" | "failure" | "unknown" | "no_run";
}

interface Schedule {
  id: string;
  name: string;
  name_en: string;
  cron_kst: string;
  cron_desc: string;
  category: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: "success" | "failure" | "running" | "unknown" | null;
  last_duration_sec: number | null;
  next_run_at: string | null;
  run_count: number;
  history: HistoryEntry[];
}

const CATEGORY_LABEL: Record<string, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
  quarterly: "분기",
};

function statusBadge(status: Schedule["last_status"] | null) {
  if (!status || status === "unknown") {
    return <span className="badge badge-ghost text-xs">미실행</span>;
  }
  if (status === "success") {
    return <span className="badge badge-success badge-sm text-xs gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success-content inline-block" />성공</span>;
  }
  if (status === "running") {
    return <span className="badge badge-warning badge-sm text-xs gap-1"><span className="loading loading-ring loading-xs" />실행 중</span>;
  }
  return <span className="badge badge-error badge-sm text-xs">실패</span>;
}

function historyDot(status: HistoryEntry["status"]) {
  const cls = {
    success: "bg-success",
    failure: "bg-error",
    unknown: "bg-warning",
    no_run: "bg-base-300",
  }[status] ?? "bg-base-300";
  return cls;
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return "";
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function fmtRelative(isoStr: string | null, past = false): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = past ? now.getTime() - d.getTime() : d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) return past ? "방금" : "곧";
  if (diffMin < 60) return `${diffMin}분 ${past ? "전" : "후"}`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}시간 ${past ? "전" : "후"}`;
  return `${Math.round(diffMin / 1440)}일 ${past ? "전" : "후"}`;
}

function fmtDateTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).replace(/\./g, "-").replace(/ /g, " ");
}

function ScheduleCard({ s }: { s: Schedule }) {
  const last7 = s.history.slice(-7);

  const borderColor = s.enabled
    ? s.last_status === "success" ? "border-l-success"
    : s.last_status === "failure" ? "border-l-error"
    : "border-l-base-content/20"
    : "border-l-base-content/10";

  return (
    <div className={`bg-base-200 rounded-xl p-4 border-l-4 ${borderColor} flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-base-content">{s.name}</span>
            <span className="badge badge-outline badge-xs text-[10px]">{CATEGORY_LABEL[s.category] ?? s.category}</span>
            {!s.enabled && <span className="badge badge-ghost badge-xs text-[10px]">미등록</span>}
          </div>
          <span className="text-xs text-base-content/50">{s.name_en}</span>
        </div>
        {statusBadge(s.last_status)}
      </div>

      {/* Cron info */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-base-content/70">
          <span className="material-symbols-outlined text-sm">schedule</span>
          <span>{s.cron_desc}</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-base-content/40 font-mono bg-base-300 px-1.5 py-0.5 rounded">
            {s.cron_kst}
          </code>
        </div>
      </div>

      {/* Run info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-base-300 rounded-lg p-2">
          <div className="text-base-content/40 mb-0.5">마지막 실행</div>
          <div className="text-base-content font-medium">
            {s.last_run_at ? fmtDateTime(s.last_run_at) : "—"}
          </div>
          {s.last_run_at && (
            <div className="text-base-content/40 text-[10px]">
              {fmtRelative(s.last_run_at, true)}
              {s.last_duration_sec !== null && ` · ${fmtDuration(s.last_duration_sec)}`}
            </div>
          )}
        </div>
        <div className="bg-base-300 rounded-lg p-2">
          <div className="text-base-content/40 mb-0.5">다음 실행 예정</div>
          <div className="text-base-content font-medium">
            {s.next_run_at ? fmtDateTime(s.next_run_at) : "—"}
          </div>
          {s.next_run_at && (
            <div className="text-base-content/40 text-[10px]">
              {fmtRelative(s.next_run_at, false)}
            </div>
          )}
        </div>
      </div>

      {/* 7-day history */}
      {last7.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-base-content/30">7일</span>
          <div className="flex gap-1">
            {last7.map((h, i) => (
              <div
                key={i}
                title={`${h.date}: ${h.status}`}
                className={`w-3 h-3 rounded-full ${historyDot(h.status)}`}
              />
            ))}
          </div>
          {s.run_count > 0 && (
            <span className="text-[10px] text-base-content/30 ml-auto">총 {s.run_count}회 실행</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mpvaPosts, setMpvaPosts] = useState<MpvaPost[]>([]);
  const [mpvaTotal, setMpvaTotal] = useState(0);
  const [expandedNtt, setExpandedNtt] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [chatTotal, setChatTotal] = useState(0);
  const [expandedChat, setExpandedChat] = useState<number | null>(null);
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.is_admin) {
          setIsAdmin(true);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAdmin) return;
    fetch("/api/admin/schedules")
      .then((r) => r.json())
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    fetch("/api/admin/mpva?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setMpvaPosts(Array.isArray(data.posts) ? data.posts : []);
        setMpvaTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, [authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    fetch("/api/admin/chat-logs?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setChatLogs(Array.isArray(data.logs) ? data.logs : []);
        setChatTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, [authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    fetch("/api/admin/profile-results")
      .then((r) => r.json())
      .then((data) => {
        setProfileResults(Array.isArray(data.results) ? data.results : []);
        setProfileTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, [authChecked, isAdmin]);

  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="material-symbols-outlined text-4xl text-error">lock</span>
        <p className="text-base-content/60">관리자 권한이 필요합니다</p>
        <button className="btn btn-sm btn-ghost" onClick={() => router.push("/")}>
          홈으로
        </button>
      </div>
    );
  }

  const activeCount = schedules.filter((s) => s.enabled).length;
  const successToday = schedules.filter((s) => s.last_status === "success").length;

  return (
    <div className="min-h-screen bg-base-100 p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary">schedule</span>
          <h1 className="text-lg font-bold text-base-content">스케줄 관리</h1>
        </div>
        <p className="text-xs text-base-content/40">
          파이프라인 자동화 작업 현황 — macOS launchd 기반
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-base-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-base-content">{schedules.length}</div>
          <div className="text-[10px] text-base-content/40 mt-0.5">전체 스케줄</div>
        </div>
        <div className="bg-base-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-primary">{activeCount}</div>
          <div className="text-[10px] text-base-content/40 mt-0.5">등록됨</div>
        </div>
        <div className="bg-base-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-success">{successToday}</div>
          <div className="text-[10px] text-base-content/40 mt-0.5">마지막 성공</div>
        </div>
      </div>

      {/* Schedule cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.map((s) => (
          <ScheduleCard key={s.id} s={s} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4 text-[10px] text-base-content/30">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-success" />성공</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-error" />실패</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-warning" />불명</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-base-300" />미실행</div>
        <div className="ml-auto">미등록 = launchd 미설정, 수동 실행 필요</div>
      </div>

      {/* AI톡 채팅 로그 섹션 */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary">chat</span>
          <h2 className="text-lg font-bold text-base-content">AI톡 대화 로그</h2>
          {chatTotal > 0 && (
            <span className="badge badge-primary badge-sm">{chatTotal}건</span>
          )}
        </div>
        <p className="text-xs text-base-content/40 mb-4">관리자가 AI톡에 입력한 질문 기록</p>

        {chatLogs.length === 0 ? (
          <div className="bg-base-200 rounded-xl p-6 text-center text-sm text-base-content/40">
            아직 대화 기록이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {chatLogs.map((log) => (
              <div key={log.id} className="bg-base-200 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-base-300 transition-colors"
                  onClick={() => setExpandedChat(expandedChat === log.id ? null : log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-base-content truncate">{log.question}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-base-content/40 flex-wrap">
                      {log.username && <span>{log.username}</span>}
                      {log.email && <><span>·</span><span>{log.email}</span></>}
                      <span>·</span>
                      <span>{log.created_at.slice(0, 16).replace("T", " ")}</span>
                      {(log.input_tokens + log.output_tokens) > 0 && (
                        <><span>·</span><span>{(log.input_tokens + log.output_tokens).toLocaleString()} tokens</span></>
                      )}
                      {log.cost_usd > 0 && (
                        <><span>·</span><span>${log.cost_usd.toFixed(5)}</span></>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-base-content/30 shrink-0 mt-0.5">
                    {expandedChat === log.id ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {expandedChat === log.id && (
                  <div className="border-t border-base-300 px-4 py-3 flex flex-col gap-3">
                    <div>
                      <div className="text-[11px] text-base-content/40 font-medium mb-1">질문</div>
                      <pre className="text-xs text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed bg-base-300 rounded-lg p-3">{log.question}</pre>
                    </div>
                    <div>
                      <div className="text-[11px] text-base-content/40 font-medium mb-1">답변</div>
                      <pre className="text-xs text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed bg-base-300 rounded-lg p-3 max-h-60 overflow-y-auto">{log.answer}</pre>
                    </div>
                    <div className="flex gap-4 text-[11px] text-base-content/40">
                      <span>입력 {log.input_tokens.toLocaleString()} / 출력 {log.output_tokens.toLocaleString()} tokens</span>
                      <span>비용 ${log.cost_usd.toFixed(6)}</span>
                      <span className="font-mono">{log.session_id}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 투자 성향 분석 결과 섹션 */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary">person_search</span>
          <h2 className="text-lg font-bold text-base-content">투자 성향 분석 결과</h2>
          {profileTotal > 0 && (
            <span className="badge badge-primary badge-sm">{profileTotal}건</span>
          )}
        </div>
        <p className="text-xs text-base-content/40 mb-4">/profile 페이지에서 분석 버튼을 누른 기록</p>

        {profileResults.length === 0 ? (
          <div className="bg-base-200 rounded-xl p-6 text-center text-sm text-base-content/40">
            아직 분석 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th className="text-[11px]">일시</th>
                  <th className="text-[11px]">회원</th>
                  <th className="text-[11px]">성향</th>
                  <th className="text-[11px]">점수</th>
                  <th className="text-[11px]">나이</th>
                  <th className="text-[11px]">경험</th>
                  <th className="text-[11px]">목적</th>
                  <th className="text-[11px]">목표수익률</th>
                  <th className="text-[11px]">기간</th>
                  <th className="text-[11px]">투자금→목표</th>
                </tr>
              </thead>
              <tbody>
                {profileResults.map((r) => {
                  const meta = PROFILE_META[r.profile];
                  return (
                    <tr key={r.id} className="hover">
                      <td className="text-[11px] text-base-content/50 whitespace-nowrap">
                        {r.created_at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="text-[11px]">
                        <div className="font-medium text-base-content">{r.user_name}</div>
                        {r.user_email && <div className="text-base-content/40">{r.user_email}</div>}
                      </td>
                      <td>
                        <span className={`text-xs font-bold ${meta?.color ?? "text-base-content"}`}>
                          {meta?.label ?? r.profile}
                        </span>
                      </td>
                      <td className="text-[11px] font-mono font-bold text-base-content">
                        {r.score > 0 ? `+${r.score}` : r.score}
                      </td>
                      <td className="text-[11px] text-base-content/70">{r.age}세</td>
                      <td className="text-[11px] text-base-content/70">{EXPERIENCE_LABELS[r.experience] ?? r.experience}</td>
                      <td className="text-[11px] text-base-content/70">{PURPOSE_LABELS[r.purpose] ?? r.purpose}</td>
                      <td className="text-[11px] font-bold text-primary">
                        {r.required_return > 0 ? `+${r.required_return.toFixed(1)}%` : "—"}
                      </td>
                      <td className="text-[11px] text-base-content/70">{r.duration}년</td>
                      <td className="text-[11px] text-base-content/50">
                        {r.investable && r.target
                          ? `${r.investable.toLocaleString()}→${r.target.toLocaleString()}만`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MPVA 게시판 섹션 */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-secondary">campaign</span>
          <h2 className="text-lg font-bold text-base-content">국가보훈부 생업지원 공고</h2>
          {mpvaTotal > 0 && (
            <span className="badge badge-secondary badge-sm">{mpvaTotal}건</span>
          )}
        </div>
        <p className="text-xs text-base-content/40 mb-4">
          3시간마다 자동 수집 — <a href="https://www.mpva.go.kr/mpva/selectBbsNttList.do?bbsNo=32&key=145" target="_blank" rel="noopener noreferrer" className="underline">게시판 바로가기</a>
        </p>

        {mpvaPosts.length === 0 ? (
          <div className="bg-base-200 rounded-xl p-6 text-center text-sm text-base-content/40">
            수집된 공고가 없습니다. 스크립트를 한 번 실행해 베이스라인을 저장하면 다음 실행부터 나타납니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {mpvaPosts.map((p) => (
              <div key={p.ntt_no} className="bg-base-200 rounded-xl overflow-hidden">
                {/* Row */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-base-300 transition-colors"
                  onClick={() => setExpandedNtt(expandedNtt === p.ntt_no ? null : p.ntt_no)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-base-content truncate">{p.title}</span>
                      {p.files.length > 0 && (
                        <span className="badge badge-outline badge-xs shrink-0">📎 {p.files.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-base-content/40 flex-wrap">
                      {p.author && <span>{p.author}</span>}
                      {p.department && <><span>·</span><span>{p.department}</span></>}
                      {p.date && <><span>·</span><span>{p.date}</span></>}
                      {p.views > 0 && <><span>·</span><span>조회 {p.views}</span></>}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-base-content/30 shrink-0 mt-0.5">
                    {expandedNtt === p.ntt_no ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {/* Expanded content */}
                {expandedNtt === p.ntt_no && (
                  <div className="border-t border-base-300 px-4 py-3 flex flex-col gap-3">
                    {p.content && (
                      <pre className="text-xs text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed bg-base-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                        {p.content}
                      </pre>
                    )}
                    {p.contact && (
                      <div className="text-xs text-base-content/50">📞 연락처: {p.contact}</div>
                    )}
                    {p.files.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="text-[11px] text-base-content/40 font-medium">첨부파일</div>
                        {p.files.map((f, i) => (
                          <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            {f.filename}
                          </a>
                        ))}
                      </div>
                    )}
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-base-content/40 hover:text-base-content underline self-start"
                    >
                      원문 보기 →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
