# 미국 주식 시장 분석 시스템

> "주식시장 건강검진 로봇" - 시장 데이터를 자동으로 모아서, 지금 시장이 좋은지 나쁜지 알려주고, 살 만한 종목까지 찾아주는 프로그램

## 이 프로젝트가 하는 일

병원에서 건강검진할 때 혈압, 혈당, 심전도 등 여러 검사를 하잖아요?
이 프로그램도 비슷해요. 주식시장의 여러 "건강 지표"를 검사해서 종합 진단을 내려줍니다.

```
Part 1: 데이터 수집        Part 2: 시장 체제 감지      Part 3: 종목 선별 + AI 분석
(혈액 채취)               (검사 결과 분석)            (처방전 작성)

 S&P 500 종목 목록         VIX 공포지수 체크           503종목 종합 점수
 주가 데이터 수집     →    추세(200일선) 판단     →    기술/펀더멘털/애널리스트
 기술적 지표 계산          금리/채권 신호              AI 뉴스 분석 (Gemini)
 매크로 경제 지표          종합 체제 판정              최종 Top 10 리포트
 섹터별 분석 + ERP (신규)  적응형 파라미터              result/ 날짜별 저장

Part 4: 다음 주 예보        Part 5: Cross-sectional    Part 6: Agent 생태계 (신규)
(기상청)                   GBM ML (신규)              (서비스 자가 진화)

 27개 센서 GBM             36+ 피처 × 50종목           22 에이전트
 SPY/QQQ 5일 방향         LightGBM rank 예측           - 기존 6 (perf-lead 팀)
 확률 + 신뢰도            walk-forward PBO/DSR          - GBM 15 (5팀×3명)
 Reflexion 100개          Top 20 cross-sectional        - service-evolver (메타)
                          output/gbm_predictions        매일 1건 자가 개선
```

---

## 한 줄 실행

```bash
source .venv/bin/activate
python run_full_pipeline.py    # 8단계 전체 자동 실행!
```

**8단계 구성**:
1. 데이터 수집 → 2. 시장 체제 → 3. 시장 게이트 → 4. 스크리닝 →
5. AI 분석 (Gemini) → 6. 최종 Top 10 → **7. GBM 예측 (cross-sectional, 신규)** → **8. 지수 방향 예측 (SPY/QQQ, IndexPredictor)**

---

## 전체 파일 구조

```
us-stock/
├── collectors/                  # 데이터 수집 (심부름꾼들)
│   ├── us_price_fetcher.py      # 주가 수집 (yfinance + curl_cffi)
│   ├── fetch_sp500_list.py      # S&P 500 종목 목록 (Wikipedia)
│   ├── fetch_sp500_prices.py    # 503개 종목 일괄 수집
│   ├── macro_collector.py       # 매크로 경제 지표 (FRED + VIX)
│   └── data_fetcher.py          # 통합 수집기 (yfinance + Finnhub fallback)
│
├── analyzers/                   # 분석 엔진 (요리사들)
│   ├── technical_indicators.py  # 기술적 지표 (SMA/RSI/ATR/BB)
│   ├── sector_analyzer.py       # 11개 섹터 분석 + 히트맵
│   ├── market_regime.py         # 시장 체제 감지 (5개 센서)
│   ├── market_gate.py           # 매수 신호등 (GO/CAUTION/STOP)
│   ├── smart_money_screener_v2.py  # 503종목 종합 스크리닝
│   ├── ai_summary_generator.py  # AI 분석 (Gemini/OpenAI/Perplexity)
│   └── final_report_generator.py   # 최종 Top 10 리포트
│
├── us_market/                   # ML 기반 지수 예측 (기상청)
│   └── index_predictor.py       # SPY/QQQ 5일 방향 예측 (27 피처 + GradientBoosting)
│
├── pipeline/                    # 파이프라인 (주방 관리자)
│   ├── us_data_pipeline.py      # Part 1 통합 오케스트레이터
│   ├── run_pipeline.py          # CLI (--top-n, --period, --output-dir)
│   ├── data_quality_report.py   # 데이터 품질 100점 채점
│   └── plot_sector_heatmap.py   # 섹터 히트맵 시각화
│
├── tests/                       # 테스트 + 연습
│   ├── test_price_fetcher.py    # 가격 수집 테스트 (4개 검증)
│   ├── test_indicators.py       # 지표 계산 테스트 (5개 검증)
│   ├── test_index_predictor.py  # IndexPredictor 테스트 (8개 검증, pytest)
│   └── (연습 스크립트들)
│
├── run_full_pipeline.py         # 전체 6단계 파이프라인 (메인!)
├── run_screening.py             # S&P 500 스크리닝 (진행 상황 표시)
├── run_all.py                   # 기본 실행 (Part 1+2+3)
│
├── data/                        # CSV 출력 (시장 데이터)
├── output/                      # JSON 출력 (분석 결과)
├── result/                      # 날짜별 스크리닝 결과
├── docs/                        # 문서
│   ├── README.md                # 이 파일!
│   └── architecture.drawio      # 시스템 구조도
│
├── ml/                          # 신규 GBM ML 파이프라인 (Part 5)
│   ├── features/
│   │   ├── macro/               # 18 거시 피처 (ERP/TIPS/VIX/Yield)
│   │   ├── equity/              # 36 종목 피처 + 5 타겟
│   │   └── merged/              # feature store 조인 결과
│   ├── pipeline/
│   │   ├── train.py             # LightGBM rank 학습 + early stopping
│   │   ├── predict.py           # Top 20 cross-sectional 예측
│   │   └── feature_store.py     # parquet 기반 피처 버저닝
│   ├── models/                  # 학습된 .pkl + metadata.json
│   ├── validation/
│   │   └── walk_forward.py      # Purged K-Fold + PBO + DSR
│   ├── datasets/                # train/val/test split
│   └── experiments/             # Optuna HPO 로그
│
├── .claude/agents/              # 22 에이전트 (Part 6)
│   ├── perf-lead.md             # 21에이전트 최상위 오케스트레이터
│   ├── signal-optimizer.md      # rule 파라미터 튜닝
│   ├── backtest-engineer.md     # 백테스트 엔진
│   ├── critic-reviewer.md       # Bull/Bear 양면 비판
│   ├── market-researcher.md     # Perplexity 웹 리서치
│   ├── perf-verifier.md         # A/B 회귀 검증
│   ├── service-evolver.md       # ★ 매일 서비스 자가 진화 메타 에이전트
│   ├── research-lead.md, paper-researcher.md, factor-discoverer.md   (Research 3)
│   ├── macro-lead.md, macro-feature-engineer.md, regime-ml-classifier.md   (Macro 3)
│   ├── equity-lead.md, equity-factor-builder.md, equity-flow-analyst.md   (Equity 3)
│   ├── mlops-lead.md, ml-pipeline-architect.md, gbm-code-reviewer.md   (MLOps 3)
│   └── model-lead.md, gbm-trainer.md, walk-forward-validator.md   (Model 3)
│
├── .docs/evolution/             # service-evolver 학습 이력 (Reflexion memory)
│   ├── memory.md                # Do's/Don'ts 누적
│   ├── backlog.md               # P0/P1/P2/P3 개선 후보
│   └── YYYY-MM-DD_cycle*.md     # 일일 사이클 로그
│
├── .env                         # API 키 (5개)
└── CLAUDE.md                    # Claude Code 설정
```

