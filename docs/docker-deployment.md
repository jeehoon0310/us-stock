# US-Stock Docker 컨테이너화 + Synology NAS 배포

## 개요

us-stock 프로젝트를 Docker로 컨테이너화하고 Synology NAS(DS1522+, x86_64)에 배포하는 작업.
book-finder 프로젝트의 Docker + CI/CD 패턴(GitHub Actions → GHCR → Tailscale SSH → Synology)을 참고하되, Python 배치 작업 + 정적 대시보드 특성에 맞게 조정.

---

## 핵심 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 컨테이너 구조 | 싱글 컨테이너 (Python + HTTP server + cron) | 1-2명 사용, 배치 작업 + 정적 파일 서빙 |
| 스케줄링 | Debian cron (컨테이너 내장) | python:3.13-slim에 포함, 외부 의존성 불필요 |
| 대시보드 서빙 | Python http.server (port 8889) | 1-2명 사용 규모에 nginx 불필요 |
| 심링크 문제 | 파이프라인 실행 후 cp로 복사 | Docker 볼륨 간 symlink 불가 |
| 이미지 레지스트리 | GHCR (book-finder 패턴 재사용) | 인프라 이미 구축됨 |
| CI/CD | GitHub Actions → GHCR → Tailscale SSH | book-finder와 동일, Trivy/Cosign 제거 |
| 타임존 | TZ=America/New_York | US 마켓 기준 날짜 스탬프 |

## book-finder 대비 개선 포인트

1. **컨테이너 내 cron** — 스케줄을 코드(crontab 파일)로 관리, DSM Task Scheduler 의존 제거
2. **Trivy/Cosign 제거** — 개인 분석 도구에 과잉. 워크플로우 118줄 → ~60줄, 배포 2-3분 단축
3. **6개 볼륨 마운트** — book-finder는 stateless. us-stock은 재생성 가능(data/, output/) vs 보존 필수(reports/, result/, ml/models/) 구분
4. **로그 로테이션** — `max-size: 10m, max-file: 3`으로 NAS 디스크 보호
5. **파이프라인 lock** — 배포 중 실행 중인 파이프라인 중단 방지
6. **환경변수 cron 전달** — entrypoint에서 `printenv > .env.cron`, 래퍼에서 source

---

## 생성된 파일

### 1. `requirements.txt`
Python 런타임 의존성 16개 패키지 (dev 패키지 제외):
- 핵심: yfinance, fredapi, curl_cffi, pandas, lightgbm, scikit-learn, pyarrow
- curl_cffi==0.13.0은 PyPI에서 linux/amd64 manylinux wheel 제공

### 2. `Dockerfile` (2-stage 빌드)
- **Stage 1 (builder)**: `python:3.13-slim` + gcc/g++ → pip install --prefix=/install
- **Stage 2 (runner)**: `python:3.13-slim` + cron + curl + libgomp1 (lightgbm 런타임 의존성)
- dashboard/ 내 symlink 삭제 (find -type l -delete)
- HEALTHCHECK: curl http://localhost:8889/ (60초 간격)

### 3. `entrypoint.sh`
- 환경변수를 `/app/.env.cron`에 export (cron은 환경변수 미상속)
- output/ → dashboard/ JSON 파일 복사 (sync_dashboard)
- cron 데몬 백그라운드 시작
- `python -m http.server 8889` 포그라운드 실행

### 4. `crontab`
- `0 17 * * 1-5` — 평일 ET 17:00 (장 마감 1시간 후)
- `run_docker_analysis.sh` 실행 → logs/cron_output.log

### 5. `.dockerignore`
제외: .venv/, .git/, .claude/, data/, output/, reports/, result/, logs/, ml/models/, tests/

### 6. `docker-compose.yml` (로컬 개발용)
- build context, ports: 8889:8889
- env_file: .env, TZ=America/New_York
- 6개 볼륨: data, output, reports, result, logs, ml/models

### 7. `docker-compose.prod.yml` (Synology 프로덕션용)
- image: ghcr.io/jeehoon0310/us-stock:latest
- network_mode: host
- /volume1/docker/us-stock/ 하위 6개 볼륨
- healthcheck, logging (max-size 10m), watchtower disabled

### 8. `run_docker_analysis.sh` (파이프라인 래퍼)
- lock 파일로 동시 실행 방지
- .env.cron source → run_integrated_analysis.py → regen_dashboard_data.py → dashboard sync

### 9. `.github/workflows/deploy.yml`
- Checkout → Buildx → GHCR Login → Metadata → Build+Push → Tailscale → SSH Deploy
- book-finder 기반 간소화 (Trivy/Cosign 제거)
- Health check: 15회 x 2초 간격

---

## 빌드 중 해결한 문제

### libgomp1 누락
- **증상**: `OSError: libgomp.so.1: cannot open shared object file`
- **원인**: lightgbm이 런타임에 OpenMP(libgomp) 필요, python:3.13-slim에 미포함
- **해결**: Dockerfile runner 스테이지에 `libgomp1` 패키지 추가

---

## 로컬 검증 결과 (2026-04-11)

| 항목 | 결과 |
|------|------|
| Docker 빌드 (linux/amd64) | 성공 |
| 대시보드 (http://localhost:8889) | 정상 응답 |
| curl_cffi import | OK |
| lightgbm 4.6.0 import | OK |
| JSON 파일 sync (9개) | output/ → dashboard/ 복사 완료 |
| reports 디렉토리 sync | daily_report_20260409/20260410 + latest |
| crontab 설정 | 평일 17:00 ET 등록됨 |

---

## Synology 배포 절차 (다음 단계)

### 1. GitHub 레포 생성 + push
```bash
git init && git add . && git commit -m "Initial commit with Docker support"
gh repo create jeehoon0310/us-stock --private --push
```

### 2. GitHub Secrets 설정
book-finder와 공유 가능: `SYNOLOGY_HOST`, `SYNOLOGY_USERNAME`, `SYNOLOGY_SSH_KEY`, `SYNOLOGY_PORT`, `TAILSCALE_AUTHKEY`, `GHCR_TOKEN`

### 3. Synology 초기 설정 (SSH)
```bash
sudo mkdir -p /volume1/docker/us-stock/{data,output,reports,result,logs,ml-models}

# .env.production 생성
sudo tee /volume1/docker/us-stock/.env.production << 'EOF'
FRED_API_KEY=<key>
GOOGLE_API_KEY=<key>
OPENAI_API_KEY=<key>
PERPLEXITY_API_KEY=<key>
FINNHUB_API_KEY=<key>
EOF
sudo chmod 600 /volume1/docker/us-stock/.env.production
```

### 4. 데이터 마이그레이션
```bash
rsync -avz data/ output/ reports/ result/ user@synology:/volume1/docker/us-stock/
rsync -avz ml/models/ user@synology:/volume1/docker/us-stock/ml-models/
```

### 5. 리버스 프록시 (DSM)
DSM > Control Panel > Login Portal > Advanced > Reverse Proxy:
- `https://stock.frindle.synology.me` → `http://localhost:8889`

### 6. 향후 개선
- Telegram 알림: 파이프라인 성공/실패 + 레짐 변경 알림
- 대시보드 신선도 배지: generated_at 36시간 초과 시 경고
- Hyper Backup: reports/, result/, ml-models/ 주간 백업
