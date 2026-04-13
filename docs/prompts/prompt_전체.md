# US Stock 프로젝트 — Claude Code 최적화 프롬프트 v2

## 개요

원본 `prompt_v1.md`(431줄, ~48개 비구조화 프롬프트)를 Claude Code Plan 모드에 최적화하여 재구성한 버전.

### v1 대비 주요 변경
1. **48개 → 27개 프롬프트로 통합** — 관련 작업을 단일 책임 단위로 결합 (센서 5개 → 1개, AI 생성기 3개 → 1개 등)
2. **구조화** — 모든 프롬프트에 `# 목표` / `# 컨텍스트` / `# 작업` 섹션 추가, Plan 모드 Step 분해 가능
3. **보안** — API 키 평문 노출 제거 (`<YOUR_KEY>` 플레이스홀더), 네이버 금융 연습(Phase 0) 제거
4. **경로 수정** — `us_market/` → `analyzers/`, `collectors/` 등 실제 프로젝트 구조 반영
5. **4파트 교육 체계** — Summary.md 프레젠테이션 구조에 맞춰 Part 3(스크리닝)과 Part 4(AI 분석) 분리
6. **교육 포인트** — 프레젠테이션에서 강조된 학습 목표를 각 프롬프트에 포함

### 프로젝트 구조
```
us-stock/
├── collectors/          # Part 1: 데이터 수집
├── analyzers/           # Part 2~4: 분석 엔진
├── pipeline/            # Part 1: 파이프라인 통합
├── tests/               # 테스트
├── dashboard/           # 웹 대시보드
├── data/                # CSV 출력
├── output/              # JSON 출력
├── result/              # 날짜별 스크리닝 결과
├── run_integrated_analysis.py # Phase 0/1/2/3 통합 분석 (Verdict + Action)
├── run_daily_scheduler.py    # 일일 스케줄러 (--install-cron)
├── run_full_pipeline.py      # 9단계 전체 실행 (AI + GBM 포함)
├── run_screening.py          # S&P 500 스크리닝
├── run_all.py                # 레거시 실행
├── reports/                  # daily_report_YYYYMMDD.json + latest_report.json
└── logs/                     # daily_run_YYYYMMDD.log
```

---

## Part 1: 데이터 수집

### 1. S&P 500 종목 리스트 수집 + 검증

**목적:** Wikipedia에서 S&P 500 종목 목록을 수집하고 데이터 무결성을 검증한다.
**변경 사항:** v1 프롬프트 2개(수집 + 검증) 통합, 경로를 `collectors/`로 수정
**교육 포인트:** pandas read_html로 웹 테이블 파싱, Symbol 정규화(BRK.B → BRK-B), 11개 GICS 섹터 구조

```
# 목표
S&P 500 종목 리스트를 Wikipedia에서 수집하고 검증 함수를 포함하는 스크립트를 작성한다.

# 컨텍스트
- 프로젝트: us-stock (S&P 500 분석 시스템)
- 선행 조건: pandas, beautifulsoup4 설치
- 출력: data/sp500_list.csv (Symbol, Security, GICS Sector, GICS Sub-Industry)

# 작업
1. Wikipedia "List of S&P 500 companies" 페이지에서 pandas.read_html로 테이블 수집
2. Symbol의 '.'을 '-'로 변환 (yfinance 호환: BRK.B → BRK-B)
3. data/sp500_list.csv로 저장
4. 섹터별 종목 수 출력
5. validate_sp500_list() 함수 추가:
   - 총 종목 수 ≥ 500
   - 11개 GICS 섹터 존재
   - Symbol에 '.' 미포함
   - 중복 Symbol 없음
   - 검증 결과 PASS/FAIL 출력

파일명: collectors/fetch_sp500_list.py
```

### 2. 주가 수집기

**목적:** yfinance로 미국 주식 일봉 데이터를 수집하는 클래스를 구현한다.
**변경 사항:** 폴더명 수정 (`collectors/`), 세부 요구사항 유지
**교육 포인트:** curl_cffi Session(impersonate="chrome")으로 차단 방지, 에러 시 빈 DataFrame 반환 패턴

```
# 목표
yfinance 기반 USPriceFetcher 클래스를 구현한다.

# 컨텍스트
- 선행 조건: yfinance, curl_cffi 설치
- 출력: 클래스 (직접 파일 출력 없음, 파이프라인에서 사용)

# 작업
1. USPriceFetcher 클래스 생성
2. __init__: yfinance import, curl_cffi Session(impersonate="chrome") 사용 (없으면 fallback)
3. fetch_ohlcv(symbol, period="1y"): 1년치 OHLCV DataFrame 반환
4. fetch_batch(symbols, period="1y"): 여러 종목 순차 수집, 종목 간 1초 sleep
5. 에러 시 빈 DataFrame 반환 + logging (print 금지)

파일명: collectors/us_price_fetcher.py
```

### 3. 주가 수집 테스트

**목적:** USPriceFetcher의 동작을 검증한다.
**변경 사항:** 없음 (v1과 동일)
**교육 포인트:** 정상 케이스 + 예외 케이스(존재하지 않는 티커) 모두 테스트

```
# 목표
USPriceFetcher를 4가지 케이스로 테스트한다.

# 컨텍스트
- 선행 조건: collectors/us_price_fetcher.py 완성
- 출력: 콘솔 PASS/FAIL 출력

# 작업
1. AAPL 1년치 데이터 → 200행 이상 확인
2. OHLCV 5개 컬럼 존재 확인
3. 존재하지 않는 티커 'ZZZZZ' → 빈 DataFrame 반환 확인
4. ['AAPL', 'MSFT', 'GOOGL'] 배치 수집 → 3개 모두 데이터 확인

파일명: tests/test_price_fetcher.py
```

### 4. 기술적 지표 함수

**목적:** OHLCV DataFrame에 기술적 지표를 추가하는 순수 함수들을 구현한다.
**변경 사항:** 없음 (v1과 동일)
**교육 포인트:** 원본 DataFrame 불변성(copy 반환), Wilder's Smoothing RSI, 볼린저밴드 터널 개념

```
# 목표
SMA, RSI, ATR, 볼린저밴드 계산 함수를 구현한다.

# 컨텍스트
- 선행 조건: pandas, numpy
- 출력: 클래스 없는 순수 함수 모듈

# 작업
1. add_moving_averages(df): SMA_20, SMA_50, SMA_200 추가
2. add_rsi(df, period=14): RSI 추가 (Wilder's Smoothing: ewm(alpha=1/period))
3. add_atr(df, period=14): ATR 추가
4. add_bollinger_bands(df, period=20, std_dev=2): BB_Upper/Middle/Lower/Width 추가
5. add_all_indicators(df): 위 4개 일괄 적용
6. 모든 함수는 df.copy() 반환 (원본 수정 금지)

파일명: analyzers/technical_indicators.py
```

### 5. 기술적 지표 테스트

**목적:** 기술적 지표 함수의 정확성을 검증한다.
**변경 사항:** 없음
**교육 포인트:** NaN 행 수 검증(SMA_200 처음 199행), 범위 검증(RSI 0~100), 불변성 검증(id 비교)

```
# 목표
AAPL 실제 데이터로 기술적 지표 함수 5가지를 검증한다.

# 컨텍스트
- 선행 조건: collectors/us_price_fetcher.py, analyzers/technical_indicators.py
- 출력: 콘솔 PASS/FAIL 출력

# 작업
1. AAPL 1년치 데이터에 add_all_indicators() 적용
2. SMA_200 처음 199행 = NaN 확인
3. RSI 값 0~100 범위 확인
4. ATR 값 모두 양수 확인
5. BB_Upper > BB_Middle > BB_Lower 확인
6. 원본 DataFrame 미변경 확인 (id 비교)

파일명: tests/test_indicators.py
```

### 6. 매크로 경제 데이터 + 환경변수

**목적:** FRED API, VIX, Fear & Greed 등 매크로 경제 데이터를 수집하고 시장 국면을 분류한다.
**변경 사항:** v1 3개 프롬프트(매크로 수집 + .env 설정 + 국면 분류) 통합, API 키 제거
**교육 포인트:** FRED API 시계열 수집, VIX 기반 시장 국면 4단계(risk_on/neutral/risk_off/crisis), .env 환경변수 관리

