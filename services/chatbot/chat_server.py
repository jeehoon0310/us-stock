"""
채팅봇 서버 — FastAPI + WebSocket + Claude Code CLI headless
환경변수:
  CLAUDE_PATH         claude 바이너리 경로 (기본: claude)
  CHATBOT_SYSTEM_PROMPT  시스템 프롬프트 텍스트
  CHATBOT_MODEL       claude 모델 (기본: claude-haiku-4-5-20251001)
  CHATBOT_TITLE       채팅창 제목 (위젯에 전달)
  ALLOWED_ORIGINS     CORS 허용 오리진 (쉼표 구분, 기본: *)
"""
import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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

# 세션별 대화 이력 {session_id: [{"role": "user"|"assistant", "content": str}]}
_sessions: dict[str, list[dict]] = {}
_MAX_HISTORY = 20  # 세션당 최대 보관 메시지 수


def _build_prompt(message: str, history: list[dict]) -> str:
    lines: list[str] = []
    if SYSTEM_PROMPT:
        lines.append(f"System: {SYSTEM_PROMPT}\n")
    for h in history[-((_MAX_HISTORY // 2) * 2):]:
        prefix = "Human" if h["role"] == "user" else "Assistant"
        lines.append(f"{prefix}: {h['content']}")
    lines.append(f"Human: {message}")
    lines.append("Assistant:")
    return "\n".join(lines)


async def _ask_claude(message: str, history: list[dict]) -> str:
    prompt = _build_prompt(message, history)
    try:
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_PATH,
            "-p", prompt,
            "--output-format", "text",
            "--model", MODEL,
            "--allowedTools", "",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
        if proc.returncode == 0:
            return stdout.decode(errors="replace").strip()
        err = stderr.decode(errors="replace").strip()
        log.error("claude error (rc=%d): %s", proc.returncode, err)
        return "죄송합니다. 답변 생성 중 오류가 발생했습니다."
    except asyncio.TimeoutError:
        log.error("claude timed out")
        return "답변 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
    except FileNotFoundError:
        log.error("claude binary not found at: %s", CLAUDE_PATH)
        return f"claude CLI를 찾을 수 없습니다. CLAUDE_PATH 환경변수를 확인해 주세요."


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


@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if session_id not in _sessions:
        _sessions[session_id] = []
    history = _sessions[session_id]
    log.info("WS connected: %s", session_id)

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            user_msg = data.get("content", "").strip()
            if not user_msg:
                continue

            # 타이핑 인디케이터 ON
            await websocket.send_text(json.dumps({"type": "typing", "status": True}))

            response = await _ask_claude(user_msg, history)

            # 이력 저장 (초과 시 오래된 것 제거)
            history.append({"role": "user", "content": user_msg})
            history.append({"role": "assistant", "content": response})
            if len(history) > _MAX_HISTORY:
                _sessions[session_id] = history[-_MAX_HISTORY:]

            await websocket.send_text(json.dumps({"type": "typing", "status": False}))
            await websocket.send_text(
                json.dumps({"type": "message", "role": "assistant", "content": response})
            )
    except WebSocketDisconnect:
        log.info("WS disconnected: %s", session_id)
    except Exception as e:
        log.exception("WS error: %s", e)
    finally:
        _sessions.pop(session_id, None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("chat_server:app", host="0.0.0.0", port=8001, reload=False)
