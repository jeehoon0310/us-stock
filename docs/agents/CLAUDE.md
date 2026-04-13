# US Stock Market Analysis System — Claude Code 설정

## 프로젝트 개요

S&P 500 시장 분석 시스템. 6단계 파이프라인으로 데이터 수집 → 시장 체제 감지 → 스마트 머니 스크리닝 → AI 분석 → 최종 리포트 → 대시보드를 자동화한다.

## 기술 스택

- Python 3.13, 가상환경: `.venv/`
- 데이터: yfinance, pandas, numpy, curl_cffi, FRED API, Finnhub
- AI: Gemini (기본), OpenAI, Perplexity
- 시각화: matplotlib, seaborn, HTML SPA
- 환경변수: `.env` (python-dotenv)

## 디렉토리 구조

```
us-stock/
├── collectors/          # 데이터 수집
├── analyzers/           # 분석 엔진
├── pipeline/            # 파이프라인 통합
├── tests/               # 테스트
├── dashboard/           # 웹 대시보드
├── data/                # CSV 출력
├── output/              # JSON 출력
├── result/              # 날짜별 스크리닝 결과
├── .docs/               # 문서 (기획, 분석 노트, 진화 로그)
│   ├── daily/           # 일일 점검/진화 기록
│   ├── quant/           # 퀀트 분석 노트
│   ├── ai/              # AI 품질 리포트, 프롬프트 버전
│   ├── architecture/    # ADR, 구조 리뷰
│   └── backlog/         # 진화 백로그
├── run_full_pipeline.py # 6단계 전체 실행
├── run_screening.py     # S&P 500 스크리닝
├── .env                 # API 키
└── CLAUDE.md            # 이 파일
```

## 실행 방법

```bash
source .venv/bin/activate
python run_full_pipeline.py            # 전체 파이프라인
python run_screening.py                # 스크리닝만
python -m analyzers.market_regime      # 체제 감지만
python -m analyzers.market_gate        # 시장 게이트만
cd dashboard && python3 -m http.server 8889  # 대시보드
```

## 에이전트 팀

`.claude/agents/` 디렉토리에 6개 전문 에이전트가 정의되어 있다:

| 에이전트 | 역할 | 모델 |
|----------|------|------|
| `lead` | 프로젝트 리드 — 일일 진화 사이클 총괄 | opus |
| `quant-analyst` | 퀀트 분석가 — 체제/팩터/스크리닝 로직 | opus |
| `data-engineer` | 데이터 엔지니어 — 수집기/파이프라인 | sonnet |
| `ai-strategist` | AI 전략가 — AI 분석/프롬프트 | opus |
| `dashboard-dev` | 대시보드 개발자 — 시각화/UX | sonnet |
| `qa` | QA 엔지니어 — 테스트/검증/품질 | sonnet |
| `architect` | 시스템 아키텍트 — 구조/성능/확장성 | opus |

## 코딩 규칙

- logging 모듈 사용 (print 금지, 디버깅용 제외)
- API 키는 .env 전용 (하드코딩 절대 금지)
- 모든 API 호출에 timeout 설정
- 에러 시 빈 DataFrame/dict 반환 + 로깅
- pandas df.copy() 반환 (원본 불변)
- 매직 넘버 상수화
- NaN 처리 명시적
- tqdm으로 진행 표시 (대량 작업)

## 주의사항

- yfinance는 차단될 수 있음 → curl_cffi Session 사용
- FRED API 키 필수 (매크로 데이터)
- AI 분석 비용 주의 (APIUsageTracker 확인)
- result/ 디렉토리에 날짜별 CSV 축적됨
- dashboard는 output/ symlink 필요