```
# 목표
매크로 경제 데이터 수집기를 구현하고 .env 환경변수를 설정한다.

# 컨텍스트
- 선행 조건: python-dotenv, yfinance
- 환경변수: FRED_API_KEY=<YOUR_KEY> (.env 파일)
- 출력: data/us_macro.csv

# 작업
1. MacroDataCollector 클래스 생성
2. __init__: python-dotenv로 .env에서 FRED_API_KEY 로드 (없으면 경고, 중단 안 함)
3. fetch_fred_series(series_id, start_date): FRED API 시계열 수집
4. fetch_interest_rates(): 연방기금금리(FEDFUNDS), 10년물(DGS10), 2년물(DGS2)
5. fetch_vix(): yfinance로 ^VIX 수집
6. fetch_fear_greed(): CNN Fear & Greed API 현재 값
7. classify_regime(vix_value): VIX 기준 국면 분류
   - 0~16: risk_on / 16~22: neutral / 22~30: risk_off / 30+: crisis
8. get_macro_summary(): 모든 지표 + regime을 dict 반환
9. .env.example 파일 생성 (FRED_API_KEY=<YOUR_KEY>)

파일명: collectors/macro_collector.py + .env.example
```

### 7. 섹터 분석 + 히트맵

**목적:** 11개 SPDR 섹터 ETF 데이터를 수집하고 섹터 회전 신호를 분석한다.
**변경 사항:** v1 2개 프롬프트(분석 + 히트맵) 통합
**교육 포인트:** 11개 GICS 섹터 ETF 매핑, 공격주 vs 방어주 비교로 시장 심리 판단

```
# 목표
11개 섹터 ETF 분석기를 구현한다.

# 컨텍스트
- 선행 조건: yfinance
- 출력: data/us_sectors.csv, sector_heatmap.csv

# 작업
1. SectorAnalyzer 클래스 생성
2. SECTOR_ETFS: 11개 ETF 매핑 (XLK, XLF, XLE, XLV, XLY, XLP, XLI, XLB, XLRE, XLU, XLC)
3. fetch_all_sectors(period="1y"): 11개 ETF 1년치 종가 수집
4. calculate_returns(): 1일/5일/20일/60일 수익률 계산
5. get_sector_ranking(): 20일 수익률 기준 순위
6. get_rotation_signal(): 방어주(XLU, XLP, XLV) vs 공격주(XLK, XLY, XLC) 상대강도
7. get_heatmap_data(): 11x4 수익률 매트릭스 (퍼센트 표시)
8. to_heatmap_csv(): sector_heatmap.csv 저장
9. 가장 강한/약한 섹터 출력

파일명: analyzers/sector_analyzer.py
```

### 8. 데이터 파이프라인 + CLI + 품질검사

**목적:** Part 1 모듈을 통합하는 오케스트레이터, CLI 실행기, 품질 검사를 구현한다.
**변경 사항:** v1 3개 프롬프트(파이프라인 + CLI + 품질) 통합 (모두 pipeline/ 디렉토리)
**교육 포인트:** MultiIndex CSV(Symbol+Date), argparse CLI 패턴, 데이터 품질 100점 채점

```
# 목표
Part 1 통합 파이프라인, CLI 실행기, 품질 검사 스크립트를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 1~7의 모든 모듈
- 출력: data/sp500_list.csv, us_daily_prices.csv, us_macro.csv, us_sectors.csv

# 작업
Step 1: pipeline/us_data_pipeline.py
1. USDataPipeline 클래스, __init__에서 모든 Part 1 모듈 초기화
2. run_full_collection(): S&P 500 리스트 → OHLCV(상위 50개) → 지표 추가 → 매크로 → 섹터
3. validate_data(df): 결측치/이상치(종가≤0) 체크
4. 저장: us_daily_prices.csv (Symbol+Date MultiIndex, float 소수점 4자리)

Step 2: pipeline/run_pipeline.py
1. argparse: --top-n(기본50), --period(기본1y), --output-dir(기본./data)
2. 시작/종료 시각, 소요 시간 출력

Step 3: pipeline/data_quality_report.py
1. 각 CSV에 100점 채점: 파일 존재(20) + 행 수(20) + 결측치(20) + 데이터타입(20) + 날짜범위(20)
```

---

## Part 2: 시장 체제 감지

### 9. MarketRegimeDetector 기본 구조

**목적:** 시장 체제 감지기의 클래스 구조와 데이터 수집 메서드를 구현한다.
**변경 사항:** `us_market/` → `analyzers/` 경로 수정
**교육 포인트:** yfinance.download()의 progress=False 설정, 실패 시 None 반환 패턴

```
# 목표
MarketRegimeDetector 클래스의 기본 구조와 _fetch_series 범용 수집 메서드를 구현한다.

# 컨텍스트
- 프로젝트 폴더: analyzers/
- 선행 조건: yfinance, pandas, numpy
- 출력: output/regime_result.json, output/regime_config.json

# 작업
1. MarketRegimeDetector 클래스 생성
2. VIX_BOUNDARIES 클래스 변수: {'risk_on': (0, 16), 'neutral': (16, 22), 'risk_off': (22, 30), 'crisis': (30, 999)}
3. _fetch_series(ticker, period='6mo'): yfinance.download → Close 시계열 반환, 실패 시 None
4. logging 모듈 사용, output 폴더 경로 설정

파일명: analyzers/market_regime.py
```

### 10. 5개 센서 구현

**목적:** 시장 진단을 위한 5개 센서(VIX, Trend, Breadth, Yield Curve, Credit Spread)를 구현한다.
**변경 사항:** v1 5개 개별 프롬프트를 1개로 통합
**교육 포인트:** VIX=체온계, Trend=키재기, Breadth=반평균, Yield Curve=미래예측, Credit=모험심 측정

```
# 목표
MarketRegimeDetector에 5개 센서 메서드를 추가한다.

# 컨텍스트
- 선행 조건: 프롬프트 9 완성
- 각 센서는 risk_on/neutral/risk_off/crisis 중 하나를 반환

# 작업
1. _vix_signal(vix_series):
   - 현재 VIX, 20일 MA, 추세(falling/rising), 체제 분류
   - VIX_BOUNDARIES로 분류: 0~16 risk_on, 16~22 neutral, 22~30 risk_off, 30+ crisis

2. _trend_signal(spy_series):
   - 현재가, SMA50, SMA200, slope(200일선 기울기)
   - 가격 > SMA50 AND > SMA200 AND slope > 0 → risk_on
   - 가격 > SMA200 → neutral / 가격 < SMA200 AND slope < 0 → risk_off
   - 데이터 < 200일 → neutral + data_insufficient=True

3. _breadth_signal():
   - RSP/SPY 상대강도 (3개월)
   - 70%+ → risk_on / 50~70% → neutral / 30~50% → risk_off / <30% → crisis

4. _yield_curve_signal():
   - ^TNX(10년) - ^IRX(13주) 스프레드
   - > 0.5 → risk_on / 0~0.5 → neutral / < 0 → risk_off (역전)

5. _credit_spread_signal():
   - HYG/IEF 비율의 20일 MA 대비 현재 비율
   - > MA*1.01 → risk_on / MA*0.99~1.01 → neutral / MA*0.97~0.99 → risk_off / < MA*0.97 → crisis

모든 센서: 데이터 실패 시 neutral 반환, logger.debug로 에러 기록
```

### 11. 체제 판정 + 적응형 파라미터

**목적:** 5개 센서를 가중 합산하여 최종 체제를 결정하고 적응형 파라미터를 저장한다.
**변경 사항:** v1 2개 프롬프트(detect_regime + config 저장) 통합
**교육 포인트:** 가중 투표 시스템, 체제별 손절선 자동 조절, JSON 설정 파일 패턴

```
# 목표
detect_regime 메서드와 적응형 파라미터 저장을 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 10 완성 (5개 센서)
- 출력: output/regime_result.json, output/regime_config.json

# 작업
1. detect_regime() 메서드:
   - ^VIX 3개월, SPY 1년 데이터 수집
   - 5개 센서 호출 (실패 시 neutral 기본값)
   - 점수 매핑: risk_on=0, neutral=1, risk_off=2, crisis=3
   - 가중치: VIX 0.30, Trend 0.25, Breadth 0.18, Credit 0.15, Yield 0.12
   - 최종 체제: <0.75 risk_on / 0.75~1.5 neutral / 1.5~2.25 risk_off / ≥2.25 crisis
   - Confidence: 다수결 일치 비율 (%)

2. 적응형 파라미터 저장 (output/regime_config.json):
   - risk_on: stop_loss -10%, max_drawdown -12%
   - neutral: stop_loss -8%, max_drawdown -10%
   - risk_off: stop_loss -5%, max_drawdown -7%
   - crisis: stop_loss -3%, max_drawdown -5%

3. if __name__ == '__main__' 블록: python -m analyzers.market_regime 실행 가능
```

### 12. 시장 게이트 유틸리티 + 데이터 구조

**목적:** 시장 게이트 판정을 위한 유틸리티 함수와 데이터 구조를 구현한다.
**변경 사항:** v1 2개 프롬프트(유틸리티 + 데이터클래스) 통합
**교육 포인트:** Wilder's RSI 독립 구현, MACD 크로스오버 감지, dataclass 활용

