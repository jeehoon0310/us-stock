"use client";

import { useEffect, useState } from "react";

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

interface ChatStats {
  total_questions: number;
  total_tokens: number;
  total_cost_usd: number;
  daily: { day: string; questions: number; tokens: number; cost: number }[];
}

export default function ChatLogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeTokens, setKnowledgeTokens] = useState(0);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeSaved, setKnowledgeSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/chat-logs?limit=200").then((r) => r.json()),
      fetch("/api/admin/chat-logs?type=stats").then((r) => r.json()),
      fetch("/api/admin/knowledge").then((r) => r.json()),
    ])
      .then(([logsData, statsData, kData]) => {
        setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
        setTotal(logsData.total ?? 0);
        setStats(statsData);
        setKnowledgeContent(kData.content ?? "");
        setKnowledgeTokens(kData.token_estimate ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveKnowledge() {
    setKnowledgeSaving(true);
    try {
      const r = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: knowledgeContent }),
      });
      const d = await r.json();
      setKnowledgeTokens(d.token_estimate ?? 0);
      setKnowledgeSaved(true);
      setTimeout(() => setKnowledgeSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setKnowledgeSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary">chat</span>
          <h1 className="text-xl font-bold">AI톡 대화 관리</h1>
        </div>
        <p className="text-xs text-on-surface-variant/60">프린들 AI 챗봇 질문 이력 및 토큰 사용량</p>
      </div>

      {/* Stats 요약 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-low rounded-xl p-5 text-center border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">총 질문 수</p>
            <p className="text-3xl font-bold text-primary">{stats.total_questions.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-5 text-center border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">총 토큰</p>
            <p className="text-3xl font-bold text-secondary">{stats.total_tokens.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-5 text-center border border-outline-variant/10">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">총 비용</p>
            <p className="text-3xl font-bold text-tertiary">${stats.total_cost_usd.toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* 지식베이스 편집기 */}
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-base">menu_book</span>
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">지식베이스 편집</h2>
            </div>
            <p className="text-[10px] text-on-surface-variant/40 mt-0.5">
              챗봇 시스템 프롬프트에 실시간 반영됩니다 — 저장 즉시 적용
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-on-surface-variant/50">
              ~{knowledgeTokens.toLocaleString()} tokens/요청
            </span>
            <button
              onClick={saveKnowledge}
              disabled={knowledgeSaving}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {knowledgeSaving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : knowledgeSaved ? (
                <span className="material-symbols-outlined text-sm">check</span>
              ) : (
                <span className="material-symbols-outlined text-sm">save</span>
              )}
              {knowledgeSaved ? "저장됨" : "저장"}
            </button>
          </div>
        </div>
        <textarea
          value={knowledgeContent}
          onChange={(e) => setKnowledgeContent(e.target.value)}
          className="w-full h-96 px-5 py-4 bg-transparent text-xs font-mono text-on-surface leading-relaxed resize-none outline-none"
          spellCheck={false}
        />
      </div>

      {/* 로그 목록 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            대화 이력
          </h2>
          {total > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {total}건
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-10 text-center text-sm text-on-surface-variant/50 border border-outline-variant/10">
            아직 대화 기록이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/10"
              >
                <button
                  className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-surface-container-high/30 transition-colors"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-on-surface truncate">{log.question}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-on-surface-variant/50 flex-wrap">
                      {log.username && <span className="font-medium text-on-surface-variant">{log.username}</span>}
                      {log.email && <><span>·</span><span>{log.email}</span></>}
                      <span>·</span>
                      <span>{log.created_at.slice(0, 16).replace("T", " ")}</span>
                      {(log.input_tokens + log.output_tokens) > 0 && (
                        <><span>·</span><span>{(log.input_tokens + log.output_tokens).toLocaleString()} tokens</span></>
                      )}
                      {log.cost_usd > 0 && (
                        <><span>·</span><span className="text-tertiary">${log.cost_usd.toFixed(5)}</span></>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant/30 shrink-0 mt-0.5">
                    {expanded === log.id ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {expanded === log.id && (
                  <div className="border-t border-outline-variant/10 px-5 py-4 flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] text-on-surface-variant/50 uppercase font-bold mb-1.5">질문</p>
                      <pre className="text-sm text-on-surface whitespace-pre-wrap font-sans leading-relaxed bg-surface-container-high/40 rounded-lg p-3">{log.question}</pre>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant/50 uppercase font-bold mb-1.5">답변</p>
                      <pre className="text-sm text-on-surface-variant whitespace-pre-wrap font-sans leading-relaxed bg-surface-container-high/40 rounded-lg p-3 max-h-64 overflow-y-auto">{log.answer}</pre>
                    </div>
                    <div className="flex gap-6 text-[11px] text-on-surface-variant/40">
                      <span>입력 {log.input_tokens.toLocaleString()} / 출력 {log.output_tokens.toLocaleString()} tokens</span>
                      <span>비용 ${log.cost_usd.toFixed(6)}</span>
                      <span className="font-mono opacity-50">{log.session_id}</span>
                    </div>
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