---

## Part 1: 데이터 수집 - 사용한 프롬프트와 만든 파일

### 프롬프트 1: 종목 리스트 수집
> "Wikipedia의 S&P 500 페이지에서 pandas read_html로 테이블을 가져와"

**파일: `collectors/fetch_sp500_list.py`**
- Wikipedia에서 S&P 500 기업 목록을 긁어옵니다
- Symbol의 `.`을 `-`로 바꿔요 (예: BRK.B → BRK-B)
- 11개 섹터가 다 있는지, 중복은 없는지 검증합니다
- 결과: `sp500_list.csv` (503개 종목)

### 프롬프트 2: 주가 수집기
> "yfinance로 미국 주식 일봉 데이터를 수집하는 클래스를 만들어줘"

**파일: `collectors/us_price_fetcher.py`**
- `USPriceFetcher` 클래스
- `fetch_ohlcv(symbol)`: 한 종목의 시가/고가/저가/종가/거래량을 가져옵니다
- `fetch_batch(symbols)`: 여러 종목을 순서대로 가져옵니다 (1초 쉬면서)
- `curl_cffi`라는 도구로 차단당하지 않게 합니다

### 프롬프트 3: 기술적 지표
> "SMA, RSI, ATR, 볼린저밴드를 계산하는 함수들을 만들어줘"

**파일: `analyzers/technical_indicators.py`**
- `add_moving_averages()`: 이동평균선 (20일, 50일, 200일)
  - 최근 20일/50일/200일간 평균 가격. 주가가 이 선 위에 있으면 "오르는 추세"
- `add_rsi()`: 상대강도지수 (0~100)
  - 70 이상이면 "너무 많이 올랐다", 30 이하면 "너무 많이 떨어졌다"
- `add_atr()`: 평균진폭
  - 주가가 하루에 얼마나 움직이는지 (변동성)
- `add_bollinger_bands()`: 볼린저밴드
  - 주가가 움직일 수 있는 "터널" 같은 것. 터널 밖으로 나가면 이상 신호

### 프롬프트 4: 매크로 경제 지표
> "FRED API와 웹 스크래핑으로 미국 매크로 경제 데이터를 수집해줘"

**파일: `collectors/macro_collector.py`**
- `MacroDataCollector` 클래스
- VIX (공포지수): 투자자들이 얼마나 불안한지 (높을수록 무서워하는 중)
- 연방기금금리: 미국 중앙은행이 정한 기본 이자율
- 10년/2년 국채 금리: 장기 vs 단기 금리 비교
- Fear & Greed Index: CNN에서 만든 탐욕/공포 지수