```
# 목표
market_gate.py에 헬퍼 함수와 결과 데이터 구조를 구현한다.

# 컨텍스트
- 프로젝트 폴더: analyzers/
- 선행 조건: pandas, numpy, yfinance, dataclasses
- 출력: 모듈 (다음 프롬프트에서 사용)

# 작업
1. calculate_rsi(series, period=14): Wilder's Smoothing, NaN → 50.0
2. calculate_macd_signal(series):
   - EMA12, EMA26 → MACD라인, EMA9 → 시그널
   - 크로스오버: BULLISH/BEARISH/NEUTRAL
3. calculate_volume_ratio(volume, period=20): 현재 거래량 / 20일 평균
4. dataclass SectorResult: name, ticker, score, signal, price, change_1d, rsi, rs_vs_spy
5. dataclass USMarketGateResult: gate(GO/CAUTION/STOP), score, reasons, sectors, metrics
6. SECTORS dict: 11개 섹터 ETF 매핑

파일명: analyzers/market_gate.py
```

### 13. 섹터 스코어링 + 다이버전스

**목적:** 11개 섹터 종합 점수로 게이트를 판정하고, 거래량-가격 다이버전스를 감지한다.
**변경 사항:** v1 2개 프롬프트(스코어링 + 다이버전스) 통합
**교육 포인트:** GO(70+)/CAUTION(40~70)/STOP(<40) 신호등 개념, 거래량 감소 + 가격 상승 = 위험 신호

```
# 목표
섹터 게이트 판정과 거래량-가격 다이버전스 감지를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 12 완성
- 출력: 콘솔 출력 (GO/CAUTION/STOP + 다이버전스)

# 작업
1. 각 섹터 ETF: RSI, MACD, 거래량비율, SPY 대비 상대강도 계산 → 종합 점수
2. 전체 섹터 평균 점수로 게이트 판정: 70+ GO / 40~70 CAUTION / <40 STOP

3. detect_volume_price_divergence(close, volume, lookback=10):
   - bearish_div: 가격↑ + 거래량 12%↓
   - bullish_div: 가격↓ + 거래량 12%↓
   - bearish_climax: 거래량 2x 평균 + 가격↑ (블로오프 탑)
   - bullish_climax: 거래량 2x 평균 + 가격↓ (항복 매도)
   - 가격↓ + 거래량 15%↑ → bearish_div (적극적 매도)
   - Climax 감지 우선, 그 다음 일반 다이버전스

4. if __name__ == '__main__' 블록 추가
```

---

## Part 3: 스마트 머니 스크리닝

### 14. 데이터 수집기

**목적:** yfinance 주요, Finnhub 대체 소스를 사용하는 통합 데이터 수집기를 구현한다.
**변경 사항:** `us_market/` → `collectors/` 경로 수정, 가독성 개선
**교육 포인트:** Fallback 전략(yfinance → Finnhub → AV → FMP), curl_cffi 차단 방지, API 키 환경변수

```
# 목표
USStockDataFetcher 통합 데이터 수집 클래스를 구현한다.

# 컨텍스트
- 프로젝트 폴더: collectors/
- 환경변수: FINNHUB_API_KEY=<YOUR_KEY> (선택)
- 출력: 클래스 (screener에서 사용)

# 작업
1. USStockDataFetcher 클래스 생성
2. __init__:
   - yfinance import (실패 시 yf_available=False)
   - curl_cffi Session(impersonate="chrome") (있으면)
   - Finnhub API 키: 환경변수 FINNHUB_API_KEY
3. get_history(ticker, period="3mo"): yfinance 주가 이력, 실패 시 빈 DataFrame
4. get_info(ticker): yfinance Ticker.info dict, 실패 시 빈 dict

파일명: collectors/data_fetcher.py
```

### 15. 스크리너 기본 구조 + 데이터 로딩

**목적:** EnhancedSmartMoneyScreener의 초기화와 데이터 로딩을 구현한다.
**변경 사항:** v1 2개 통합, Look-ahead bias 방지 강조
**교육 포인트:** Look-ahead bias 방지(filing_date ≤ 어제), 필수 vs 선택 데이터 패턴, _info_cache 메모이제이션

```
# 목표
EnhancedSmartMoneyScreener 클래스와 load_data() 메서드를 구현한다.

# 컨텍스트
- 선행 조건: collectors/data_fetcher.py
- 입력: output/us_volume_analysis.csv(필수), output/us_13f_holdings.csv(선택), data/us_stocks_list.csv(선택)
- 출력: 로드된 데이터 (메모리)

# 작업
1. EnhancedSmartMoneyScreener 클래스:
   - __init__(data_dir): output 경로 설정, USStockDataFetcher 초기화
   - volume_df, holdings_df, etf_df, spy_data = None
   - _info_cache: Dict[str, Dict] = {}

2. load_data() 메서드:
   - output/us_volume_analysis.csv → volume_df (필수, 없으면 return False)
   - output/us_13f_holdings.csv → holdings_df:
     * filing_date → pd.to_datetime 변환
     * 어제 이전 데이터만 필터링 (Look-ahead bias 방지)
   - output/us_etf_flows.csv → etf_df (선택)
   - data/us_stocks_list.csv → stocks_df (섹터 정보, 선택)
   - SPY 3개월 데이터 → spy_data

3. _get_info_cached(ticker): 캐시 조회 → 없으면 API 호출 → 캐시 저장

파일명: analyzers/smart_money_screener_v2.py
```

### 16. 기술적 분석 점수

**목적:** RSI, MACD, 이동평균 분석으로 기술적 점수(0~100)를 산출한다.
**변경 사항:** v1 3개 프롬프트(RSI + MACD/MA + 점수) 통합
**교육 포인트:** RSI 과매도(30↓) +10~15점, MACD 골든크로스 +15점, 데스크로스 -15점, 기본 50점 시작

```
# 목표
get_technical_analysis(ticker) 메서드를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 15 완성
- 데이터 부족(50일 미만) 시 _default_technical() 반환

# 작업
1. 1년치 데이터 수집 (self.fetcher.get_history)
2. RSI 14일 (Wilder's Smoothing):
   - delta = close.diff()
   - gain/loss = ewm(alpha=1/14, adjust=False)
   - rsi = 100 - (100 / (1 + rs))
3. MACD: EMA12 - EMA26, Signal = EMA9, Histogram = MACD - Signal
4. 이동평균: MA20, MA50, MA200
   - Bullish: price > MA20 > MA50 / Bearish: price < MA20 < MA50
   - Golden Cross: MA50이 MA200 위로 돌파 / Death Cross: 반대
5. technical_score (기본 50점):
   - RSI < 30: +10 + int((30-rsi)/6) / 30~45: +10 / 60~70: +2 / > 70: -5
   - MACD 음→양 전환: +15 / 양수: +8 / 음수: -5
   - Bullish MA: +15 / Bearish: -10 / Golden Cross: +10 / Death Cross: -15
   - 최종: max(0, min(100, score))
6. _default_technical(): rsi=50, macd=0, technical_score=50 등 기본값

반환: rsi, macd, macd_signal, macd_histogram, ma20, ma50, ma_signal, cross_signal, technical_score
```

### 17. 펀더멘털 + 애널리스트 + 상대강도 분석

**목적:** 펀더멘털, 애널리스트 컨센서스, SPY 대비 상대강도 점수를 산출한다.
**변경 사항:** v1 3개 프롬프트 통합 (각각 단일 메서드)
**교육 포인트:** PER 0~15x 저평가(+15점), ROE 20%+ 우량(+10점), SPY 대비 상대수익률

```
# 목표
get_fundamental_analysis, get_analyst_ratings, get_relative_strength 메서드를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 15 완성 (_get_info_cached 사용)

# 작업
1. get_fundamental_analysis(ticker):
   - info에서: trailingPE, forwardPE, priceToBook, priceToSalesTrailing12Months, revenueGrowth, earningsGrowth, profitMargins, returnOnEquity, marketCap, dividendYield (모두 `or 0` 방어)
   - fundamental_score (기본 50점): P/E 0~15: +15 / 15~25: +10 / >40: -10 / 적자: -15 / 매출성장 >20%: +15 / ROE >20%: +10
   - 시가총액 분류: >200B Mega / >10B Large / >2B Mid / >300M Small / Micro

2. get_analyst_ratings(ticker):
   - targetMeanPrice, recommendationKey, numberOfAnalystOpinions
   - upside = (target - current) / current * 100
   - analyst_score (기본 50점): strongBuy +15 / buy +10 / sell -10 / 업사이드 >30% +10 / 애널리스트 >10명 +5

3. get_relative_strength(ticker):
   - 종목 20일 수익률 - SPY 20일 수익률
   - spy_data None이면 0.0 반환
   - 소수점 첫째자리 반올림
```

### 18. 종합 점수 + 실행 + 검증

