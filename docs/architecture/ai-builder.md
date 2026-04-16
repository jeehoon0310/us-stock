# AI Builder — 아키텍처 문서

> 버전: v1 (2026-04-16)  
> 위치: `frontend/app/ai-builder/`, `frontend/app/api/ai-builder/`, `services/ai-builder/`

---

## 1. 목적

비개발자가 웹 브라우저에서 Claude Code 에이전트를 직접 실행할 수 있는 포털.

- 에이전트 선택 → 작업 입력 → 실시간 실행 결과 스트리밍
- 코드 작성 없이 백테스트 분석, 종목 리서치, 시스템 점검 가능

---

## 2. 에이전트 목록

`.claude/agents/` 하위 팀 폴더에 정의된 에이전트를 호출:

| 에이전트 ID | 팀 | 설명 |
|---|---|---|
| `perf-lead` | performance | 전략 백테스트 분석, Sharpe 개선 |
| `equity-lead` | equity | 종목 팩터·기관 자금흐름 분석 |
| `macro-lead` | macro | 거시경제·시장 체제 진단 |
| `research-lead` | research | 논문·신규 팩터 리서치 |
| `service-evolver` | mlops | 전체 시스템 점검·개선 제안 |

---

## 3. 아키텍처

### Phase 1 (현재 구현) — Next.js API Routes

```
Browser
  │ POST /api/ai-builder/run  { agentId, task }
  ▼
Next.js API Route (route.ts)
  │ spawn("claude", ["-p", "@{agentId} {task}", "--output-format", "stream-json"])
  │ cwd = US_STOCK_DIR (코드베이스 루트)
  ▼
Claude Code CLI (로컬 Mac에서 실행)
  │ .claude/agents/{team}/{agentId}.md 로드
  │ Read/Bash/Glob/Grep 도구 실행
  ▼
SSE 스트림 → Browser (fetch + ReadableStream reader)
```

### Phase 2 (별도 배포) — FastAPI Docker 서비스

```
Browser
  │ POST http://synology:5051/run  { agentId, task }
  ▼
services/ai-builder/main.py (FastAPI, port 5051)
  │ asyncio.create_subprocess_exec("claude", ...)
  │ cwd = US_STOCK_DIR (컨테이너 내 마운트)
  ▼
Claude Code CLI (Docker 컨테이너 내 설치)
  ▼
SSE 스트림 → Browser
```

---

## 4. 실행 흐름 (Phase 1)

```
1. 사용자가 /ai-builder에서 에이전트 카드 클릭
2. /ai-builder/{agentId} 페이지 — 작업 입력
3. 템플릿 프롬프트 선택 또는 직접 입력
4. "에이전트 실행" 버튼 → POST /api/ai-builder/run
5. API route: claude -p "@{agentId} {task}" --output-format stream-json 실행
6. stdout JSON 파싱 → SSE 이벤트 전송
   - { type: "tool_use", name: "Read", input: {...} }
   - { type: "text", text: "분석 결과..." }
   - { type: "done", exitCode: 0 }
7. 프론트엔드 ReadableStream reader로 실시간 렌더링
```

---

## 5. API 계약

### POST /api/ai-builder/run (Phase 1 Next.js)
### POST /run (Phase 2 FastAPI)

**Request:**
```json
{ "agentId": "perf-lead", "task": "오늘 성능 개선 사이클 실행해줘" }
```

**Response:** `Content-Type: text/event-stream`
```
data: {"type":"tool_use","name":"Read","input":{"file_path":"..."}}

data: {"type":"text","text":"분석 결과..."}

data: {"type":"done","exitCode":0}
```

### GET /agents (Phase 2 전용)
`.claude/agents/` 파싱 결과 반환.

---

## 6. 환경 변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Phase 2 필수 | Claude API 키 (Phase 1은 claude CLI 로컬 인증 사용) |
| `US_STOCK_DIR` | 선택 | 코드베이스 루트 경로 (기본: 파일 기준 2단계 상위) |

---

## 7. 보안

- `agentId` 입력값: `/^[a-z0-9-]+$/` 정규식 검증 (injection 방지)
- `--allowedTools Read,Bash,Glob,Grep` — 파일 수정 불가
- Phase 2: CORS 설정은 운영 환경에 맞게 `allow_origins` 제한 필요

---

## 8. Phase 2 배포 노트

Synology Docker 컨테이너에 Claude Code CLI 설치 필요:

```dockerfile
# Dockerfile에 추가
RUN npm install -g @anthropic-ai/claude-code

# docker-compose.yml에 서비스 추가
ai-builder:
  build: ./services/ai-builder
  ports:
    - "5051:5051"
  environment:
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - US_STOCK_DIR=/app
  volumes:
    - .:/app:ro
```

**현재 상태:** Phase 1만 구현됨. `claude` CLI가 Mac에 설치된 환경에서만 동작.

---

## 9. 파일 구조

```
frontend/
├── app/ai-builder/
│   ├── page.tsx              # 에이전트 갤러리
│   └── [agentId]/page.tsx    # 실행 + SSE 스트리밍
└── app/api/ai-builder/run/
    └── route.ts              # Next.js API route (Phase 1)

services/ai-builder/          # Phase 2 FastAPI 서비스
├── main.py
├── runner.py
├── agent_discovery.py
└── requirements.txt
```