### 프롬프트 5: 섹터 분석
> "11개 SPDR 섹터 ETF 데이터를 수집하고 분석하는 클래스를 만들어줘"

**파일: `analyzers/sector_analyzer.py`**
- `SectorAnalyzer` 클래스
- 11개 업종(기술, 금융, 에너지 등)이 각각 얼마나 올랐는지/떨어졌는지 비교
- "공격주 vs 방어주" 비교: 위험한 주식이 잘 나가면 시장이 낙관적
- 히트맵으로 시각화: 빨간색 = 떨어짐, 초록색 = 올랐음

### 프롬프트 6: 통합 파이프라인
> "위 모듈을 통합하는 데이터 수집 파이프라인을 만들어줘"

**파일: `pipeline/us_data_pipeline.py` + `pipeline/run_pipeline.py`**
- 버튼 하나로 모든 데이터를 수집합니다
- `python pipeline/run_pipeline.py --top-n 50 --period 1y --output-dir ./data`
- 4개 CSV 파일을 자동 생성

### 프롬프트 7: 품질 검사
> "수집된 CSV 파일들의 품질을 검사하는 리포트를 만들어줘"

**파일: `pipeline/data_quality_report.py`**
- 각 파일에 100점 만점으로 점수를 매깁니다
- 파일 있음(20점), 행 수(20점), 결측치(20점), 데이터타입(20점), 날짜범위(20점)

---

## Part 2: 시장 체제 감지 - 사용한 프롬프트와 만든 파일

### 프롬프트 8~12: 5개 센서
> "VIX 신호, 추세 신호, 시장 폭 신호, 금리 곡선 신호, 신용 스프레드 신호를 만들어줘"

**파일: `analyzers/market_regime.py`**
- `MarketRegimeDetector` 클래스 — 5개 센서로 시장 진단

| 센서 | 뭘 보나요? | 비유 |
|------|-----------|------|
| VIX | 투자자 공포 수준 | 체온계 (높으면 열이 남) |
| Trend | SPY가 이동평균선 위/아래 | 키 재기 (성장 중인지) |
| Breadth | 얼마나 많은 종목이 오르는지 | 반 평균 (소수만 잘하는지 전체가 잘하는지) |
| Yield Curve | 장기 vs 단기 금리 | 미래 예측 (역전되면 불황 경고) |
| Credit | 위험 채권 vs 안전 채권 | 모험심 측정 (위험한 걸 사면 낙관적) |

각 센서가 risk_on(0) / neutral(1) / risk_off(2) / crisis(3) 점수를 매기고,
가중 평균으로 최종 체제를 결정합니다.

### 프롬프트 13: 적응형 파라미터
> "체제에 따라 다른 stop_loss를 적용해줘"

시장 상태에 따라 손절선을 자동 조절합니다:
- risk_on: -10% (여유 있게)
- neutral: -8%
- risk_off: -5% (조심스럽게)
- crisis: -3% (아주 빡빡하게)

### 프롬프트 14~16: 시장 게이트
> "11개 섹터를 분석해서 GO/CAUTION/STOP 신호를 만들어줘"

**파일: `analyzers/market_gate.py`**
- 11개 섹터 ETF마다 RSI, MACD, 거래량, 상대강도를 분석
- 종합 점수 70+ → GO (사도 좋아!), 40~70 → CAUTION (조심!), 40- → STOP (사지 마!)
- 거래량-가격 다이버전스: "가격은 오르는데 거래량이 줄면?" → 위험 신호!

---

## Part 3: Smart Money 스크리닝 + AI 분석

> 마트에서 장보고 요리하는 것에 비유해볼게요!

### 1단계: data_fetcher.py — 장보기 도우미

**비유:** 마트에 가서 물건을 사오는 **"심부름꾼"**을 만든 거야.

`USStockDataFetcher` = 심부름꾼

| 우리가 준 지시 | 왜? |
|---|---|
| yfinance를 메인으로 써 | 단골 마트가 있는 것처럼, 주식 데이터를 가져오는 "메인 가게"를 정한 거야 |
| Finnhub을 fallback으로 | 단골 마트가 문 닫았으면? 편의점이라도 가야지! 예비 가게를 정해둔 거야 |
| curl_cffi 세션 | 마트에서 "너 너무 자주 온다" 하고 막을 수 있어. 그래서 모자 쓰고 변장하는 거야 (브라우저인 척) |
| API 키를 환경변수에서 | 마트 회원카드 번호를 코드에 직접 쓰면 다른 사람이 볼 수 있잖아. 그래서 비밀 서랍(환경변수)에 넣어둔 거야 |
| 실패 시 빈 값 반환 | 심부름꾼이 물건을 못 사왔다고 화내면서 멈추면 안 돼. "못 사왔어요~" 하고 빈 봉투라도 가져오는 게 나아 |