**목적:** 6개 팩터 가중 합산, 등급 분류, 스크리닝 실행, 결과 검증을 구현한다.
**변경 사항:** v1 3개 + 비구조적 지시(343-345줄) 통합
**교육 포인트:** 6팩터 가중 평균(Tech 25%, Fund 20%, Analyst 15%, RS 15%, Vol 15%, 13F 10%), A~F 등급

```
# 목표
calculate_composite_score, run_screening, validate_results를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 15~17 완성
- 출력: output/smart_money_picks_v2.csv

# 작업
1. calculate_composite_score(ticker):
   - 6개 점수 수집: technical, fundamental, analyst, relative_strength(0~100 보정), sd_score(volume_df), 13f_score(holdings_df)
   - 가중 합산: Tech 25%, Fund 20%, Analyst 15%, RS 15%, Vol 15%, 13F 10%
   - 등급: A(80+) Strong Accumulation / B(65~80) / C(50~65) / D(35~50) / E(20~35) / F(<20) Capitulation

2. run_screening():
   - load_data() → volume_df 전 ticker tqdm 순회 → composite_score 내림차순 → 상위 20개
   - output/smart_money_picks_v2.csv 저장
   - 요약: 총 종목 수, 소요 시간, 상위 5개 미리보기

3. validate_results():
   - 파일 존재, 행 > 0, 필수 컬럼, score 0~100, grade A~F, 중복 없음, NaN < 20%
   - PASS/FAIL 출력

4. if __name__ == '__main__' 블록
```

### 19. 스크리닝 실행 스크립트

**목적:** S&P 500 전체 스크리닝을 실행하고 결과를 날짜별로 저장하는 독립 스크립트를 구현한다.
**변경 사항:** v1 채팅 메시지(343-345줄 "결과는 result 폴더 만들어서...") 구조화
**교육 포인트:** tqdm 진행 표시, 날짜 스탬프 파일명, result/ 디렉토리 자동 생성

```
# 목표
S&P 500 스크리닝 실행 + result/ 폴더 날짜별 CSV 저장 스크립트를 구현한다.

# 컨텍스트
- 선행 조건: analyzers/smart_money_screener_v2.py
- 출력: result/smart_money_picks_YYYYMMDD.csv

# 작업
1. result/ 폴더 자동 생성 (os.makedirs)
2. 스크리닝 실행 (진행 과정 표시)
3. 결과 CSV를 result/smart_money_picks_YYYYMMDD.csv로 저장
4. 종목/전략/셋업/점수/등급/SD/Tech/Fund/RS vs SPY 컬럼 포함
5. 콘솔에 Top 20 미리보기 출력

파일명: run_screening.py
```

---

## Part 4: AI 분석

### 20. 뉴스 수집기

**목적:** Yahoo, Google RSS, Finnhub 3개 소스에서 종목별 뉴스를 수집하고 통합한다.
**변경 사항:** v1 2개 프롬프트(개별 소스 + 통합) 통합
**교육 포인트:** 멀티소스 뉴스 수집, 제목 앞 50자 기준 중복 제거, 날짜순 정렬

```
# 목표
NewsCollector 클래스를 구현한다.

# 컨텍스트
- 프로젝트 폴더: analyzers/
- 환경변수: FINNHUB_API_KEY=<YOUR_KEY> (선택)
- 출력: 클래스 (AI 생성기에서 사용)

# 작업
1. NewsCollector 클래스
2. __init__: User-Agent 헤더 설정, finnhub_key (인자 또는 환경변수)
3. get_yahoo_news(ticker, limit=3):
   - yfinance Ticker.news → title, publisher, link, published(YYYY-MM-DD), source='Yahoo'
4. get_google_news(ticker, company_name=None, limit=3):
   - Google News RSS URL + urllib.parse.quote
   - xml.etree.ElementTree 파싱 → title, pubDate, link, source
5. get_finnhub_news(ticker, limit=3):
   - Finnhub API (7일 범위), summary 200자 제한, API 키 없으면 빈 리스트
6. get_news_for_ticker(ticker, company_name=None):
   - 3개 소스 합치기 → _deduplicate_news() → 날짜 내림차순 → 최대 8개
7. _deduplicate_news(): title 앞 50자 소문자 비교로 중복 제거

파일명: analyzers/ai_summary_generator.py (NewsCollector 클래스)
```

### 21. Gemini AI 생성기 + 프롬프트

**목적:** Google Gemini API로 종목 분석을 생성하는 클래스와 프롬프트 빌더를 구현한다.
**변경 사항:** v1 2개 프롬프트 통합, API 키 제거
**교육 포인트:** temperature 0.3(일관성), JSON 응답 강제, bear_cases 필수 3개, 매크로 컨텍스트 연동

```
# 목표
GeminiSummaryGenerator 클래스를 구현한다.

# 컨텍스트
- 환경변수: GOOGLE_API_KEY=<YOUR_KEY>
- 모델: gemini-3-flash-preview (환경변수 GEMINI_MODEL로 오버라이드 가능)
- 출력: JSON 분석 결과

# 작업
1. GeminiSummaryGenerator 클래스
2. __init__: api_key (인자 또는 GOOGLE_API_KEY), base_url 설정
3. generate_summary(ticker, data, news, lang='ko', macro_context=None):
   - POST 요청: temperature 0.3, maxOutputTokens 4000
   - 응답 파싱: candidates[0].content.parts에서 thought 아닌 text만 추출
   - Safety filter / 에러 시: _get_fallback_json(ticker, reason)
4. _build_prompt(ticker, data, news, lang, macro_context):
   - 매크로 컨텍스트: VIX, 10Y 금리, Breadth, Fear&Greed 등
   - "RISK_OFF/CRISIS 시 BUY 기준 강화" 지침
   - 종목 정보: ticker, 등급, 점수, RSI, MA Signal, P/E, 목표가 대비
   - 최근 뉴스 (최대 5개)
   - 응답 규칙: 모든 주장에 [출처, 날짜], bear_cases 반드시 3개, data_conflicts 명시
   - JSON 구조: thesis, catalysts[{point, evidence}], bear_cases[{point, evidence}] x3, data_conflicts[], key_metrics, recommendation(BUY/HOLD/SELL), confidence(0~100)
5. _get_fallback_json(ticker, reason): 에러 시 안전한 기본 JSON
```

### 22. OpenAI + Perplexity 생성기

**목적:** GPT와 Perplexity AI 생성기를 구현하고 팩토리 함수를 제공한다.
**변경 사항:** v1 3개 프롬프트 통합, API 키 제거
**교육 포인트:** GPT reasoning 모델은 temperature 미지원, Perplexity는 웹 검색 강화, 팩토리 패턴

```
# 목표
OpenAISummaryGenerator, PerplexitySummaryGenerator, get_ai_provider 팩토리를 구현한다.

# 컨텍스트
- 환경변수: OPENAI_API_KEY=<YOUR_KEY>, PERPLEXITY_API_KEY=<YOUR_KEY>
- 선행 조건: 프롬프트 21 완성 (GeminiSummaryGenerator._build_prompt 재사용)

# 작업
1. OpenAISummaryGenerator:
   - model: "gpt-5-mini"
   - _build_prompt 재사용 (GeminiSummaryGenerator.__new__ 패턴)
   - messages: developer role + user prompt
   - reasoning: {"effort": "medium"}, max_completion_tokens: 8000
   - [주의] temperature 파라미터 금지 (reasoning 모델 미지원)

2. PerplexitySummaryGenerator:
   - model: "sonar-pro"
   - 웹 검색 지시문 추가: 최근 실적, 애널리스트 변경, 내부자 거래, 속보, 공매도
   - "Cite sources and dates. If no results: 'No recent data found'. Do NOT fabricate."
   - temperature: 0.3, max_tokens: 4000, timeout: 90초

3. get_ai_provider(provider='gemini'):
   - 'gemini' → GeminiSummaryGenerator()
   - 'openai' → OpenAISummaryGenerator()
   - 'perplexity' → PerplexitySummaryGenerator()
   - 그 외 → ValueError
```

### 23. AI 응답 파싱 + 검증

**목적:** AI 응답을 안전하게 JSON으로 파싱하고 필수 필드를 검증한다.
**변경 사항:** 유지 (v1과 동일)
**교육 포인트:** ```json 블록 추출, 정규식 fallback, 필수 키(thesis, recommendation, confidence) 검증

```
# 목표
parse_ai_response와 validate_ai_response 유틸리티를 구현한다.

# 컨텍스트
- 출력: analyzers/ai_response_parser.py

# 작업
1. parse_ai_response(text):
   - ```json ... ``` 블록 추출 → json.loads
   - 실패 시 정규식으로 { ... } 블록 추출
   - 완전 실패 시 None

