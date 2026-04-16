"""AI Builder FastAPI 서비스 (Phase 2)

Phase 1: Next.js API routes (frontend/app/api/ai-builder/run/route.ts)
Phase 2: 이 파일 — 독립 Docker 컨테이너로 배포

실행:
    uvicorn main:app --host 0.0.0.0 --port 5051

환경 변수:
    ANTHROPIC_API_KEY  — 필수
    US_STOCK_DIR       — 코드베이스 루트 (기본: 이 파일의 2단계 상위)
"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent_discovery import discover_agents
from runner import stream_agent

app = FastAPI(title="AI Builder", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    agentId: str
    task: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/agents")
def list_agents():
    return discover_agents()


@app.post("/run")
async def run_agent(req: RunRequest):
    if not req.agentId or not req.task:
        raise HTTPException(status_code=400, detail="agentId and task are required")

    import re
    if not re.match(r"^[a-z0-9-]+$", req.agentId):
        raise HTTPException(status_code=400, detail="Invalid agentId")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    return StreamingResponse(
        stream_agent(req.agentId, req.task),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
