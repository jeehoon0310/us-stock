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
import sqlite3
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
SYSTEM_PROMPT = os.getenv(
    "CHATBOT_SYSTEM_PROMPT",
    "당신은 US Stock 대시보드의 친절한 도우미입니다. "
    "미국 주식 분석, 시장 체제, 종목 스크리닝에 관한 질문에 간결하게 답변하세요. "
    "답변은 한국어로 작성하고 3문장 이내로 핵심만 전달하세요.",
)
MODEL = os.getenv("CHATBOT_MODEL", "claude-haiku-4-5-20251001")
TITLE = os.getenv("CHATBOT_TITLE", "AI 도우미")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
CHATBOT_DB_PATH = os.getenv("CHATBOT_DB_PATH", "/data/chatbot.db")

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


# ── Claude ───────────────────────────────────────────────────────────────────

def _build_prompt(message: str, history: list) -> str:
    lines: list = []
    if SYSTEM_PROMPT:
        lines.append(f"System: {SYSTEM_PROMPT}\n")
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
