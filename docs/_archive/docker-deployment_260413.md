# US-Stock 배포 아키텍처 — Next.js + git-scraping (book-finder 패턴)

## 개요

로컬 Mac에서 무거운 Python 분석을 돌리고, 결과 JSON을 Git에 커밋하면 GitHub Actions가 **Next.js 16 이미지에 데이터를 베이크**해서 Synology에 배포하는 구조. book-finder 프로젝트와 동일한 CI/CD 인프라(GitHub Actions → GHCR → Tailscale SSH → Synology)를 **1:1로 재사용**한다.

이 패턴은 두 가지 기존 기법의 결합이다:
- **Jamstack / 빌드타임 pre-rendering** — Netlify, Vercel, Next.js가 수년간 표준화
- **Simon Willison의 git-scraping** — 데이터 스냅샷을 git에 커밋하고 build를 트리거 ([참고](https://simonwillison.net/2020/Oct/9/git-scraping/))

## 왜 Next.js인가 (nginx:alpine 대비)

| 항목 | nginx:alpine | **Next.js standalone** |
|------|--------------|-----------------------|
| book-finder 인프라 일관성 | ✗ (다른 패턴) | **✓ (1:1 동일)** |
| 이미지 크기 | ~8 MB | ~200 MB (여전히 작음) |
| 데이터 로딩 | `fetch('/*.json')` 런타임 | **빌드타임 `import`**, HTML에 베이크 |
| UI 프레임워크 | 바닐라 HTML | **React 19 + shadcn/ui + Tailwind v4** |
| 타입 안정성 | 없음 | TypeScript strict |
| 라우팅 | 수동 JS | App Router (SSG, dynamic, API routes) |
| 컴포넌트 재사용 | 제한적 | React ecosystem 전체 |
| 이미지 태그 롤백 | 볼륨 상태 덮어씌움 | **태그별 완전 스냅샷** (데이터 포함) |
| healthcheck | 별도 설정 필요 | `/api/health` 라우트 하나 |

Next.js의 추가 비용(빌드 ~3분, 이미지 ~200 MB)은 1-2명 사용 환경에서 무시할 수준이며, 대시보드가 데이터 밀도 높은 (Obsidian Terminal 스타일) UI로 발전할 때 React 생태계가 필수가 된다.

## 왜 git-scraping인가

Simon Willison이 2020년부터 실증한 패턴:
- 일일 데이터 JSON(1~2 MB)을 git에 커밋 → push → GitHub Actions가 빌드
- git 델타 압축이 효율적이어서 1년 누적 50 MB 수준 (2 MB × 365일 = 산술상 730 MB 이지만 실측 ~50 MB)
- 각 커밋은 그 시점의 데이터 스냅샷이므로 **완전한 감사 로그** (어제 데이터는 어땠나 → `git show HEAD~1`)
- 빌드 캐시(`cache-to: type=gha`)로 Next.js 레이어는 재사용, JSON만 바뀌면 실제 재빌드는 수초~1분

대안 (rsync 볼륨 마운트, S3, Git LFS 등) 대비 장점: **코드와 데이터 라이프사이클이 한 덩어리**. 이미지 태그 하나로 "2026-04-11 17:00의 앱 + 데이터" 전체가 재현된다.

## 책임 분리

### Mac (로컬, 무거운 연산)
- Python 3.13 venv + 전체 의존성 (yfinance, curl_cffi, lightgbm, fredapi, scikit-learn 등)
- `.env` — 모든 API 키 (**NAS에 절대 복사 안 함**)
- `data/*.csv`, `ml/models/*.joblib`, 역사적 가격/모델
- launchd 스케줄 (평일 06:00 KST, `caffeinate -i`로 슬립 방지)
- 파이프라인 실행 → 검증 → JSON을 `dashboard-next/public/data/`에 복사 → git commit + push

### GitHub (빌드 & 배포)
- Repository: 소스 코드 + Next.js 앱 + **커밋된 JSON 데이터**
- Actions: `.github/workflows/deploy.yml`
- GHCR: `ghcr.io/jeehoon0310/us-stock:latest`
- Tailscale: CI/CD **전용** (runtime 경로 아님, book-finder 인프라 재사용)

### Synology NAS (서빙 레이어)
- **us-stock 컨테이너**: Container Manager → Next.js standalone
  - `network_mode: host`, `PORT=8889`, `HEALTHCHECK /api/health`
  - **데이터 볼륨 마운트 없음** (이미지에 모두 베이크)
  - API 키 없음, Python 없음, cron 없음, 학습 모델 없음
- **us-stock-dashboard 컨테이너**: nginx (bridge network, `:8080`)
  - 정적 파일(`/pages/*.html`, `/images/`) 직접 서빙
  - 나머지 경로 → `proxy_pass http://192.168.1.11:8889` (Next.js)
  - notice.html 등 강의 공지 페이지 호스팅
- DSM Reverse Proxy: `edu.frindle.synology.me` (443, Let's Encrypt) → **`localhost:8080`** (nginx)

### ASUS Router (WAN)
- 포트포워드 443 → Synology LAN IP
- 사용자의 기존 다른 서비스와 동일한 패턴

### End User (Browser)
- `https://edu.frindle.synology.me` 접속
- 경로: Browser → HTTPS → ASUS WAN 443 → Synology 역방향 프록시 → nginx `:8080` → (정적 `/pages/`) 또는 (proxy_pass → Next.js `:8889`)
- **Tailscale을 사용하지 않음** (CI/CD 전용)

## 데이터 흐름 (ASCII)

```
Mac launchd (평일 06:00 KST)
  ↓
scripts/run_and_commit.sh
  ├─ source .venv/bin/activate
  ├─ python run_integrated_analysis.py    (10분, 외부 API 호출)
  ├─ python regen_dashboard_data.py
  ├─ 검증: output/*.json + reports/*.json 존재 확인
  ├─ cp output/*.json dashboard-next/public/data/
  ├─ cp -r reports/*.json dashboard-next/public/data/reports/
  ├─ git add dashboard-next/public/data
  ├─ git commit -m "chore(data): daily update $(date +%F)"
  └─ git push origin main
                ↓
        [GitHub webhook]
                ↓
GitHub Actions (.github/workflows/deploy.yml)
  1. Checkout
  2. Setup Docker Buildx
  3. Login GHCR
  4. Build Next.js Docker image (3-stage: deps → builder → runner)
     • builder: npm run build → 'standalone' output
     • Server Component에서 `import cfg from '@/../public/data/regime_config.json'`
     • 데이터가 .next/server/ 번들에 자동 베이크
  5. Push → ghcr.io/jeehoon0310/us-stock:latest + sha + YYYYMMDD-HHmm
  6. Tailscale connect (CI/CD 전용)
  7. SSH → Synology
       docker login ghcr.io → docker pull → docker compose down → compose up -d
       → health check loop (30×2s, curl /api/health)
                ↓
Synology Container Manager
  us-stock 컨테이너 (node:20-slim, standalone, host network, :8889)
  us-stock-dashboard 컨테이너 (nginx, bridge network, :8080)
    ├─ /pages/*.html, /images/ → 정적 파일 직접 서빙
    └─ / → proxy_pass http://192.168.1.11:8889
                ↓
DSM Reverse Proxy (443, Let's Encrypt) → localhost:8080 (nginx)
                ↓
ASUS Router WAN 443 포트포워드
                ↓
End User Browser: https://edu.frindle.synology.me
```

## 파일 구조 변경

### 신규 생성
- `dashboard-next/` — Next.js 16 애플리케이션
  - `package.json`, `package-lock.json`
  - `next.config.mjs` (`output: 'standalone'`)
  - `tsconfig.json`
  - `postcss.config.mjs`, `tailwind.config.ts`
  - `app/layout.tsx`, `app/page.tsx`
  - `app/regime/page.tsx`
  - `app/top-picks/page.tsx`
  - `app/ai/page.tsx`
  - `app/forecast/page.tsx`
  - `app/ml/page.tsx`
  - `app/costs/page.tsx`
  - `app/api/health/route.ts`
  - `src/lib/data.ts` — JSON 타입 정의 + 로더 헬퍼
  - `src/components/ui/` — shadcn 프리미티브 (button, card, badge, table, tabs)
  - `src/components/domain/` — RegimeCard, SensorPanel, TopPicksTable, AIAnalysisModal 등
  - `public/data/.gitkeep` — Python 파이프라인 출력 목적지
  - `Dockerfile` — book-finder 3-stage 복제
- `scripts/run_and_commit.sh` — Mac 측 일일 실행 래퍼
- `scripts/com.us-stock.daily.plist` — launchd 스케줄

### 유지 (수정 없음)
- `analyzers/`, `collectors/`, `pipeline/`, `ml/`, `us_market/`
- `run_integrated_analysis.py`, `regen_dashboard_data.py`, `run_screening.py`, `run_full_pipeline.py`
- `data/`, `output/`, `reports/`, `result/`, `logs/`, `ml/models/`
- `.env`, `.env.example`
- `.venv/` (Mac 로컬 개발)

### 교체
- **루트 `Dockerfile`** — Python 기반 → Next.js 3-stage로 교체
- **루트 `docker-compose.prod.yml`** — ghcr.io/jeehoon0310/us-stock 이미지, 볼륨 마운트 없이 단순화
- **`.github/workflows/deploy.yml`** — Next.js 빌드로 변경 (Supabase ARG 제거, Trivy/Cosign 생략 유지)

### 아카이브 (삭제 또는 deprecated 마킹)
- `entrypoint.sh` — Python 컨테이너용이었음, 더 이상 사용하지 않음
- `crontab` — 스케줄러 역할을 Mac launchd가 대체
- `run_docker_analysis.sh` — 파이프라인이 컨테이너 밖(Mac)에서 돌음
- `requirements.txt` — 컨테이너용이 아니라 로컬 venv용으로만 의미 (필요 시 dev 의존성 명시용으로 유지 가능)
- `dashboard/index.html` — 1234줄 바닐라 HTML, Next.js 앱으로 포팅 후 deprecated 마킹

## Next.js 앱 구조 (dashboard-next/)

### 데이터 로더 (`src/lib/data.ts`)

```typescript
// 빌드타임 import — Next.js가 정적 분석하고 트리 셰이킹함
import regimeConfig from "../../public/data/regime_config.json";
import regimeResult from "../../public/data/regime_result.json";
import marketGate from "../../public/data/market_gate.json";
import finalTop10 from "../../public/data/final_top10_report.json";
import aiSummaries from "../../public/data/ai_summaries.json";
import gbmPredictions from "../../public/data/gbm_predictions.json";
import indexPrediction from "../../public/data/index_prediction.json";
import predictionHistory from "../../public/data/prediction_history.json";
import latestReport from "../../public/data/latest_report.json";

export type RegimeConfig = {
  regime: "risk_on" | "neutral" | "risk_off" | "crisis";
  score: number;
  adaptive: { stop_loss: number; mdd: number; strategy: string };
  sensors: Record<string, { weight: number; score: number; note: string }>;
};

export type TopPick = {
  rank: number;
  ticker: string;
  grade: "A" | "B" | "C" | "D" | "F";
  intelligence_score: number;
  quant_score: number;
  ai_score: number;
  tech: number;
  fund: number;
  rs_vs_spy: number;
  recommendation: "BUY" | "WATCH" | "SMALL BUY" | "HOLD";
  company_name: string;
  sector: string;
};

export const data = {
  regime: regimeConfig as RegimeConfig,
  regimeResult,
  marketGate,
  topPicks: (finalTop10 as { top10: TopPick[] }).top10,
  aiSummaries,
  gbmPredictions,
  indexPrediction,
  predictionHistory,
  latestReport,
};
```

### Server Component 사용 예시 (`app/regime/page.tsx`)

```typescript
import { data } from "@/lib/data";
import { RegimeCard } from "@/components/domain/RegimeCard";

export default function RegimePage() {
  // data.regime은 빌드타임에 정적 값으로 해석됨, 런타임 fetch 없음
  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold">Market Regime</h1>
      <RegimeCard regime={data.regime} result={data.regimeResult} />
    </main>
  );
}
```

### Health check (`app/api/health/route.ts`)

```typescript
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "us-stock",
  });
}
```

### `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // us-stock은 외부 이미지가 없으므로 remotePatterns 불필요
  // 필요 시 차트 CDN 도메인 추가
};
export default nextConfig;
```

## Dockerfile (Next.js 3-stage) — book-finder 패턴 1:1 복제

```dockerfile
# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY dashboard-next/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard-next/ .
RUN npm run build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

**book-finder Dockerfile과의 유일한 차이**:
- `ARG NEXT_PUBLIC_SUPABASE_*` 4줄 제거 (us-stock은 Supabase 미사용)
- Build context가 루트 레포이므로 `COPY dashboard-next/package*.json` 처럼 서브디렉토리 지정
- `COPY --from=builder ... /app/public` 한 줄 추가 (JSON 데이터 번들링)

## docker-compose.prod.yml

```yaml
services:
  us-stock:
    image: ghcr.io/jeehoon0310/us-stock:latest
    container_name: us-stock
    network_mode: host
    environment:
      - HOSTNAME=0.0.0.0
      - NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "com.centurylinklabs.watchtower.enable=false"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

**book-finder와의 차이**:
- `env_file: .env.production` 제거 (API 키가 필요 없음)
- 이미지 이름만 변경

## GitHub Actions deploy.yml

```yaml
name: Build & Deploy to Synology

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=
            type=raw,value={{date 'YYYYMMDD-HHmm'}},enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Connect to Tailscale
        uses: tailscale/github-action@v3
        with:
          authkey: ${{ secrets.TAILSCALE_AUTHKEY }}

      - name: Deploy to Synology
        uses: appleboy/ssh-action@v1
        env:
          GHCR_PULL_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          host: ${{ secrets.SYNOLOGY_HOST }}
          username: ${{ secrets.SYNOLOGY_USERNAME }}
          key: ${{ secrets.SYNOLOGY_SSH_KEY }}
          port: ${{ secrets.SYNOLOGY_PORT }}
          envs: GHCR_PULL_TOKEN
          script: |
            set -e
            echo "$GHCR_PULL_TOKEN" | sudo /usr/local/bin/docker login ghcr.io -u jeehoon0310 --password-stdin
            sudo /usr/local/bin/docker pull ghcr.io/jeehoon0310/us-stock:latest
            sudo mkdir -p /volume1/docker/us-stock
            sudo chown -R jeehoon /volume1/docker/us-stock
            cd /volume1/docker/us-stock
            curl -sfL "https://raw.githubusercontent.com/jeehoon0310/us-stock/main/docker-compose.prod.yml" -o docker-compose.yml.new
            if ! diff -q docker-compose.yml docker-compose.yml.new > /dev/null 2>&1; then
              echo "docker-compose.yml updated from Git"
              sudo mv docker-compose.yml.new docker-compose.yml
            else
              rm docker-compose.yml.new
              echo "docker-compose.yml unchanged"
            fi
            sudo /usr/local/bin/docker compose down || true
            sudo /usr/local/bin/docker compose up -d
            sudo /usr/local/bin/docker image prune -f
            for i in $(seq 1 30); do
              curl -sf http://localhost:8889/api/health && echo " OK" && exit 0
              sleep 2
            done
            echo "Health check failed"
            sudo /usr/local/bin/docker logs us-stock --tail=80
            exit 1
```

**book-finder 워크플로우와의 차이**:
- Supabase `build-args` 블록 제거
- 이미지 이름/경로만 `us-stock` 으로 변경
- Trivy/Cosign 스텝은 개인 프로젝트라 계속 생략

## Mac scripts

### `scripts/run_and_commit.sh`

```bash
#!/bin/bash
set -euo pipefail
cd /Users/frindle/workspace/education/us-stock
source .venv/bin/activate

LOG="logs/deploy_$(date +%Y%m%d_%H%M%S).log"

{
  echo "[$(date)] === Starting pipeline ==="

  python run_integrated_analysis.py
  python regen_dashboard_data.py

  # 검증 — 필수 JSON이 모두 있어야 커밋 진행
  for f in output/regime_config.json output/regime_result.json \
           output/market_gate.json output/final_top10_report.json \
           output/gbm_predictions.json output/ai_summaries.json \
           output/index_prediction.json output/prediction_history.json \
           output/latest_report.json reports/latest_report.json; do
    [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
  done

  # Next.js 앱의 public/data 로 복사 (빌드타임 import 경로)
  DATA_DIR="dashboard-next/public/data"
  mkdir -p "$DATA_DIR/reports"
  cp output/regime_config.json "$DATA_DIR/"
  cp output/regime_result.json "$DATA_DIR/"
  cp output/market_gate.json "$DATA_DIR/"
  cp output/final_top10_report.json "$DATA_DIR/"
  cp output/gbm_predictions.json "$DATA_DIR/"
  cp output/ai_summaries.json "$DATA_DIR/"
  cp output/index_prediction.json "$DATA_DIR/"
  cp output/prediction_history.json "$DATA_DIR/"
  cp output/latest_report.json "$DATA_DIR/"
  cp reports/*.json "$DATA_DIR/reports/" 2>/dev/null || true

  # Git commit & push
  if ! git diff --quiet "$DATA_DIR"; then
    git add "$DATA_DIR"
    git commit -m "chore(data): daily update $(date +%F)"
    git push origin main
    echo "[$(date)] === Pushed new data to GitHub — Actions will build & deploy ==="
  else
    echo "[$(date)] === No data changes, skipping commit ==="
  fi
} 2>&1 | tee "$LOG"
```

핵심 포인트:
- `set -euo pipefail` — 실패 즉시 중단
- 검증 블록 — 필수 JSON 누락 시 git에 불완전 데이터 push 방지
- 변경 없으면 빈 커밋 안 만듦 (주말/휴장일 대비)
- 로그는 Mac 로컬에만 남음

### `scripts/com.us-stock.daily.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.us-stock.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/caffeinate</string>
        <string>-i</string>
        <string>/Users/frindle/workspace/education/us-stock/scripts/run_and_commit.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Weekday</key><integer>3</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    </array>
    <key>StandardOutPath</key><string>/Users/frindle/workspace/education/us-stock/logs/launchd.out.log</string>
    <key>StandardErrorPath</key><string>/Users/frindle/workspace/education/us-stock/logs/launchd.err.log</string>
    <key>RunAtLoad</key><false/>
</dict>
</plist>
```

설치:
```bash
chmod +x scripts/run_and_commit.sh
cp scripts/com.us-stock.daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.us-stock.daily.plist
launchctl list | grep us-stock  # 등록 확인
```

## 브라우저 접근 경로 (엔드유저)

```
User Browser
  ↓ HTTPS 443
ASUS Router (WAN)
  포트포워드 443 → Synology LAN IP (예: 192.168.x.x)
  ↓
Synology DSM Reverse Proxy
  호스트: edu.frindle.synology.me
  백엔드: http://localhost:3000
  TLS: Let's Encrypt 자동 갱신
  ↓
us-stock 컨테이너 (network_mode: host, :3000)
  Next.js standalone server
  ↓
정적 HTML + 데이터 (이미 이미지에 베이크됨)
```

**중요**:
- **Tailscale은 이 경로에 관여하지 않음** (CI/CD의 GitHub Actions → Synology SSH 구간에만 사용)
- 이 패턴은 사용자의 다른 서비스(book-finder 등)와 동일

## 마이그레이션 절차 (현재 빈 컨테이너 → 새 Next.js 컨테이너)

### 1단계: Synology 기존 컨테이너 정리
```bash
ssh frindle@synology
cd /volume1/docker/us-stock
sudo docker compose down
sudo docker rmi ghcr.io/jeehoon0310/us-stock:latest || true
# 기존 Python 볼륨(data/, output/, ml-models/ 등)은 더 이상 필요 없음
# 필요 시 유지, 완전 정리 원하면: sudo rm -rf data output reports result logs ml-models
```

### 2단계: Mac에서 Next.js 앱 스캐폴딩
```bash
cd /Users/frindle/workspace/education/us-stock
npx create-next-app@16 dashboard-next \
  --typescript --app --tailwind --no-src-dir --no-eslint
# (또는 book-finder 구조 복제 후 수정)

# next.config.mjs에 output: 'standalone' 추가
# src/lib/data.ts, app/*/page.tsx 작성
# public/data/ 디렉토리 생성
mkdir -p dashboard-next/public/data/reports
```

### 3단계: 루트 Dockerfile, docker-compose.prod.yml, deploy.yml 교체
```bash
# 기존 Python Dockerfile, entrypoint.sh, crontab, run_docker_analysis.sh 삭제 또는 백업
mv Dockerfile Dockerfile.python.bak
mv entrypoint.sh entrypoint.sh.bak
mv crontab crontab.bak
mv run_docker_analysis.sh run_docker_analysis.sh.bak

# 새 파일 작성 (본 문서의 Dockerfile, docker-compose.prod.yml, deploy.yml 내용)
```

### 4단계: Mac 수동 파이프라인 실행 + push
```bash
# venv 활성화 후 파이프라인 실행
source .venv/bin/activate
python run_integrated_analysis.py
python regen_dashboard_data.py

# JSON을 Next.js 앱의 public/data 로 복사
cp output/*.json dashboard-next/public/data/
cp reports/*.json dashboard-next/public/data/reports/ 2>/dev/null || true

# Next.js 로컬 빌드 테스트 (선택)
cd dashboard-next && npm install && npm run build && cd ..

# 커밋 & push (GitHub Actions 트리거)
git add dashboard-next scripts Dockerfile docker-compose.prod.yml .github/workflows/deploy.yml
git commit -m "feat: Next.js dashboard with git-scraping pattern"
git push origin main
```

### 5단계: GitHub Actions 빌드 모니터링
- GitHub Actions 탭에서 워크플로우 진행 확인
- 실패 시 로그 확인 후 수정 → 재푸시
- 성공하면 Synology에 자동 배포됨

### 6단계: DSM 역방향 프록시 업데이트
- Control Panel → Login Portal → Advanced → Reverse Proxy
- `edu.frindle.synology.me` 라우트의 포트를 **8889 → 3000** 으로 변경 (필요 시)

### 7단계: Mac scripts 설치 (일일 자동화)
```bash
chmod +x scripts/run_and_commit.sh
cp scripts/com.us-stock.daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.us-stock.daily.plist
```

## 검증 체크리스트

```bash
# 1. API health
curl -sf https://edu.frindle.synology.me/api/health
# 기대: {"status":"ok","timestamp":"...","service":"us-stock"}

# 2. 각 페이지 데이터 렌더링 (브라우저로 확인)
# - https://edu.frindle.synology.me/  (Overview)
# - /regime  (Market Regime — regime_config.json 값)
# - /top-picks  (Top Picks — final_top10_report.json)
# - /ai  (AI Analysis — ai_summaries.json)
# - /forecast  (Index Forecast — index_prediction.json)
# - /ml  (ML Rankings — gbm_predictions.json)

# 3. Synology 컨테이너 상태
ssh frindle@synology "docker ps | grep us-stock && docker logs us-stock --tail=20"

# 4. Mac launchd 등록 확인
launchctl list | grep us-stock

# 5. 최근 배포 로그
cat logs/deploy_$(date +%Y%m%d)_*.log 2>/dev/null || echo "No deploy log yet"

# 6. GitHub Actions 최근 run 상태
gh run list --limit 5
```

## 향후 개선

### A. Telegram 알림
- `scripts/run_and_commit.sh` 마지막에 `curl -s "https://api.telegram.org/bot$TG_TOKEN/sendMessage"` 추가
- 파이프라인 성공 시: verdict + top 3 종목
- 실패 시: 에러 요약 + 로그 마지막 10줄
- book-finder의 `TOON_BOT_TOKEN` 패턴 재사용 가능

### B. 대시보드 staleness 배지
- `latest_report.json`의 `generated_at`을 Next.js 레이아웃에서 표시
- 36시간 초과 시 헤더에 주황 배지 (Mac 슬립 누락 조기 감지)

### C. Self-hosted GitHub Actions runner on Mac (Pattern E)
- Mac에 `actions/runner` 설치 → launchd 대신 GitHub Actions가 파이프라인 실행
- **이점**: GitHub UI에서 실행 히스토리, 실패 알림, 수동 재실행 버튼
- **비용**: runner 프로세스 관리, 보안 (repo write access)
- 현재는 launchd로 충분, 모니터링 니즈가 생기면 업그레이드

### D. Hyper Backup (최소 유지)
- 이미지가 source of truth이므로 사실상 불필요
- git 레포 자체가 데이터 히스토리 백업 (git-scraping)
- 필요 시 `/volume1/docker/us-stock/` 주간 백업만

### E. ISR (Incremental Static Regeneration)
- Next.js `export const revalidate = 60` 를 각 page에 추가해 60초 캐시
- 그러나 JSON이 빌드타임에 베이크되므로 효과는 미미 (재배포 없이 갱신 안 됨)
- 재빌드 없는 갱신을 원하면 app/api/* 에서 fs.readFile 후 `revalidate` 지정 — 이 경우 볼륨 마운트 패턴으로 회귀

## 비교 표 — 1차/2차/3차 아키텍처

| 항목 | 1차 (Python on NAS) | 2차 (nginx+rsync) | **3차 (Next.js+git-scraping)** |
|------|--------------------|------------------|------------------------------|
| NAS 이미지 크기 | ~800 MB | ~8 MB | ~200 MB |
| NAS CPU 부하 | 10분 파이프라인 + 상시 | idle nginx | idle Next.js standalone |
| 데이터 위치 | NAS 볼륨 (미전달!) | NAS 볼륨 (rsync) | **Docker 이미지에 베이크** |
| API 키 저장 | NAS `.env.production` | Mac only | **Mac only** |
| 배포 경로 | GitHub Actions → SSH | Mac → Tailscale rsync | **GitHub Actions → Tailscale SSH (book-finder 일치)** |
| 엔드유저 경로 | ASUS → 역방향 프록시 | ASUS → 역방향 프록시 | ASUS → 역방향 프록시 |
| 롤백 | 어려움 | rsync 덮어쓰기 | **`docker pull us-stock:<tag>`** |
| 데이터 히스토리 | 없음 | 없음 | **git log** |
| UI 프레임워크 | 바닐라 HTML | 바닐라 HTML | **Next.js 16 + React 19 + shadcn/ui** |
| book-finder 일관성 | ✗ | ✗ | **✓** |
| 디버깅 | NAS SSH | Mac 로그 | **Mac 로그 + GitHub Actions** |
| 현재 상태 | 빈 대시보드 | 문서만 | **목표 구조** |

## 참고 자료

- **git-scraping**: [Simon Willison — Git scraping: track changes over time](https://simonwillison.net/2020/Oct/9/git-scraping/)
- **git-scraping 시리즈**: [simonwillison.net/series/git-scraping](https://simonwillison.net/series/git-scraping/)
- **Next.js 16 App Router**: [nextjs.org/docs/app](https://nextjs.org/docs/app)
- **Next.js standalone Docker**: [github.com/vercel/next.js/tree/canary/examples/with-docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- **shadcn/ui dashboard blocks**: [ui.shadcn.com/blocks](https://ui.shadcn.com/blocks)
- **Tremor (데이터 대시보드 컴포넌트)**: [tremor.so](https://www.tremor.so/)
- **Tailscale + Synology**: [tailscale.com/docs/integrations/synology](https://tailscale.com/docs/integrations/synology)
- **로컬 참조 Dockerfile**: `/Users/frindle/workspace/toon/book-finder/Dockerfile`
- **로컬 참조 deploy.yml**: `/Users/frindle/workspace/toon/book-finder/.github/workflows/deploy.yml`
- **로컬 참조 docker-compose.prod.yml**: `/Users/frindle/workspace/toon/book-finder/docker-compose.prod.yml`

## 아카이브 — 이전 1차/2차 접근의 흔적

### 1차: Python 파이프라인 on Synology (2026-04-11)
- `Dockerfile` (python:3.13-slim + cron + curl_cffi + lightgbm)
- `entrypoint.sh` (cron + http.server)
- `crontab` (평일 17:00 ET)
- `run_docker_analysis.sh` (컨테이너 내 파이프라인 래퍼)
- `requirements.txt`
- **실패 원인**: NAS 볼륨에 데이터/모델/API 키가 전달되지 않아 모든 페이지가 빈 상태

### 2차: nginx:alpine + Mac rsync (same day)
- `docker-compose.prod.yml` (nginx:alpine)
- `nginx.conf`
- `scripts/run_and_deploy.sh` (Mac → Tailscale rsync)
- **문제**: Tailscale이 Mac↔Synology 런타임 경로로 설계되어 사용자의 실제 인프라(ASUS + 역방향 프록시)와 맞지 않음. nginx는 book-finder 패턴과 일관성 없음

### 3차: 본 문서 (Next.js + git-scraping) ← **현재**
- book-finder 인프라 1:1 재사용
- 데이터와 코드가 이미지 태그에 묶임 (완전 스냅샷)
- Mac → git push → GHA → GHCR → Synology

1차/2차 파일은 git 히스토리로만 보존한다:
```bash
git log --oneline --all -- Dockerfile entrypoint.sh crontab run_docker_analysis.sh
git log --oneline --all -- docs/docker-deployment.md
```