2. validate_ai_response(parsed):
   - 필수 키: thesis, recommendation, confidence
   - bear_cases 3개 (부족 시 경고)
   - confidence 0~100 범위
   - recommendation: BUY/HOLD/SELL 중 하나
   - 통과 → True / 실패 → False + 이유 로깅

파일명: analyzers/ai_response_parser.py
```

### 24. API 비용 추적 + CLI

**목적:** AI API 호출 비용을 추적하고 CLI 인터페이스를 제공한다.
**변경 사항:** v1 2개 프롬프트 통합, API 키 제거
**교육 포인트:** Provider별 토큰 단가, 싱글턴 usage_tracker, argparse 멀티 프로바이더 CLI

```
# 목표
APIUsageTracker 클래스와 __main__ CLI를 구현한다.

# 컨텍스트
- 출력: output/ai_summaries.json, 콘솔 비용 요약

# 작업
1. APIUsageTracker 클래스 (모듈 레벨 싱글턴 usage_tracker):
   - Provider별 토큰 추출:
     * Gemini: usageMetadata.promptTokenCount / candidatesTokenCount
     * GPT: usage.prompt_tokens / completion_tokens
     * Perplexity: usage.prompt_tokens / completion_tokens
   - 비용 계산:
     * Gemini Flash: $0.10/1M input, $0.40/1M output
     * GPT-5-mini: $0.15/1M input, $0.60/1M output
     * Perplexity Sonar: ~$3/1K requests
   - print_summary(): 총 요청/토큰/비용 출력

2. if __name__ == '__main__' (argparse):
   - --provider: gemini (기본) / openai / perplexity
   - --top: 분석 종목 수 (기본 20)
   - --ticker: 특정 종목만 (선택)
   - --lang: ko (기본) / en
   - --refresh: 캐시 무시
   - 로직: smart_money_picks_v2.csv 로드 → 뉴스 수집 → AI 분석 → output/ai_summaries.json 저장

파일명: analyzers/ai_summary_generator.py (APIUsageTracker + __main__)
```

---

## Part 5: 최종 리포트 + 통합

### 25. 최종 리포트 생성기

**목적:** 퀀트 점수(90%)와 AI 점수(10%)를 합산하여 최종 Top 10을 선정한다.
**변경 사항:** 유지
**교육 포인트:** "데이터가 추천을, AI가 판단" — 퀀트 90% + AI 10% 블렌딩, 키워드 매칭 AI 점수 추출

```
# 목표
FinalReportGenerator 클래스를 구현한다.

# 컨텍스트
- 입력: output/smart_money_picks_v2.csv, output/ai_summaries.json
- 출력: output/final_top10_report.json

# 작업
1. FinalReportGenerator 클래스
2. load_data(): picks CSV(필수) + AI JSON(없으면 빈 dict)
3. extract_ai_recommendation(summary):
   - 키워드 매칭: "적극 매수"/strong buy → +20, "조정 시 매수" → +15, "매수"/buy → +10
   - "과매수" → -5, "조정 가능성" → -3, "상승 추세" → +5
   - (ai_score, recommendation) 튜플 반환
4. calculate_final_score(row, ai_summaries):
   - quant_score = composite_score
   - ai_contribution = min(max(0, ai_score), 10) * 0.5
   - final_score = quant_score * 0.9 + ai_contribution
5. generate_report():
   - 모든 종목 final_score 계산 → 내림차순 → 상위 10개
   - output/final_top10_report.json 저장

파일명: analyzers/final_report_generator.py
```

### 26. 전체 파이프라인

**목적:** 6단계 전체 파이프라인을 순차 실행하는 통합 스크립트를 구현한다.
**변경 사항:** 유지
**교육 포인트:** 단계별 소요 시간 로깅, 한 단계 실패해도 계속 진행, 최종 비용 요약

```
# 목표
run_full_pipeline.py 6단계 통합 실행 스크립트를 구현한다.

