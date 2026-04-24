"""
채팅봇 서버 — FastAPI + HTTP + Claude Code CLI headless
환경변수:
  CLAUDE_PATH            claude 바이너리 경로 (기본: claude)
  CHATBOT_SYSTEM_PROMPT  시스템 프롬프트 텍스트
  CHATBOT_MODEL          claude 모델 (기본: claude-haiku-4-5-20251001)
  CHATBOT_TITLE          채팅창 제목
  ALLOWED_ORIGINS        CORS 허용 오리진 (쉼표 구분, 기본: *)
  CHATBOT_DB_PATH        SQLite DB 경로 (기본: /data/chatbot.db)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

CLAUDE_PATH = os.getenv("CLAUDE_PATH", "claude")
MODEL = os.getenv("CHATBOT_MODEL", "claude-haiku-4-5-20251001")
TITLE = os.getenv("CHATBOT_TITLE", "AI 도우미")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
CHATBOT_DB_PATH = os.getenv("CHATBOT_DB_PATH", "/data/chatbot.db")
REPORT_PATH = os.getenv(
    "CHATBOT_REPORT_PATH",
    str(Path(__file__).parent.parent.parent / "output" / "reports" / "latest_report.json"),
)

_DEFAULT_PROMPT = (
    "당신은 프린들(Frindle)이 개발한 US Stock 대시보드의 AI 도우미입니다. "
    "미국 주식 분석, 시장 체제, 종목 스크리닝에 관한 질문에 한국어로 간결하게 답변하세요. "
    "아래 지식베이스를 우선 참고하고, 3문장 이내로 핵심만 전달하세요."
)

def _load_knowledge() -> str:
    """services/chatbot/knowledge.md를 로드해 시스템 프롬프트에 부착."""
    paths = [
        Path(__file__).parent / "knowledge.md",
        Path("/data/knowledge.md"),
    ]
    for p in paths:
        if p.exists():
            try:
                return p.read_text(encoding="utf-8")
            except Exception:
                pass
    return ""

_DAILY_CACHE: Dict[str, object] = {"summary": "", "ts": 0.0}
_DAILY_TTL = 3600 * 6  # 6시간


def _load_daily_summary() -> str:
    """latest_report.json 에서 오늘의 시장 요약을 추출 (6시간 캐시)."""
    now = time.time()
    if now - float(_DAILY_CACHE["ts"]) < _DAILY_TTL and _DAILY_CACHE["summary"]:
        return str(_DAILY_CACHE["summary"])
    try:
        p = Path(REPORT_PATH)
        if not p.exists():
            return ""
        data = json.loads(p.read_text(encoding="utf-8"))
        date = data.get("data_date", "")
        regime = data.get("market_regime", {}).get("regime", "")
        gate = data.get("market_gate", {}).get("signal", "")
        picks = data.get("stock_picks", [])[:5]
        lines = [f"## 오늘의 시장 데이터 ({date})"]
        lines.append(f"시장체제: {regime} | 마켓게이트: {gate}")
        if picks:
            lines.append("TOP 종목:")
            for p2 in picks:
                ticker = p2.get("ticker", "")
                grade = p2.get("grade", "")
                action = p2.get("action", "")
                score = p2.get("composite_score", 0)
                lines.append(f"  {ticker} | {grade}등급 | {score:.0f}점 | {action}")
        summary = "\n".join(lines)
        _DAILY_CACHE["summary"] = summary
        _DAILY_CACHE["ts"] = now
        return summary
    except Exception as e:
        log.warning("daily summary load error: %s", e)
        return ""


_state: Dict[str, str] = {"knowledge": _load_knowledge()}


def _get_system_prompt() -> str:
    base = os.getenv("CHATBOT_SYSTEM_PROMPT", _DEFAULT_PROMPT)
    k = _state.get("knowledge", "")
    daily = _load_daily_summary()
    parts = [base]
    if k:
        parts.append(k)
    if daily:
        parts.append(daily)
    return "\n\n".join(parts)

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# 세션별 대화 이력
_sessions: Dict[str, List[Dict]] = {}
_MAX_HISTORY = 20


# ── DB ──────────────────────────────────────────────────────────────────────

def _init_db() -> None:
    try:
        os.makedirs(os.path.dirname(CHATBOT_DB_PATH), exist_ok=True)
    except Exception:
        pass
    with sqlite3.connect(CHATBOT_DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id    TEXT    NOT NULL,
                username      TEXT    DEFAULT '',
                email         TEXT    DEFAULT '',
                question      TEXT    NOT NULL,
                answer        TEXT    NOT NULL,
                input_tokens  INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cost_usd      REAL    DEFAULT 0.0,
                created_at    TEXT    NOT NULL
            )
        """)
        conn.commit()
    log.info("DB initialised: %s", CHATBOT_DB_PATH)


