# US-Stock 배포 아키텍처 — Next.js + SQLite rsync

> **버전**: v3 (2026-04-17)
> **이전 버전**: v2 (2026-04-13, git-scraping 패턴)
> **다이어그램**: [docker-deployment.drawio](./docker-deployment.drawio)

## 개요

로컬 Mac에서 Python 분석을 돌리고, 결과를 **SQLite(`output/data.db`)에 기록**한 뒤
**rsync로 Synology에 전달**하는 구조. 이미지 재빌드 없이 데이터만 교체 가능.

**이전 아키텍처(v2)** 와의 차이:

| 항목 | v2 (git-scraping) | v3 (SQLite rsync) |
|------|-------------------|--------------------|
| 데이터 전달 | JSON → git commit → GHA 빌드 | rsync output/data.db |
| 이미지 재빌드 | 매일 | 코드 변경 시만 |
| 데이터 저장 | frontend/public/data/*.json (git 추적) | output/data.db (SQLite, git 미추적) |
| 프론트엔드 읽기 | fetch('/data/*.json') static | /api/data/* → better-sqlite3 쿼리 |
| git 저장소 용량 | JSON 누적 (315개 파일) | 코드만 |

---

## 책임 분리

### Mac (로컬, 무거운 연산)
- Python 3.13 venv + 전체 의존성 (yfinance, curl_cffi, lightgbm, fredapi, scikit-learn 등)
- `.env` — 모든 API 키 (**NAS에 절대 복사 안 함**)
- launchd 스케줄: 평일 07:00 KST (`com.us-stock.daily.plist`)
- 파이프라인 실행 → `output/data.db` 생성 → WAL checkpoint → rsync → Synology

### GitHub (코드 배포 전용)
- Repository: 소스 코드 + Next.js 앱 (**JSON 데이터 없음, git 미추적**)
- Actions: `.github/workflows/deploy.yml` — **코드 변경 시만 트리거**
- GHCR: `ghcr.io/jeehoon0310/us-stock:latest`

### Synology NAS (서빙 레이어)
- **`/data/data.db`**: Mac이 rsync로 전달 → Next.js가 read-only로 쿼리
- **`/data/board.db`**: Board 기능 전용 (NAS에서만 쓰기)
- **`us-stock` 컨테이너**: Next.js standalone (port 8889)
- **`us-stock-dashboard` 컨테이너**: nginx 정적 서빙

---

## 일일 데이터 배포 흐름

```
[Mac, 평일 07:00 KST]
  bash scripts/run_and_commit.sh
    │
    ├─ python scripts/run_integrated_analysis.py
    │    └─ src/db/data_store.py → output/data.db 쓰기
    │
    ├─ python scripts/regen_dashboard_data.py
    │    └─ GBM, market_gate 스냅샷 → output/data.db 업데이트
    │
    ├─ SQLite WAL checkpoint(FULL)   ← rsync 전 저널 병합 필수
    │
    └─ rsync -az --checksum output/data.db
           → admin@100.93.245.113:/volume1/docker/us-stock/board/data.db
               (Tailscale SSH, 포트 22)
```

로그: `logs/deploy_YYYYMMDD_HHMMSS.log`
macOS 알림: 완료/오류/늦은실행/네트워크오류 각 단계

---

## 코드 변경 시 이미지 배포 흐름

데이터 변경은 rsync로, **코드 변경만** GitHub Actions를 거친다.

```
Developer Mac
  │ git push (frontend/src, frontend/app 등 코드 파일)
  ▼
GitHub Actions (ubuntu-latest)
  ├─ npm run build → Docker image
  ├─ push → GHCR
  └─ Tailscale SSH → Synology → docker compose up -d
```

자세한 CI 흐름: [ci-flow_v2.md](./ci-flow_v2.md)

---

## SQLite 데이터베이스 구조

두 DB 파일이 동일 Docker 볼륨(`/data/`)에 공존:

| 파일 | 쓰기 주체 | 읽기 주체 | 환경변수 |
|------|-----------|-----------|----------|
| `data.db` | Mac pipeline | Next.js (READ-ONLY) | `DATA_DB_PATH=/data/data.db` |
| `board.db` | Next.js Board | Next.js | `BOARD_DB_PATH=/data/board.db` |

### `data.db` 테이블 (11개)

**시계열 (3개)**

| 테이블 | 키 | 내용 |
|--------|----|------|
| `data_daily_reports` | `date TEXT PRIMARY KEY` | 일일 리포트 전체 JSON |
| `data_risk_alerts` | `date TEXT PRIMARY KEY` | 일별 리스크 알림 |
| `data_prediction_history` | `date TEXT PRIMARY KEY` | SPY/QQQ 방향 예측 이력 |

**스냅샷 (8개, id=1 단일행)**

| 테이블 | 내용 |
|--------|------|
| `data_regime_snapshot` | 최신 마켓 레짐 (5-sensor) |
| `data_market_gate_snapshot` | 최신 마켓 게이트 (11-sector) |
| `data_ai_summaries` | AI 분석 (ticker별) |
| `data_gbm_predictions` | GBM 모델 랭킹 전체 |
| `data_index_prediction` | 최신 SPY/QQQ 예측 |
| `data_risk_snapshot` | 최신 리스크 알림 |
| `data_performance` | 백테스트 성과 |
| `data_graph` | 시스템 그래프 데이터 |

DB 설정: WAL journal mode, 5000ms busy_timeout, foreign keys ON.
모든 테이블에 `data_json TEXT` blob 보존. 쿼리용 컬럼(date/regime/gate/verdict)만 별도 추출.

---

## 프론트엔드 데이터 레이어

```
frontend/app/api/data/          ← 12개 API Route (force-dynamic)
├── reports/route.ts            → data_daily_reports
├── dates/route.ts              → data_daily_reports (날짜 목록)
├── risk/route.ts               → data_risk_snapshot / data_risk_alerts
├── risk-dates/route.ts         → data_risk_alerts (날짜 목록)
├── regime/route.ts             → data_regime_snapshot
├── market-gate/route.ts        → data_market_gate_snapshot
├── ai-summaries/route.ts       → data_ai_summaries
├── gbm-predictions/route.ts    → data_gbm_predictions
├── index-prediction/route.ts   → data_index_prediction
├── prediction-history/route.ts → data_prediction_history
├── performance/route.ts        → data_performance
└── graph/route.ts              → data_graph

frontend/src/lib/db.ts          ← better-sqlite3 singleton (read-only)
```

DB 경로 해석 순서 (`frontend/src/lib/db.ts`):
1. `DATA_DB_PATH` 환경변수
2. `/data/data.db` (Docker 볼륨 기본)
3. `../output/data.db` (로컬 개발 fallback)

---

## Docker 설정

### docker-compose.prod.yml

```yaml
services:
  us-stock:
    image: ghcr.io/jeehoon0310/us-stock:latest
    network_mode: host
    environment:
      - BOARD_DB_PATH=/data/board.db
      - DATA_DB_PATH=/data/data.db
      - PORT=8889
      - TZ=America/New_York
    volumes:
      - /volume1/docker/us-stock/board:/data   # board.db + data.db 공존
```

### Dockerfile 핵심 레이어

- **Stage 1 (deps)**: `node:20-slim`, `apt: python3 make g++` (better-sqlite3 네이티브 빌드용)
- **Stage 2 (builder)**: `COPY frontend/`, `npm run build`
- **Stage 3 (runner)**: standalone + better-sqlite3 네이티브 모듈 명시 복사

JSON 데이터 파일은 git 미추적 → Docker 빌드 컨텍스트에 포함 안 됨.

---

## 환경 변수 전체

| 변수 | 위치 | 기본값 | 용도 |
|------|------|--------|------|
| `DATA_DB_PATH` | Mac Python + Next.js + docker-compose | `output/data.db` / `/data/data.db` | 분석 데이터 DB 경로 |
| `BOARD_DB_PATH` | Next.js + docker-compose | `/data/board.db` | Board 기능 DB 경로 |
| `NAS_SSH_HOST` | `run_and_commit.sh` | `100.93.245.113` | Synology Tailscale IP |
| `NAS_SSH_PORT` | `run_and_commit.sh` | `22` | SSH 포트 |
| `NAS_SSH_USER` | `run_and_commit.sh` | `admin` | SSH 유저 |
| `FRED_API_KEY` | Mac Python | — | FRED 경제 데이터 |
| `GOOGLE_API_KEY` | Mac Python | — | Gemini AI |
| `OPENAI_API_KEY` | Mac Python | — | GPT API |
| `PERPLEXITY_API_KEY` | Mac Python | — | Perplexity AI |

---

## 수동 데이터 배포

```bash
cd /Users/frindle/workspace/synology/us-stock
source .venv/bin/activate

python scripts/run_integrated_analysis.py
python scripts/regen_dashboard_data.py

python3 -c "
import sqlite3
conn = sqlite3.connect('output/data.db')
r = conn.execute('PRAGMA wal_checkpoint(FULL)').fetchone()
conn.close()
print(f'WAL checkpoint: busy={r[0]}, written={r[1]}, moved={r[2]}')
"

rsync -az --checksum -e "ssh -p 22" \
  output/data.db admin@100.93.245.113:/volume1/docker/us-stock/board/data.db
```

---

## Cross-references

- [ci-flow_v2.md](./ci-flow_v2.md) — 코드 변경 시 GitHub Actions CI/CD 상세
- [ai-builder.md](./ai-builder.md) — AI Builder 포털 아키텍처