### 2단계: smart_money_screener_v2.py — 요리사 준비

**비유:** 이제 재료(데이터)로 요리(분석)를 할 **"요리사"**를 만든 거야.

`EnhancedSmartMoneyScreener` = 요리사

| 우리가 준 지시 | 왜? |
|---|---|
| output 경로 설정 | 요리사가 완성된 요리를 어디에 놓을지 정한 거야. "접시는 여기에!" |
| USStockDataFetcher 초기화 | 요리사 혼자 장도 보고 요리도 하면 힘들잖아. 심부름꾼(fetcher)을 고용한 거야 |
| volume_df, holdings_df 등 = None | 아직 재료를 안 샀으니까 도마 위가 비어있는 상태. "여기에 고기 올 거야, 여기에 채소 올 거야" 자리만 잡아둔 거지 |
| _info_cache = {} | 같은 재료 정보를 매번 마트에 물어보면 시간 낭비잖아. 한 번 물어본 건 메모해두는 노트야 |

### 3단계: load_data() — 재료 꺼내서 도마 위에 올리기

**비유:** 냉장고(파일)에서 재료를 꺼내 도마(변수) 위에 올리는 과정이야.

| 우리가 준 지시 | 왜? |
|---|---|
| volume 파일은 필수 | 메인 재료(고기)가 없으면 요리 자체를 못 해. "고기 없으면 요리 안 해!" → return False |
| 나머지는 선택 | 양파가 없어도 요리는 할 수 있어. 없으면 "양파 없네~" 하고 넘어가는 거야 (warning만 남김) |
| filing_date 필터링 | 이게 제일 중요해! 내일 시험 답안지를 오늘 미리 보면 그건 컨닝이잖아. 주식도 마찬가지야. 아직 발표 안 된 미래 데이터를 쓰면 "가짜로 잘하는 척"이 돼. 그래서 어제까지 나온 데이터만 쓰는 거야 |
| SPY 데이터 로드 | SPY는 미국 주식시장 전체를 대표하는 거야. "오늘 시장 전체가 좋았어? 나빴어?"를 알아야 개별 주식이 진짜 잘한 건지 판단할 수 있거든 |

### 4단계: 종합 점수 계산 — 요리 시작!

**비유:** 6가지 재료를 섞어서 하나의 요리(점수)를 만드는 과정이야.

| 재료 (팩터) | 비중 | 뭘 보나요? |
|---|---|---|
| Technical (기술적) | 25% | RSI, MACD, 이동평균 — "주가 차트가 예쁜가?" |
| Fundamental (펀더멘털) | 20% | PE, 매출성장, ROE — "회사가 실제로 돈을 잘 버나?" |
| Analyst (애널리스트) | 15% | 목표가, 추천 — "전문가들이 뭐라 하나?" |
| Relative Strength | 15% | SPY 대비 — "시장 평균보다 잘하나?" |
| Volume (거래량) | 15% | 수급 — "사는 사람이 많나?" |
| 13F Holdings | 10% | 기관 보유 — "큰손들이 들고 있나?" |

등급: A(80+점) "적극 매수" → F(20-점) "도망쳐!"

### 5단계: AI 분석 — 미슐랭 셰프의 평가

**비유:** 요리사가 만든 요리를 **미슐랭 셰프(AI)**에게 평가받는 거야.

**파일: `analyzers/ai_summary_generator.py`**

3명의 셰프 중 선택 가능:
- **Gemini** (Google): 기본 셰프. 빠르고 정확해
- **GPT** (OpenAI): 유명한 셰프. 가끔 바빠서 못 올 수 있어 (429 에러)
- **Perplexity**: 검색을 잘하는 셰프. 최신 뉴스에 강해

뉴스도 3곳에서 모아와: Yahoo + Google RSS + Finnhub

### 6단계: 최종 리포트 — 처방전 발행

**파일: `analyzers/final_report_generator.py`**

퀀트 점수(90%) + AI 점수(10%)를 합쳐서 최종 Top 10을 뽑아요.

### 전체 흐름을 한 줄로

```
심부름꾼 → 요리사 → 재료 꺼내기 → 요리(점수 계산) → 셰프 평가(AI) → 처방전(리포트)
```

핵심은 **역할 분리**야. 심부름꾼은 데이터만 가져오고, 요리사는 분석만 해.
레고 블록처럼 하나만 바꿀 수 있어서 편해!

---

## Part 4: 다음 주 시장 예보 (기상청)

> 기상청이 "내일 비 올 확률 70%"라고 예보하듯, **다음 5일 SPY/QQQ가 오를까 내릴까**를 머신러닝으로 예측해요.

**파일: `us_market/index_predictor.py`**

### 비유로 이해하기

**`IndexPredictor` = 기상청**