def _log_chat(
    session_id: str,
    username: str,
    email: str,
    question: str,
    answer: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
) -> None:
    try:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(CHATBOT_DB_PATH) as conn:
            conn.execute(
                """INSERT INTO chat_logs
                   (session_id, username, email, question, answer,
                    input_tokens, output_tokens, cost_usd, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (session_id, username, email, question, answer,
                 input_tokens, output_tokens, cost_usd, now),
            )
            conn.commit()
    except Exception as e:
        log.error("DB log error: %s", e)


# ── Local FAQ matcher (zero-token responses) ─────────────────────────────────

_FAQ_RULES: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(r"^(안녕|안뇽|하이|hi|hello|hey|ㅎㅇ|반가워|반갑|처음|시작|좋은\s*(아침|오후|저녁|밤))[!,~.\s]*$", re.IGNORECASE),
        "안녕하세요! 프린들이 만든 US Stock 대시보드 AI입니다. 시장 체제, 종목 스크리닝, 등급·점수 기준 등 무엇이든 물어보세요.",
    ),
    (
        re.compile(r"(고마워|고맙|감사|땡큐|thank)", re.IGNORECASE),
        "도움이 됐다니 다행입니다. 더 궁금한 점 있으면 편하게 물어보세요!",
    ),
    (
        re.compile(r"(뭐\s*해|뭐\s*할\s*수|어떻게\s*(사용|써)|사용법|도움말|도와줘|기능|할\s*수\s*있)", re.IGNORECASE),
        "시장 체제(risk_on/neutral/risk_off/crisis), 마켓 게이트(GO/CAUTION/STOP), 종목 등급(A~F), BUY·HOLD 판단 기준, 데이터 출처 등을 설명해 드릴 수 있습니다. 궁금한 항목을 질문해 주세요.",
    ),
    (
        re.compile(r"^(네|응|ㅇㅇ|ok|okay|알겠|알았|확인)[!,~.\s]*$", re.IGNORECASE),
        "추가로 궁금한 점이 있으시면 편하게 물어보세요!",
    ),
    (
        re.compile(r"^(ㅋ+|ㅎ+|😂|😅|ㅋㅋ|하하|호호)[!,~.\s]*$"),
        "더 궁금한 점 있으시면 언제든지 물어보세요!",
    ),
]


def _match_faq(message: str) -> Optional[str]:
    msg = message.strip()
    for pattern, reply in _FAQ_RULES:
        if pattern.search(msg):
            return reply
    return None


# ── Claude ───────────────────────────────────────────────────────────────────

def _build_prompt(message: str, history: list) -> str:
    lines: list = []
    sp = _get_system_prompt()
    if sp:
        lines.append(f"System: {sp}\n")
    for h in history[-(_MAX_HISTORY // 2 * 2):]:
        prefix = "Human" if h["role"] == "user" else "Assistant"
        lines.append(f"{prefix}: {h['content']}")
    lines.append(f"Human: {message}")
    lines.append("Assistant:")
    return "\n".join(lines)


async def _ask_claude(message: str, history: list) -> Tuple[str, int, int, float]:
    prompt = _build_prompt(message, history)
    try:
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_PATH,
            "-p", prompt,
            "--output-format", "json",
            "--model", MODEL,
            "--allowedTools", "",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
        if proc.returncode == 0:
            raw = stdout.decode(errors="replace").strip()
            try:
                data = json.loads(raw)
                text = data.get("result", "").strip()
                usage = data.get("usage", {})
                input_tokens = int(usage.get("input_tokens", 0))
                output_tokens = int(usage.get("output_tokens", 0))
                cost_usd = float(data.get("cost_usd", 0.0))
                return text or "답변을 받지 못했습니다.", input_tokens, output_tokens, cost_usd
            except (json.JSONDecodeError, TypeError):
                return raw or "답변을 받지 못했습니다.", 0, 0, 0.0
        err = stderr.decode(errors="replace").strip()
        log.error("claude error (rc=%d): %s", proc.returncode, err)
        return "죄송합니다. 답변 생성 중 오류가 발생했습니다.", 0, 0, 0.0
    except asyncio.TimeoutError:
        log.error("claude timed out")
        return "답변 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.", 0, 0, 0.0
    except FileNotFoundError:
        log.error("claude binary not found at: %s", CLAUDE_PATH)
        return "claude CLI를 찾을 수 없습니다. CLAUDE_PATH 환경변수를 확인해 주세요.", 0, 0, 0.0


# ── Models ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    content: str
    username: Optional[str] = ""
    email: Optional[str] = ""


class ChatResponse(BaseModel):
    reply: str
    session_id: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup() -> None:
    _init_db()


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id
    if session_id not in _sessions:
        _sessions[session_id] = []
    history = _sessions[session_id]

    faq_reply = _match_faq(req.content)
    if faq_reply:
        text, input_tokens, output_tokens, cost_usd = faq_reply, 0, 0, 0.0
        log.info("FAQ hit (no API call): %s", req.content[:40])
    else:
        text, input_tokens, output_tokens, cost_usd = await _ask_claude(req.content, history)

    history.append({"role": "user", "content": req.content})
    history.append({"role": "assistant", "content": text})
    if len(history) > _MAX_HISTORY:
        _sessions[session_id] = history[-_MAX_HISTORY:]

    _log_chat(
        session_id=session_id,
        username=req.username or "",
        email=req.email or "",
        question=req.content,
        answer=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    return ChatResponse(reply=text, session_id=session_id)


@app.get("/logs")
async def get_logs(limit: int = 50, offset: int = 0):
    try:
        with sqlite3.connect(CHATBOT_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            total = conn.execute("SELECT COUNT(*) FROM chat_logs").fetchone()[0]
        return {"logs": [dict(r) for r in rows], "total": total}
    except Exception as e:
        log.error("get_logs error: %s", e)
        return {"logs": [], "total": 0}


@app.get("/stats")
async def get_stats():
    try:
        with sqlite3.connect(CHATBOT_DB_PATH) as conn:
            total_q = conn.execute("SELECT COUNT(*) FROM chat_logs").fetchone()[0]
            total_tokens = conn.execute(
                "SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM chat_logs"
            ).fetchone()[0]
            total_cost = conn.execute(
                "SELECT COALESCE(SUM(cost_usd), 0.0) FROM chat_logs"
            ).fetchone()[0]
            daily_rows = conn.execute("""
                SELECT DATE(created_at) as day,
                       COUNT(*) as questions,
                       COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
                       COALESCE(SUM(cost_usd), 0.0) as cost
                FROM chat_logs
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY day DESC
            """).fetchall()
        return {
            "total_questions": total_q,
            "total_tokens": int(total_tokens),
            "total_cost_usd": round(float(total_cost), 6),
            "daily": [
                {"day": r[0], "questions": r[1], "tokens": int(r[2]), "cost": round(float(r[3]), 6)}
                for r in daily_rows
            ],
        }
    except Exception as e:
        log.error("get_stats error: %s", e)
        return {"total_questions": 0, "total_tokens": 0, "total_cost_usd": 0.0, "daily": []}


class KnowledgeUpdate(BaseModel):
    content: str


@app.get("/knowledge")
async def get_knowledge():
    k = _state.get("knowledge", "")
    prompt = _get_system_prompt()
    return {
        "content": k,
        "token_estimate": len(prompt) // 4,
        "chars": len(k),
    }


@app.post("/knowledge")
async def update_knowledge(req: KnowledgeUpdate):
    _state["knowledge"] = req.content
    path = Path(__file__).parent / "knowledge.md"
    try:
        path.write_text(req.content, encoding="utf-8")
    except Exception as e:
        log.error("knowledge write error: %s", e)
    log.info("knowledge updated: %d chars", len(req.content))
    return {"status": "ok", "chars": len(req.content), "token_estimate": len(req.content) // 4}


@app.get("/health")
async def health():
    return {"status": "ok", "title": TITLE}


@app.get("/config.js")
async def config_js():
    js = f"window.__ChatbotServerTitle = {json.dumps(TITLE)};"
    return JSONResponse(content=js, media_type="application/javascript")


@app.get("/widget.js")
async def widget_js():
    path = STATIC_DIR / "chat-widget.js"
    if not path.exists():
        return JSONResponse({"error": "widget not found"}, status_code=404)
    return FileResponse(str(path), media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("chat_server:app", host="0.0.0.0", port=8001, reload=False)