# 컨텍스트
- 선행 조건: 프롬프트 1~25의 모든 모듈
- 출력: data/*.csv, output/*.json, result/*.csv

# 작업
1. Step 1: 데이터 수집 (USDataPipeline.run_full_collection)
2. Step 2: 시장 체제 감지 (MarketRegimeDetector.detect_regime)
3. Step 3: 시장 게이트 (market_gate 실행)
4. Step 4: 스마트 머니 스크리닝 (EnhancedSmartMoneyScreener.run_screening)
5. Step 5: AI 분석 (기본 Gemini, ai_summary_generator)
6. Step 6: 최종 리포트 (FinalReportGenerator.generate_report)
- 각 단계 소요 시간 로깅
- 한 단계 실패 시 다음 단계 계속 (가능한 범위)
- 최종: 시장 체제, 분석 종목 수, Top 10 미리보기, API 비용 요약(usage_tracker.print_summary)

파일명: run_full_pipeline.py
```

### 27. 대시보드

**목적:** 분석 결과를 시각화하는 다크 모드 웹 대시보드를 구현한다.
**변경 사항:** v1 웹 검색 의존("최근 가장 트렌드한 디자인을") 제거, 로컬 기반으로 재작성
**교육 포인트:** JSON 파일 로드, 다크 모드 SPA, 글래스모피즘 디자인

> [NOTE: 디자인 레퍼런스가 필요하면 `docs/stitch1.html`, `stitch2.html`, `stitch3.html` 참고]

```
# 목표
output/ JSON 데이터를 시각화하는 다크 모드 SPA 대시보드를 구현한다.

# 컨텍스트
- 입력: output/regime_result.json, regime_config.json, ai_summaries.json, final_top10_report.json
- 대시보드에서 JSON을 symlink로 참조 (dashboard/ → output/)
- 실행: cd dashboard && python3 -m http.server 8889

# 작업
1. dashboard/index.html 단일 파일 SPA
2. 다크 모드 + 네온 액센트 + 글래스모피즘 디자인
3. 섹션 구성:
   - Market Regime 배너: 현재 체제 + 적응형 파라미터 (stop_loss, MDD)
   - Regime Signals: 5개 센서 상태 컬러 표시
   - Market Gate: GO/CAUTION/STOP 신호등
   - Smart Money Top 10: 종목별 점수, 등급, 프로그레스 바
   - AI Analysis Modal: 종목 클릭 시 thesis, catalysts, bear_cases 상세 표시
4. output/ 파일을 dashboard/로 symlink 생성

파일명: dashboard/index.html
```

---

## Part 6: ML 기반 지수 방향 예측

> 세부 프롬프트 (단계별 분해 버전)는 `prompt_v2.md` 참고. 아래는 Part 1~5 스타일에 맞춰 통합한 4개 프롬프트.

### 28. IndexPredictor 기본 구조 + 기술적 지표 헬퍼

**목적:** SPY/QQQ 5일 방향 예측 모델의 기본 클래스와 지표 헬퍼를 구현한다.
**변경 사항:** 신규 추가 (v1에는 없던 ML 레이어)
**교육 포인트:** 클래스 변수로 27 피처 + 6 역방향 피처 정의, Wilder's smoothing RSI, MACD 시그널(+1/-1/0), Bollinger Band 위치(0~1), regime_config.json 공유

```
# 목표
IndexPredictor 클래스의 기본 구조, regime config 로드, 기술적 지표 헬퍼를 구현한다.

# 컨텍스트
- 선행 조건: pandas, numpy 설치
- 독립 실행 가능 (시장 체제 감지기와 regime_config.json 선택적 공유)
- 출력: 클래스 스켈레톤 + 헬퍼 메서드

# 작업
1. IndexPredictor 클래스 (us_market/index_predictor.py)
2. 클래스 변수:
   - FEATURE_NAMES (27개): SPY 7 + VIX 4(vix_above_20 포함) + QQQ 2 + 시장폭 2 +
     섹터 3 + 매크로 3 + 거래량 3 + 모멘텀 3
   - INVERSE_FEATURES (6개): vix_value, vix_change_5d, vix_percentile,
     vix_above_20, xlu_relative_1m, dxy_return_1w
3. __init__(data_dir='.'):
   - self.output_file = output/index_prediction.json
   - self.model_path_spy/qqq = output/predictor_model_*.joblib
   - self.history_file = output/prediction_history.json
   - self.config = self._load_regime_config()
4. _load_regime_config() → Dict:
   - output/regime_config.json의 'predictor' 키로 defaults 업데이트
   - 기본값: prediction_horizon_days=5, cv_splits=5, retrain_interval_days=7,
     min_training_samples=50, confidence_high_threshold=70, confidence_moderate_threshold=60
5. @staticmethod _calculate_rsi(series, period=14):
   - delta.where(delta>0, 0).ewm(alpha=1/period, adjust=False).mean() 방식
   - gain/loss 모두 0이면 fillna(50)
6. @staticmethod _calculate_macd_signal(series) → pd.Series(int):
   - EMA 12/26 → MACD, EMA 9 of MACD → signal
   - +1 / -1 / 0 반환
7. @staticmethod _calculate_bb_position(series, window=20):
   - SMA ± 2*std로 상/하단, position = (price-lower)/(upper-lower)
   - band_width=0 → NaN 보호, clip(0,1).fillna(0.5)

파일명: us_market/index_predictor.py
```

### 29. 피처 빌드 + 데이터 수집 + 학습 데이터셋

**목적:** yfinance 가격에서 27 피처를 만들고 5일 후 방향/수익률 타겟을 붙인다.
**변경 사항:** 신규 추가
**교육 포인트:** 컬럼 없으면 피처 스킵(방어적 코딩), yfinance 타임존 통일 필수(SPY=NY / VIX=Chicago 혼재 시 reindex 실패), forward return은 shift(-horizon)

```
# 목표
가격 → 27 피처 → 타겟 재구성 파이프라인.

# 컨텍스트
- 선행 조건: 프롬프트 28 완성, yfinance/curl_cffi 설치
- 입력: 티커 10개의 Close/Volume
- 출력: 27 피처 + 4 타겟 DataFrame

# 작업
1. _build_raw_features(data: pd.DataFrame) → pd.DataFrame:
   - SPY 7: return_1w/1m (pct_change(5/21)*100), above_200/50ma (binary),
     rsi, macd_signal, bb_position
   - VIX 4: vix_value, vix_change_5d, vix_above_20,
     vix_percentile (rolling(252).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1], raw=False))
   - QQQ 2: qqq_return_1w, qqq_rsi
   - 시장폭 2: breadth_pct_above_50ma (50일선 위 여부 rolling 평균*100),
     advance_decline_ratio (Laplace (adv+1)/(dec+1), rolling 20)
   - 섹터 3: xlk/xlu/xly_relative_1m = (sector pct_change(21) - spy pct_change(21))*100
   - 매크로 3: yield_spread_proxy (TNX-FVX 또는 TNX pct_change(5)*100),
     gold_return_1w, dxy_return_1w
   - 거래량 3: spy_vol_ratio, spy_vol_trend_5d (5일/20일-1), qqq_vol_ratio
   - 모멘텀 3: spy_roc_10d, spy_price_vs_50ma_pct, spy_rsi_slope_5d (rsi-rsi.shift(5))
   - 각 필요 컬럼 없으면 해당 피처 스킵
2. _fetch_price_data(start_date='2023-01-01') → pd.DataFrame:
   - lookback_start = start_date - 300일 (SMA/percentile warm-up)
   - 티커: SPY, QQQ, ^VIX, XLK, XLU, XLY, GC=F, DX-Y.NYB, ^TNX, ^FVX
   - 이름 정규화: ^VIX→VIX, GC=F→GOLD, DX-Y.NYB→DXY, ^TNX→TNX, ^FVX→FVX
   - curl_cffi Session(impersonate="chrome")
   - **타임존 통일 필수**: hist.index.tz_localize(None).normalize()
   - SPY/QQQ는 Volume 추가 (SPY_VOL, QQQ_VOL)
   - 실패 시 빈 DataFrame + logger.error
3. reconstruct_signals_from_prices(start_date='2023-01-01'):
   - _fetch_price_data → _build_raw_features
   - horizon = self.config['prediction_horizon_days']
   - spy/qqq_target_return = pct_change(horizon).shift(-horizon)*100
   - spy/qqq_target_direction = (return > 0).astype(int)
   - start_date 이후 필터

파일명: us_market/index_predictor.py (동일 파일에 메서드 추가)
```

### 30. 모델 학습 + 예측 + 히스토리 관리

**목적:** GradientBoosting 분류+회귀를 학습하고, 예측을 저장하고, 히스토리를 누적한다.
**변경 사항:** 신규 추가
**교육 포인트:** TimeSeriesSplit(시계열 데이터 유출 방지), 클래스 불균형 보정(sample_weight), Classifier+Regressor 이중 모델, 히스토리 100개 cap

```
# 목표
GradientBoosting 학습 → 최신 피처 예측 → JSON + 히스토리 저장.

# 컨텍스트
- 선행 조건: 프롬프트 29 완성, scikit-learn/joblib 설치
- 입력: 27 피처 + 4 타겟 DataFrame
- 출력: output/predictor_model_*.joblib, index_prediction.json, prediction_history.json

# 작업
1. train(df, target_ticker='SPY') → Dict:
   - ImportError 시 설치 안내 반환
   - NaN 타겟 드롭, available_features 선택, dropna, min_samples 체크(50)
   - 클래스 불균형: weight = total/(2*n_class), sample_weights 생성
   - TimeSeriesSplit(5) CV: 각 fold StandardScaler 새로 fit, 단일 클래스 fold 스킵
   - GradientBoostingClassifier(n=150, depth=4, lr=0.05, subsample=0.8, leaf=10, rs=42)
   - accuracy_score + brier_score_loss 수집
   - 전체 데이터로 Classifier + Regressor 재학습
   - joblib.dump: classifier, regressor, scaler, features, feature_importance,
     trained_at(isoformat), training_samples, cv_accuracy, target_std
   - 반환: accuracy, brier_score, training_samples, features_used, top_features
2. build_latest_features() → Optional[pd.Series]:
   - _fetch_price_data('2024-01-01') + _build_raw_features
   - 마지막 행, NaN 과반이면 None, 나머지 fillna(0)
3. predict_next_week() → Dict:
   - 각 ticker (SPY/QQQ):
     * 모델 없거나 age > retrain_interval_days → reconstruct_signals + train
     * 모델의 features 목록에 맞춰 latest vector 정렬 (누락 시 0 + 경고)
     * scaler.transform → classifier.predict_proba / regressor.predict
     * confidence: high(70%+) / moderate(60%+) / low
     * key_drivers: 상위 5 (feature, importance, value, direction)
   - _get_driver_direction(name, value):
     * INVERSE_FEATURES: 양수→bearish
     * RSI: >70 bearish, <30 bullish
     * BB: >0.8 bearish, <0.2 bullish
   - output/index_prediction.json 저장
4. _save_prediction_history(prediction):
   - prediction_history.json append (최대 100개, 초과 시 trim)
   - 항목: {date, spy: {direction, probability, predicted_return},
     qqq: {...}, model_accuracy (% 단위)}

파일명: us_market/index_predictor.py (동일 파일에 메서드 추가)
```

### 31. 단위 테스트 + CLI 진입점

**목적:** 핵심 메서드 8개 테스트와 CLI 실행 블록을 추가한다.
**변경 사항:** 신규 추가
**교육 포인트:** 실제 구조 반영 mock(더미 금지), __main__에서 SPY/QQQ + top 3 key_drivers 포맷팅

```
# 목표
pytest 테스트 8개와 python us_market/index_predictor.py CLI 진입점 구현.

# 컨텍스트
- 선행 조건: 프롬프트 28~30 완성
- 실행: pytest tests/test_index_predictor.py -v / python us_market/index_predictor.py

# 작업
1. tests/test_index_predictor.py (pytest 기반):
   - test_calculate_rsi_normal: 혼합 시리즈 RSI ∈ [0, 100]
   - test_calculate_rsi_all_up: 상승 시 RSI ≥ 95
   - test_calculate_macd_signal: 상승→+1 / 하락→-1, dtype=int
   - test_calculate_bb_position: 상단≥0.9 / 하단≤0.1 / 전체 [0,1]
   - test_build_raw_features_columns: 400일 mock 데이터로 27 피처 존재 확인
   - test_inverse_features_direction: INVERSE 양수→bearish, 음수→bullish
   - test_load_regime_config_defaults (tmp_path): 파일 없으면 6개 기본값
   - test_feature_names_count: 27 + 중복 없음 + INVERSE_FEATURES ⊂ FEATURE_NAMES
2. __main__ 블록 (index_predictor.py 하단):
   - logging.basicConfig(level=INFO)
   - IndexPredictor(data_dir='.').predict_next_week()
   - 출력: SPY/QQQ 각각 direction / probability_up / predicted_return /
     confidence / top 3 key_drivers (feature=value, direction, importance)
   - 저장 경로 로그

파일명: tests/test_index_predictor.py, us_market/index_predictor.py (__main__)
```

---

## 환경변수 설정 참고

`.env` 파일에 아래 키를 설정한다 (`.env.example` 참고):

| 키 | 용도 | 필수 |
|----|------|------|
| FRED_API_KEY | FRED 경제 지표 | 예 |
| GOOGLE_API_KEY | Gemini AI 분석 | AI 사용 시 |
| OPENAI_API_KEY | GPT AI 분석 | 선택 |
| PERPLEXITY_API_KEY | Perplexity AI 분석 | 선택 |
| FINNHUB_API_KEY | 뉴스 + 주가 fallback | 선택 |

API 키 발급처:
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html
- Google AI Studio: https://aistudio.google.com/apikey
- OpenAI: https://platform.openai.com/api-keys
- Perplexity: https://console.perplexity.ai/account/setup
- Finnhub: https://finnhub.io/register

---

## Part 5: Agent Ecosystem + Evolution (2026-04-05 추가)

### 5.0 배경

기존 Part 1~4 시스템(rule-based + GBM index prediction)을 **자가 진화하는 멀티에이전트 생태계**로 확장. **22 에이전트 2-tier 오케스트레이션** + **매일 1건 자가 진화 사이클** 구축.

### 5.1 GBM 5팀 15 에이전트 생성 프롬프트

```
# 목표
`.claude/agents/`에 GBM ML 시스템용 5팀 × 3 에이전트 = 15명 생성

# 컨텍스트
- 기존 6 에이전트는 rule-based 성능 개선 사이클 (perf-lead 중심)
- GBM(LightGBM/XGBoost/CatBoost) 앙상블을 rule-based와 병행 운영 필요
- 5팀: Research / Macro / Equity / MLOps / Model (각 lead 1 + specialist 2)

# 작업
1. Research Team (3): research-lead (opus) + paper-researcher (sonnet)
   + factor-discoverer (sonnet) — 일일 논문/팩터 발굴
2. Macro Team (3): macro-lead + macro-feature-engineer + regime-ml-classifier
   — 18+ 거시 피처 + GBM 4-regime 확률 분류기
3. Equity Team (3): equity-lead + equity-factor-builder + equity-flow-analyst
   — 80+ 종목 팩터 + cross-sectional 중립화
4. MLOps Team (3): mlops-lead + ml-pipeline-architect + gbm-code-reviewer
   — feature store + train/predict DAG + 코드 품질
5. Model Team (3): model-lead + gbm-trainer + walk-forward-validator
   — LightGBM 앙상블 + Purged K-Fold + PBO/DSR

각 에이전트 .md 포맷 (기존 signal-optimizer.md 참조):
- YAML frontmatter: name, description, model, tools
- 역할 (페르소나 15년차 Quant)
- 핵심 원칙 3~5개
- 담당 파일 / 작업 프로토콜 / 금지 사항

파일명: .claude/agents/{agent-name}.md (15개)
```

### 5.2 service-evolver 메타 에이전트 프롬프트

```
# 목표
us-stock 서비스 전체의 매일 진화 사이클을 자율 수행하는 단일 메타 에이전트

# 컨텍스트
GBM 팀(15)은 ML에 집중. 하지만 사용자는 "전체 서비스를 매일 조금씩 개선하는
단일 에이전트"를 원함. architecture.drawio + README 이해하고 웹 트렌드 리서치하여
개선점 찾아서 실제 코드까지 수정.

# 작업
.claude/agents/service-evolver.md 생성:
- model: claude-opus-4-6 (전략 판단)
- tools: Read, Write, Edit, WebSearch, WebFetch, Grep, Glob, Bash
- 7-Phase 일일 사이클:
  Phase 1 (10분) 현황 파악: docs/README.md + architecture.drawio + memory.md
  Phase 2 (15분) 트렌드 리서치: WebSearch 3회 이내, URL 근거 필수
  Phase 3 (10분) Gap Analysis: 현재 시스템 vs 트렌드 매트릭스
  Phase 4 (5분)  개선 선정: Impact/Effort/Risk, 하루 1건 원칙
  Phase 5 (30~60분) 코드 수정: Edit/Write + 인라인 주석(날짜+근거)
  Phase 6 (10분) 검증: 3-layer (syntax + import + unit execution)
  Phase 7 (5분)  문서 갱신: memory.md + backlog.md + cycle log

핵심 원칙:
- 하루 1개, 진화적 변경 (롤백 쉬운 것만)
- 근거는 외부에서 (논문/뉴스/공식 문서 URL 필수)
- 코딩까지 완결 (분석만으로 끝내지 않음)
- memory.md에 누적 (성공/실패 모두 기록)

파일명: .claude/agents/service-evolver.md
```

### 5.3 ML 파이프라인 MVP 구축 프롬프트 (Phase 1~4)

```
# 목표
GBM 5팀 에이전트 역할에 따라 실제 학습/추론 파이프라인 MVP 구축

# 컨텍스트
- 데이터: us_daily_prices.csv (50 종목 × 251일 = 12,550 샘플)
- 타겟: fwd_20d_return_rank (cross-sectional percentile rank)
- 목표: 학습 → walk-forward 검증 → 추론 → 기존 파이프라인 통합

# 작업
Phase 1: 피처 생성
- ml/features/macro/build_macro_features.py — 18 거시 피처 parquet
- ml/features/equity/build_equity_features.py — 36 피처 + 5 타겟 parquet
  (momentum/mean-reversion/volatility/volume/trend/range + fwd_5d/20d/60d 타겟)

Phase 2: LightGBM 학습
- ml/pipeline/train.py — regression objective (fwd_20d_rank 0~1)
- Train/Test split (70/30, 20일 embargo)
- Early stopping 50 rounds
- model + metadata.json 저장

Phase 3: Walk-forward 검증
- ml/validation/walk_forward.py — Purged K-Fold (90 train / 10 embargo / 20 test, step 20)
- 8 HP variants × 5 folds로 PBO 계산
- DSR (Deflated Sharpe Ratio) 계산
- VERDICT: PASS/FAIL

Phase 4: 파이프라인 통합
- ml/pipeline/predict.py — Top 20 종목 예측 parquet/csv 저장
- run_full_pipeline.py Step 7 추가 (try/except 감쌈)

파일: ml/features/**, ml/pipeline/**, ml/validation/**, run_full_pipeline.py
```

**실행 결과**:
- Train Rank IC: +0.5112 (IR 3.37) — overfit 경고
- Test Rank IC: +0.0689 (IR 0.38) — OOS 기준 0.05 초과 ✅
- Walk-forward: PBO 0.900 ❌, DSR 0.032 ❌, VERDICT FAIL
- 해석: 검증 gate가 의도적으로 엄격, 50종목×1년 MVP는 예상된 FAIL

### 5.4 Evolution Cycle #1 — ERP 센서 추가

**근거**: [Morningstar 2025](https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns) — ERP = S&P500 earnings yield − TIPS 10y real yield가 장기 수익률 예측력 최상위.

```
# 목표
collectors/macro_collector.py에 ERP 3개 메서드 추가

# 작업
1. fetch_tips_10y_real_yield() — FRED DFII10 호출
2. fetch_spy_earnings_yield() — yfinance SPY.forwardPE 역수
3. fetch_equity_risk_premium() — 계산 + 4단계 valuation 라벨
4. get_macro_summary()에 summary["erp"] = erp_data 추가

파일: collectors/macro_collector.py (+60줄, 0줄 수정)
```

**결과**: ERP 1.87% (= 3.84% − 1.97%) → "과열 (주식 고평가)"

### 5.5 Evolution Cycle #2 — IndexPredictor 파이프라인 통합

```
# 목표
us_market/index_predictor.py(27 피처 GBM)를 run_full_pipeline.py Step 8로 통합

# 작업
1. step_index_prediction() 함수 추가 (Step 7 뒤)
2. main()에 호출 추가
3. 종합 요약 섹션에 SPY/QQQ 출력

파일: run_full_pipeline.py (+25줄, 0줄 수정)
```

**결과**:
- SPY: BEARISH (-3.13%, 신뢰도 92% / high)
- QQQ: BEARISH (-3.59%, 신뢰도 86% / high)

### 5.6 일일 사용 명령 (사용자 관점)

```bash
# 매일 아침 (10분)
source .venv/bin/activate
python run_full_pipeline.py    # 8단계 자동 실행

# Claude Code 세션에서
@service-evolver 오늘의 evolution cycle 실행해줘
```

**매일 누적되는 학습**: `.docs/evolution/memory.md` (Do's/Don'ts/Open Questions)

### 5.7 Summary2.md 이미지 분석으로 도출된 개선 후보 (2026-04-05)

사용자 Obsidian vault의 `Summary2.md` 22개 이미지를 service-evolver가 스캔하여 **실측 검증된** 개선 후보 6건 발굴. 별도 `US_Market` 프로젝트의 `CLAUDE.md` 실험 결과에서 효과 확인됨.

**이미지 → backlog 매핑**:

| Summary2 이미지 | 내용 | 도출된 후보 | 우선순위 | 검증 수치 |
|----------------|------|-----------|---------|----------|
| Summary2-8 | Brier Score 개념 (0=완벽, 0.25=랜덤) | Brier Score 계산 추가 | P0 | — |
| Summary2-11 | Platt Scaling / Isotonic Regression 비교 | CalibratedClassifierCV 래핑 | P0 | **Brier -28%** (0.332→0.239) |
| Summary2-12, 13 | rule STRONG_BULL 44.4점 ↔ ML BEARISH 상충 | mean-reversion 경고 플래그 | P1 | 실제 충돌 케이스 확인 |
| Summary2-7 | 5-fold Accuracy 45.2%~64.4% (σ=7.7%) | Fold별 대시보드 노출 | P1 | 편차로 체제 변화 감지 |
| Summary2-11 | Top 3 Feature (yield_spread 10.8%) | Feature Importance 시각화 | P2 | — |
| Summary2-5 | 상승 60% vs 하락 40% 클래스 불균형 | Sample Weight 편향 보정 | P2 | — |

**신규 P0 구현 프롬프트 예시**:

```
# 목표
us_market/index_predictor.py에 Brier Score + Platt Scaling 확률 보정 추가

# 근거
Summary2-11 (US_Market 프로젝트 실측): Brier 0.332 → 0.239 (-28% 개선)
Accuracy는 유지되면서 confidence_pct 값의 신뢰도만 대폭 향상

# 작업
1. sklearn.calibration.CalibratedClassifierCV(method='sigmoid') 래핑
2. train() 메서드에서 보정 전/후 Brier Score 로그 출력
3. predict_next_week() 결과에 confidence_pct가 캘리브레이션된 확률 반영
4. output/index_prediction.json에 "brier_score" 필드 추가

# 검증
- Brier Score before/after 비교 출력
- 목표: -25% 이상 개선
```

**의의**: 사용자의 외부 자료(Obsidian, 강의 HTML)에 **이미 검증된 수치**가 있으면 service-evolver가 신뢰도 높은 후보를 즉시 백로그에 추가할 수 있음. → memory.md Do's에 "외부 자료 스캔 패턴" 추가 완료.

---

## Part 6: 통합 파이프라인 + 스케줄러 + Verdict (2026-04-08 추가)

Summary2.md 반영으로 추가된 운영 체계 프롬프트.

### 6.1 통합 분석 파이프라인 (run_integrated_analysis.py)

**목적:** Phase 0/1/2/3 구조의 통합 파이프라인과 Verdict 판정 로직을 구현한다.
**교육 포인트:** regime+gate+ML 3개 시그널 종합 판정, Grade별 Action 매핑, incremental 데이터 업데이트

```
# 목표
Phase 0~3 통합 분석 파이프라인을 구현한다.

# 컨텍스트
- 선행 조건: market_regime.py, market_gate.py, index_predictor.py, smart_money_screener_v2.py 완성
- 출력: reports/daily_report_YYYYMMDD.json, reports/latest_report.json, logs/daily_run_YYYYMMDD.log

# 작업
Phase 0: 데이터 수집
  - data/us_daily_prices.csv staleness 체크 (파일 수정일 vs 오늘)
  - stale이면 incremental 다운로드 (누락된 날짜만 append)
  - 최신이면 skip

Phase 1: 시장 분석 (Market Timing)
  1. MarketRegimeDetector.detect() → regime + score + confidence
  2. run_market_gate() → gate (GO/CAUTION/STOP) + score
  3. IndexPredictor.predict_next_week() → SPY/QQQ 방향 + 확률

  Verdict 판정:
    - Regime OK + Gate GO + ML Bullish → GO
    - Regime crisis/risk_off or Gate STOP → STOP
    - 나머지 → CAUTION

Phase 2: 종목 선별
  1. Volume Analysis (S&P 500) — CSV에서 OHLCV 로드
  2. Smart Money Screening — 6-factor composite scoring
  3. Strategy/Setup 분류 (Trend/Swing/Reversal + Breakout/Pullback/Base)

Phase 3: 종합 리포트
  Action 매핑:
    GO + Grade A/B → BUY
    GO + Grade C → WATCH
    CAUTION + Grade A → SMALL BUY
    CAUTION + Grade B/C → WATCH
    STOP → HOLD

  출력: reports/daily_report_YYYYMMDD.json (verdict, stock_picks[].action, summary.action_distribution)

파일명: run_integrated_analysis.py
```

### 6.2 일일 스케줄러 (run_daily_scheduler.py)

**목적:** 매일 자동으로 통합 분석을 실행하고 결과를 저장하는 스케줄러를 구현한다.
**교육 포인트:** argparse CLI 설계, macOS crontab 등록, 로그 파일 관리

```
# 목표
run_integrated_analysis.py를 자동화하는 CLI 스케줄러를 구현한다.

# 컨텍스트
- 선행 조건: run_integrated_analysis.py 완성
- 출력: crontab 등록, 상태 확인

# 작업
1. argparse CLI:
   - (인자 없음): 1회 즉시 실행
   - --status: reports/latest_report.json에서 마지막 실행 정보 표시
   - --install-cron: macOS crontab 등록 (기본 06:00 KST, 월-금)
   - --time HH:MM: cron 시간 지정
2. cron 등록 시 기존 항목 중복 방지 (marker로 필터)
3. 로그는 logs/daily_run_YYYYMMDD.log에 자동 저장

파일명: run_daily_scheduler.py
```

### 6.3 Strategy/Setup 분류 (smart_money_screener_v2.py 확장)

**목적:** 기존 Grade(A~F) 체계에 Strategy + Setup 전략 분류를 추가한다.
**교육 포인트:** RSI/MACD/MA 기반 패턴 인식, 조건 분기 설계

```
# 목표
smart_money_screener_v2.py에 Strategy(Trend/Swing/Reversal) + Setup(Breakout/Pullback/Base) 분류를 추가한다.

# 컨텍스트
- 수정 파일: analyzers/smart_money_screener_v2.py
- 기존: Grade A~F + Accumulation/Distribution label
- 추가: strategy + setup 필드

# 작업
1. _classify_strategy_setup(tech, rs_vs_spy) 정적 메서드 추가
2. Strategy 분류:
   - RSI<30 or Death Cross → Reversal
   - MA Bullish + RS>0 → Trend
   - 나머지 → Swing
3. Setup 분류:
   - Golden Cross or (Bullish + RSI>60) → Breakout
   - Bullish + RSI 40~55 → Pullback
   - 나머지 → Base
4. calculate_composite_score() 결과에 strategy, setup 필드 추가
5. run_screening() CSV 출력에 strategy, setup 컬럼 포함

파일명: analyzers/smart_money_screener_v2.py
```

### 6.4 Incremental 데이터 업데이트 (us_data_pipeline.py 확장)

**목적:** 매일 전체 다운로드 대신, 누락된 날짜만 증분 업데이트하여 실행 시간을 단축한다.
**교육 포인트:** 파일 수정 시간 기반 staleness 체크, DataFrame concat + 중복 제거

```
# 목표
us_data_pipeline.py에 incremental update 기능을 추가한다.

# 컨텍스트
- 수정 파일: pipeline/us_data_pipeline.py
- 현재: run_full_collection()이 항상 전체 재다운로드
- 목표: stale 체크 후 증분 업데이트

# 작업
1. is_data_stale(output_dir) 메서드: CSV 파일 수정일이 오늘이 아니면 True
2. incremental_update(top_n, output_dir) 메서드:
   - 기존 CSV의 마지막 날짜 이후 데이터만 다운로드 (period="5d")
   - 새 데이터를 기존 CSV에 append
   - 중복 index 제거 (keep="last")
3. run_integrated_analysis.py에서 활용:
   - stale이면 incremental 시도
   - CSV 파일 없으면 full collection으로 fallback

파일명: pipeline/us_data_pipeline.py
```

### 6.5 대시보드 개선 (TradingView + Stagger Animation)

**목적:** 대시보드에 TradingView 차트 링크와 순차 등장 애니메이션을 추가한다.
**교육 포인트:** CSS @keyframes 애니메이션, animation-delay 활용, 외부 링크 처리 (target="_blank")

```
# 목표
dashboard/index.html에 TradingView 차트 링크와 stagger fade-in 애니메이션을 추가한다.

# 컨텍스트
- 수정 파일: dashboard/index.html
- Top 5 Alpha Picks + Top 10 테이블 대상

# 작업
1. CSS 추가:
   - @keyframes fadeInUp (opacity 0→1 + translateY 16px→0)
   - .animate-fade-in-up 클래스
   - .stagger-1 ~ .stagger-12 (animation-delay 0.05s 간격)
2. Top 10 테이블 행에:
   - animate-fade-in-up stagger-{i+1} 클래스 추가
   - TradingView 링크 버튼 (open_in_new 아이콘)
   - href="https://kr.tradingview.com/chart/?symbol={ticker}"
   - onclick="event.stopPropagation()" (행 클릭과 분리)
3. Top 5 Alpha Picks에도 동일 적용
4. dashboard/latest_report.json 심볼릭 링크 생성 (→ ../output/latest_report.json)

파일명: dashboard/index.html
```