| 우리가 준 지시 | 왜? |
|---|---|
| 27개 센서 (FEATURE_NAMES) | 온도계, 기압계, 습도계 여러 개 보고 날씨 예보하듯이 — 주가/공포지수/금리/섹터 등 27가지 신호 종합 |
| 역방향 센서 6개 (INVERSE_FEATURES) | "온도 낮으면 추움" 같은 당연한 신호 중에 **반대로 해석**해야 하는 것들. VIX(공포지수)가 오르면 주식은 떨어지니까 역방향! |
| 과거 2년치 데이터로 학습 | 기상청도 과거 날씨 패턴을 보고 예보하듯, 과거 거래일로 "이런 신호일 때 주가가 올랐다/내렸다" 학습 |
| TimeSeriesSplit 5-fold CV | 컨닝 방지! **과거 데이터로 미래 맞히기** 연습을 5번 반복. 시간 순서 지켜야 진짜 실력 테스트 |
| GradientBoosting (분류+회귀) | 여러 결정 나무가 릴레이로 **이전 나무의 실수**를 고치면서 점점 정확해짐. 분류(UP/DOWN) + 회귀(몇 % 오를까) 둘 다 씀 |
| 7일 지나면 자동 재학습 | 날씨가 계절 따라 바뀌듯, 시장도 바뀌니까 오래된 모델은 버리고 다시 학습 |

### 27개 피처 (센서) 구성

| 카테고리 | 개수 | 예시 |
|---|---|---|
| SPY 가격 | 7 | 1주/1개월 수익률, 200/50일선 위/아래, RSI, MACD, 볼린저밴드 |
| VIX (공포지수) | 4 | 현재값, 5일 변화, 1년 백분위, 20 초과 여부 |
| QQQ (나스닥) | 2 | 1주 수익률, RSI |
| 시장폭 (breadth) | 2 | 50일선 위 비율, 상승/하락 종목 비율 (Laplace 보정) |
| 섹터 상대강도 | 3 | XLK/XLU/XLY (기술/유틸리티/경기소비재) vs SPY |
| 매크로 경제 | 3 | 국채 스프레드(TNX-FVX), 금값, 달러지수 |
| 거래량 | 3 | SPY/QQQ 거래량 vs 20일 평균 |
| 모멘텀 | 3 | 10일 변화율, 50일선과의 거리 %, RSI 기울기 |

### 예측 결과는 이렇게 나와요

```json
{
  "date": "2026-04-05",
  "predictions": {
    "spy": {
      "direction": "bearish",
      "probability_up": 0.085,
      "predicted_return": -3.13,
      "confidence": "high (91.5%)",
      "key_drivers": [
        { "feature": "yield_spread_proxy", "value": 0.365, "direction": "bullish" },
        { "feature": "spy_price_vs_50ma_pct", "value": -3.049, "direction": "bearish" },
        { "feature": "spy_vol_trend_5d", "value": 0.030, "direction": "bullish" }
      ]
    }
  }
}
```

**읽는 법:**
- `direction: "bearish"` → 5일 뒤 SPY는 **떨어질 것** 같음
- `probability_up: 0.085` → 오를 확률 8.5% (낮음)
- `predicted_return: -3.13` → 약 -3.13% 예상
- `confidence: "high (91.5%)"` → 예보 신뢰도 높음
- `key_drivers` → **이 예보에 가장 영향을 준 신호 3가지**

### 신뢰도 등급

| 등급 | 확률 | 비유 |
|---|---|---|
| high | 70% 이상 | "우산 꼭 챙기세요" |
| moderate | 60~70% | "우산 챙기는 게 안전" |
| low | 60% 미만 | "글쎄요, 반반" |

### Reflexion 히스토리 (과거 예보 누적)

**파일: `output/prediction_history.json`** (최대 100개)

매일 예보가 쌓여서 **"지난주 예보가 맞았나?"** 돌이켜볼 수 있어요.
```json
[
  { "date": "2026-04-04", "spy": {...}, "qqq": {...}, "model_accuracy": 53.2 },
  { "date": "2026-04-05", "spy": {...}, "qqq": {...}, "model_accuracy": 53.2 }
]
```

### 실행 방법

```bash
# 전체 자동 실행 (데이터 수집 → 학습 → 예측 → 저장)
python us_market/index_predictor.py

# 테스트 (8개 단위 테스트)
pytest tests/test_index_predictor.py -v
```

### 생성되는 파일

| 파일 | 내용 |
|------|------|
| `output/index_prediction.json` | SPY/QQQ 최신 예측 + key drivers |
| `output/predictor_model_spy.joblib` | SPY 학습 모델 (classifier+regressor+scaler) |
| `output/predictor_model_qqq.joblib` | QQQ 학습 모델 |
| `output/prediction_history.json` | 과거 예보 최대 100개 누적 |

---

## Part 5: Cross-Sectional GBM (50+종목 랭킹 ML)

> Part 4가 "지수 전체 방향"을 맞히는 거라면, Part 5는 **50+종목 중 누가 먼저 오를지 순위**를 맞히는 거예요.

**파일: `ml/pipeline/train.py`, `ml/pipeline/predict.py`, `ml/validation/walk_forward.py`**

### 왜 이걸 만들었어?

Part 4의 `IndexPredictor`는 SPY/QQQ **한두 개**만 봐요. Part 5는 **여러 종목 중 순위**를 매겨요.
"오늘 50개 종목 중에 앞으로 20일간 누가 1등/2등/3등 할까?" (cross-sectional ranking)

### 비유로 이해하기

**반 학생 50명 성적 예측**

| 우리가 준 지시 | 왜? |
|---|---|
| 36개 피처 × 50종목 × 251일 (12,550 샘플) | 반 학생 50명의 "지난 1년 과제 점수 36개"로 예측 |
| 거시 피처 18개 (ERP/VIX/금리/체제) | 반 전체 분위기 — 시험 쉬울까 어려울까 |
| 종목 피처 36개 (모멘텀/RSI/변동성/거래량) | 학생 개개인 실력 — 최근 과제 점수 |
| 타겟: fwd_20d_rank (0~1 percentile) | 20일 뒤 반 등수 상위인지 하위인지 |
| LightGBM + early stopping | 과외선생님 여러 명이 번갈아 실력 가다듬기 |
| walk-forward + embargo 20일 | 컨닝 방지: 미래 정보 미리 안 보기 |
| PBO (Backtest Overfitting 확률) | "이 모델이 진짜 실력인가 운인가?" 점검 |

### 피처 구성 (총 54 피처)

| 카테고리 | 개수 | 파일 |
|---|---|---|
| 거시 (Macro) | 18 | `ml/features/macro/build_macro_features.py` |
| 종목 기술 (Momentum/RSI/Volatility/Volume) | 25 | `ml/features/equity/build_equity_features.py` |
| 종목 트렌드 (MA spread, 52w ratio) | 8 | 위와 동일 |
| Cross-sectional rank (섹션 내 순위) | 3+ | 위와 동일 |

### 검증 결과 (첫 실행, 2026-04-05)

```
Train Rank IC: +0.5112 (IR 3.37) — overfit 경고
Test  Rank IC: +0.0689 (IR 0.38) — OOS 기준 통과 (>0.05)

Walk-Forward (5 folds, 8 HP variants):
  Rank IC mean: +0.0610 ✅
  PBO:          0.900 ❌ (overfit 위험, 503종목/3년 데이터 필요)
  VERDICT:      FAIL (승격 불가, MVP 수준)
```

**읽는 법**: 검증 gate는 **의도적으로 엄격**. FAIL 판정은 모델이 아직 덜 준비됐다는 뜻. 50 종목 × 1년 데이터는 MVP일 뿐, production은 503종목 × 3년 필요.

### 실행 방법

```bash
# 1. 피처 생성 (macro + equity)
python -m ml.features.macro.build_macro_features
python -m ml.features.equity.build_equity_features

# 2. LightGBM 학습 (5분 이내)
python -m ml.pipeline.train

# 3. Walk-forward 검증 (5 fold + PBO/DSR)
python -m ml.validation.walk_forward

# 4. 추론 (Top 20 종목)
python -m ml.pipeline.predict
```

### 생성되는 파일

| 파일 | 내용 |
|------|------|
| `ml/features/macro/*.parquet` | 거시 피처 시계열 |
| `ml/features/equity/*.parquet` | 종목 피처 + forward return 타겟 |
| `ml/models/lgbm_fwd_20d_rank_*.pkl` | 학습된 LightGBM 모델 |
| `ml/models/*.json` | 학습 메타데이터 (seed, feature list, best iteration) |
| `ml/validation/walk_forward_*.json` | fold별 IC + PBO + DSR 결과 |
| `output/gbm_predictions.{parquet,csv}` | Top 20 cross-sectional 예측 |

---

## Part 6: Agent 생태계 + Service Evolver (자가 진화)

> 이 시스템은 스스로 개선돼요. **매일 1건씩 작은 진화**를 누적하는 **22 에이전트 생태계**가 움직입니다.

**파일: `.claude/agents/*.md`, `.docs/evolution/*`**

### 비유로 이해하기

**22명의 전문가가 한 병원에서 환자 돌보는 구조**

| 계층 | 구성 | 역할 |
|---|---|---|
| 총괄 (1) | `perf-lead` | 21 에이전트 오케스트레이터 (2-tier) |
| 메타 진화 (1) | `service-evolver` | **매일 서비스 전체 1건 개선** (자가 진화) |
| Tier 1 성능 팀 (5) | signal-optimizer, backtest-engineer, critic-reviewer, market-researcher, perf-verifier | rule 성능 사이클 |
| Tier 2 GBM 팀 (15) | 5팀 × (lead 1 + specialist 2) | ML 파이프라인 |

### Tier 2: GBM 5팀 구성

| 팀 | Lead (opus) | Specialist 1 (sonnet) | Specialist 2 (sonnet) |
|----|-------------|----------------------|----------------------|
| **Research** | research-lead | paper-researcher | factor-discoverer |
| **Macro** | macro-lead | macro-feature-engineer | regime-ml-classifier |
| **Equity** | equity-lead | equity-factor-builder | equity-flow-analyst |
| **MLOps** | mlops-lead | ml-pipeline-architect | gbm-code-reviewer |
| **Model** | model-lead | gbm-trainer | walk-forward-validator |

### service-evolver 7-Phase 일일 사이클

```
Phase 1 (10분) 현황 파악    — README/architecture/memory.md 읽고 상태 파악
Phase 2 (15분) 트렌드 리서치  — WebSearch로 24시간 내 퀀트/논문 스캔
Phase 3 (10분) Gap Analysis — 현재 시스템 vs 트렌드 갭 매트릭스
Phase 4 (5분)  개선 선정     — Impact/Effort/Risk로 오늘 1건 선정
Phase 5 (30~60분) 코드 수정  — 실제 Edit/Write로 구현
Phase 6 (10분) 검증          — syntax + import + unit 3-layer
Phase 7 (5분)  문서 갱신     — memory.md + backlog.md + README.md
```

### 실제 진화 이력 (Evolution Cycles)

| # | 날짜 | 변경 | 근거 | 결과 |
|---|------|------|------|------|
| 1 | 2026-04-05 | **ERP 센서 추가** (`macro_collector.py`) | [Morningstar 2025](https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns) | ERP 1.87% → "과열 (주식 고평가)" 신호 |
| 2 | 2026-04-05 | **IndexPredictor를 run_full_pipeline.py Step 8에 통합** | backlog P0 | SPY/QQQ BEARISH 92%/86% 신호 |

### 호출 방법

```
# Claude Code 세션에서 (새 세션 권장)
@service-evolver 오늘의 evolution cycle 실행해줘

# 또는 성능 사이클
@perf-lead 전일 Top 10 backtest 후 signal-optimizer 위임해줘
```

### Reflexion Memory 시스템

`.docs/evolution/memory.md`에 **모든 성공/실패가 누적 학습**됨:
- **Do's**: 반복할 성공 패턴 (예: "이미 구현된 모듈 재활용이 최고 ROI")
- **Don'ts**: 반복 금지 실수 (예: "format code 추측 금지, 실제 타입 확인")
- **Open Questions**: 추가 리서치 필요 항목

다음 사이클에서 이 메모리를 참조해 동일 실수를 반복하지 않습니다.

---

## 실행 방법

```bash
# 가상환경 활성화
source .venv/bin/activate

# 전체 파이프라인 (8단계 자동 실행)
python run_full_pipeline.py

# 개별 실행 (Part 1~3)
python pipeline/run_pipeline.py --top-n 50 --period 1y   # Part 1: 데이터 수집
python -m analyzers.market_regime                         # Part 2: 시장 체제
python -m analyzers.market_gate                           # Part 2: 매수 신호등
python -m collectors.macro_collector                      # 매크로 (ERP 포함)
python run_screening.py                                   # Part 3: S&P 500 스크리닝

# AI 분석
python analyzers/ai_summary_generator.py --provider gemini --top 10
python analyzers/ai_summary_generator.py --provider perplexity --ticker AAPL
python analyzers/final_report_generator.py

# Part 4: ML 지수 예측 (SPY/QQQ 5일 방향)
python us_market/index_predictor.py

# Part 5: Cross-sectional GBM (신규)
python -m ml.features.macro.build_macro_features       # 18 거시 피처
python -m ml.features.equity.build_equity_features     # 36 종목 피처 + 5 타겟
python -m ml.pipeline.train                            # LightGBM 학습
python -m ml.validation.walk_forward                   # PBO/DSR 검증
python -m ml.pipeline.predict                          # Top 20 예측
```

---

## 출력 파일 설명

| 파일 | 내용 | 쉬운 설명 |
|------|------|-----------|
| data/sp500_list.csv | 503개 종목 목록 | "미국 대표 기업 명단" |
| data/us_daily_prices.csv | 주가 + 기술적 지표 | "매일의 가격표 + 건강 수치" |
| data/us_macro.csv | VIX, 금리, 공포지수 | "경제 전체의 건강검진 결과" |
| data/us_sectors.csv | 11개 업종 수익률 | "업종별 성적표" |
| output/regime_result.json | 시장 체제 상세 분석 | "종합 진단서" |
| output/regime_config.json | 적응형 투자 파라미터 | "처방전 (손절선 등)" |
| output/ai_summaries.json | AI 종목 분석 | "미슐랭 셰프의 평가" |
| output/final_top10_report.json | 최종 Top 10 | "최종 추천 명단" |
| output/index_prediction.json | SPY/QQQ 5일 방향 예측 | "다음 주 일기예보" |
| output/predictor_model_spy.joblib | SPY 학습 모델 | "학습된 기상청 SPY 예보관" |
| output/predictor_model_qqq.joblib | QQQ 학습 모델 | "학습된 기상청 QQQ 예보관" |
| output/prediction_history.json | 과거 예보 100개 누적 | "예보 맞힘 기록장" |
| result/smart_money_picks_YYYYMMDD.csv | 날짜별 스크리닝 결과 | "매일의 전체 성적표" |
| **output/gbm_predictions.{parquet,csv}** | **Cross-sectional Top 20 (Part 5)** | "**50+ 학생 중 상위 20명 랭킹**" |
| **ml/features/macro/*.parquet** | **18 거시 피처 (ERP/VIX/yield)** | "반 전체 분위기 체크표" |
| **ml/features/equity/*.parquet** | **36 종목 피처 + 5 타겟** | "학생 개개인 과제 점수" |
| **ml/models/lgbm_*.pkl + .json** | **학습된 LightGBM + metadata** | "훈련된 과외 선생님" |
| **ml/validation/walk_forward_*.json** | **PBO/DSR + fold별 IC** | "모의고사 채점표" |
| **.docs/evolution/memory.md** | **service-evolver Reflexion 메모리** | "어제 배운 교훈 노트" |
| **.docs/evolution/backlog.md** | **P0/P1/P2/P3 개선 후보** | "해야 할 일 목록" |

---

## API 키 설정

`.env` 파일에 넣어두세요 (`.env.example` 참고):

| API | 용도 | 필수? |
|-----|------|-------|
| FRED_API_KEY | 미국 경제 지표 (금리 등) | 예 |
| GOOGLE_API_KEY | Gemini AI 분석 | AI 사용 시 |
| OPENAI_API_KEY | GPT AI 분석 | 선택 |
| PERPLEXITY_API_KEY | Perplexity AI 분석 | 선택 |
| FINNHUB_API_KEY | 뉴스 + 주가 백업 | 선택 |

---

## 사용 기술

| 기술 | 용도 |
|------|------|
| Python 3.13 | 프로그래밍 언어 |
| yfinance | 주가 데이터 수집 |
| pandas / numpy | 데이터 분석 |
| FRED API | 미국 경제 지표 (TIPS DFII10 포함) |
| curl_cffi | 차단 방지 (브라우저 흉내) |
| matplotlib / seaborn | 시각화 (히트맵) |
| Gemini API | AI 종목 분석 (기본) |
| OpenAI API | AI 종목 분석 (대안) |
| Perplexity API | AI 종목 분석 (검색 강화) |
| beautifulsoup4 | 웹 스크래핑 |
| python-dotenv | 환경변수 관리 |
| **LightGBM 4.6+** | **GBM 학습 (Part 5)** |
| **pyarrow** | **parquet 피처 저장** |
| **scipy** | **PBO/DSR 검증 지표** |
| **scikit-learn** | **IndexPredictor (Part 4)** |

---

## API 비용 추적

AI 분석할 때마다 얼마나 돈이 드는지 자동으로 계산해줘요.
`APIUsageTracker`라는 도구가 모든 API 호출의 토큰 수와 예상 비용을 추적합니다.

**비유:** 마트에서 장 볼 때 영수증을 자동으로 찍어주는 거야!

| AI 셰프 | 입력 비용 | 출력 비용 |
|---------|----------|----------|
| Gemini Flash | $0.10 / 100만 토큰 | $0.40 / 100만 토큰 |
| GPT-5-mini | $0.15 / 100만 토큰 | $0.60 / 100만 토큰 |
| Perplexity Sonar | $3 / 1000 요청 | — |

`run_full_pipeline.py` 실행하면 마지막에 비용 요약이 나와요:
```
──────────────────────────────────────────────────
  💰 API 비용 요약
──────────────────────────────────────────────────
  Gemini Flash:
    요청 수: 10
    입력 토큰: 15,000
    출력 토큰: 8,000
    예상 비용: $0.0047
──────────────────────────────────────────────────
```

---

## 대시보드 (웹사이트)

분석 결과를 예쁜 웹사이트로 볼 수 있어요!

```bash
cd dashboard
python3 -m http.server 8889
# 브라우저에서 http://localhost:8889 접속
```

**대시보드 구성:**
- **Market Regime** — 현재 시장 체제 + 적응형 파라미터 (stop_loss, MDD)
- **Regime Signals** — 5개 센서 상태를 컬러로 표시
- **Market Gate** — GO/CAUTION/STOP 신호등
- **Smart Money Top 10** — 종목별 점수, 등급, 프로그레스 바
- **AI Analysis Modal** — 종목 클릭 시 상세 분석 (Thesis, Catalysts, Bear Cases)
- **Index Forecast** — SPY/QQQ 5일 방향 예측 (probability gauge + key drivers + history sparkline)

디자인: 다크 모드 + 네온 액센트 + 글래스모피즘
