이 프로젝트 폴더에 어떤 파일들이 있는지 목록으로 보여줘.
그리고 각 파일이 뭐하는 파일인지 한 줄로 설명해줘.

requests 라이브러리가 설치되어 있는지 확인해줘.
없으면 설치해주고,
설치 후에 네이버 메인 페이지의 HTML을 가져와서
제목(title) 태그 내용만 출력하는 코드를 만들어줘.

requests와 beautifulsoup4 라이브러리를 설치해줘.
그 다음, 아래 네이버 금융 "코스피 상승 종목" 페이지의 HTML을 가져와서
종목명(title)과 현재가, 등락률을 추출해줘.
URL: https://finance.naver.com/sise/sise_rise.nhn?sosok=0
결과는 보기 좋게 상위 10개만 표로 출력해줘.

방금 가져온 상위 10개 종목 데이터를 사용해서,
터미널에 "등락률 막대 그래프"를 그려줘.
막대는 샵(#)이나 별(*) 문자를 사용해서 길이를 표현해줘.
종목명 옆에 등락률 수치도 같이 표시해줘.

다시 전체 데이터를 가져와서 필터링을 해보자.
1. 현재가가 1,000원 이상이고
2. 등락률이 5% 이상인 종목만 뽑아줘.
3. 그리고 "등락률 높은 순"으로 정렬해서 보여줘.

필터링된 종목 중 가장 많이 오른 1등 종목의 이름을 가져와서,
네이버 뉴스에서 그 종목명으로 검색한 최신 뉴스 기사 제목 3개를 출력해줘.
링크도 같이 보여주면 좋아.

User-Agent 헤더를 추가해서 브라우저인 척하고 다시 요청해봐.

━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━

미국 S&P 500 종목 리스트를 수집하는 Python 스크립트를 만들어줘.
요구사항:
1. Wikipedia의 "List of S&P 500 companies" 페이지에서 pandas read_html로 테이블을 가져와
2. 컬럼: Symbol, Security, GICS Sector, GICS Sub-Industry
3. Symbol에서 '.'을 '-'로 변환해 (yfinance 호환: BRK.B → BRK-B)
4. 결과를 sp500_list.csv로 저장
5. 섹터별 종목 수를 출력
파일명: fetch_sp500_list.py
예상 결과:
위키피디아 크롤링

방금 만든 sp500_list.csv를 로드해서 다음을 검증하는 코드를 추가해줘:
1. 총 종목 수가 500개 이상인지 확인
2. 11개 GICS 섹터가 모두 포함되어 있는지 확인
3. Symbol에 '.'이 포함된 것이 없는지 확인
4. 중복 Symbol이 없는지 확인
5. 검증 결과를 출력
fetch_sp500_list.py의 맨 아래에 validate_sp500_list() 함수를 추가하고 실행해줘.

yfinance로 미국 주식 일봉 데이터를 수집하는 클래스를 만들어줘.
요구사항:
1. 클래스명: USPriceFetcher
2. __init__에서 yfinance import하고, curl_cffi가 설치되어 있으면 Session(impersonate="chrome")을 사용
3. fetch_ohlcv(symbol, period="1y") 메서드: 1년치 OHLCV 데이터를 pandas DataFrame으로 반환
4. fetch_batch(symbols, period="1y") 메서드: 여러 종목을 순차 수집, 종목 간 1초 sleep
5. 에러 발생 시 빈 DataFrame 반환하고 로깅
6. logging 모듈 사용 (print 금지)
참고 - 실제 프로덕션 코드 패턴:
try:
from curl_cffi import requests as curl_requests
self.yf_session = curl_requests.Session(impersonate="chrome")
except ImportError:
logger.info("curl_cffi not installed - may hit rate limits")
파일명: us_price_fetcher.py


us_price_fetcher.py의 USPriceFetcher를 테스트하는 코드를 만들어줘.
테스트 내용:
1. AAPL 1년치 데이터 수집 → 행 수가 200 이상인지 확인
2. OHLCV 5개 컬럼이 모두 있는지 확인
3. 존재하지 않는 티커 'ZZZZZ' 수집 시 빈 DataFrame이 반환되는지 확인
4. ['AAPL', 'MSFT', 'GOOGL'] 배치 수집 → 3개 모두 데이터가 있는지 확인
파일명: test_price_fetcher.py (실행하면 테스트가 자동으로 돌아가게)

주식 OHLCV DataFrame에 기술적 지표를 추가하는 함수들을 만들어줘.
요구사항:
1. add_moving_averages(df): SMA_20, SMA_50, SMA_200 컬럼 추가
2. add_rsi(df, period=14): RSI 컬럼 추가 (Wilder's smoothing 방식)
3. add_atr(df, period=14): ATR 컬럼 추가
4. add_bollinger_bands(df, period=20, std_dev=2): BB_Upper, BB_Middle, BB_Lower, BB_Width 추가
5. add_all_indicators(df): 위 4개를 한 번에 적용
6. 모든 함수는 입력 df를 직접 수정하지 말고 copy를 반환
참고 - 실제 프로덕션 코드에서 이동평균 계산 패턴:
ma20 = float(series.rolling(20).mean().iloc[-1])
파일명: technical_indicators.py

technical_indicators.py의 함수들을 검증하는 코드를 만들어줘.
검증 내용:
1. AAPL 1년치 데이터에 add_all_indicators 적용
2. SMA_200의 처음 199행이 NaN인지 확인
3. RSI 값이 모두 0~100 범위인지 확인
4. ATR 값이 모두 양수인지 확인
5. BB_Upper > BB_Middle > BB_Lower가 항상 성립하는지 확인
6. 원본 DataFrame이 변경되지 않았는지 확인 (id 비교)
각 검증 결과를 PASS/FAIL로 출력
us_price_fetcher.py의 USPriceFetcher로 데이터를 수집해서 사용해줘.
파일명: test_indicators.py

FRED API와 웹 스크래핑으로 미국 매크로 경제 데이터를 수집하는 클래스를 만들어줘.
요구사항:
1. 클래스명: MacroDataCollector
2. __init__에서 FRED API 키를 환경변수(FRED_API_KEY)에서 로드
3. fetch_fred_series(series_id, start_date) 메서드: FRED에서 시계열 데이터 수집
4. fetch_interest_rates(): 연방기금금리(FEDFUNDS), 10년물(DGS10), 2년물(DGS2) 수집
5. fetch_vix(): yfinance로 ^VIX 데이터 수집
6. fetch_fear_greed(): CNN Fear & Greed API에서 현재 값 수집
7. get_macro_summary(): 모든 매크로 지표를 dict로 반환
참고 - 실제 프로덕션의 VIX 기반 시장 국면 분류:
VIX_BOUNDARIES = { 'risk_on': (0, 16), 'neutral': (16, 22), 'risk_off': (22, 30), 'crisis': (30, 999) }
FRED API 호출 예시: https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=YOUR_KEY&file_type=json
파일명: macro_collector.py

FRED API 키를 .env 파일로 관리하는 코드를 추가해줘.
요구사항:
1. python-dotenv를 사용해서 .env 파일에서 FRED_API_KEY를 로드
2. .env.example 파일도 만들어서 어떤 환경변수가 필요한지 문서화
3. macro_collector.py의 __init__에서 .env를 자동으로 로드하도록 수정
4. API 키가 없을 때 경고 메시지를 출력하되, 프로그램은 중단하지 않게
5. .env.example 내용: FRED_API_KEY=ad8fb164e441c9f76dd4bdf2676a3efb

macro_collector.py에 시장 국면(Market Regime)을 판별하는 메서드를 추가해줘.
요구사항:
1. classify_regime(vix_value) 메서드 추가
2. VIX 기준:
- 0~16: risk_on (위험 선호)
- 16~22: neutral (중립)
- 22~30: risk_off (위험 회피)
- 30 이상: crisis (위기)
3. get_macro_summary()의 반환값에 'regime' 키 추가
4. regime에 따른 투자 시사점을 한글 문자열로 반환하는 get_regime_description(regime) 메서드 추가
예시: risk_on: "시장이 안정적입니다. 공격적 포지션 가능."

11개 SPDR 섹터 ETF 데이터를 수집하고 섹터 분석을 수행하는 클래스를 만들어줘.
요구사항:
1. 클래스명: SectorAnalyzer
2. SECTOR_ETFS 딕셔너리: 11개 ETF 티커 → 섹터명 매핑
(XLK, XLF, XLE, XLV, XLY, XLP, XLI, XLB, XLRE, XLU, XLC)
3. fetch_all_sectors(period="1y"): 11개 ETF의 1년치 종가 수집 → DataFrame (날짜 x 11컬럼)
4. calculate_returns(): 1일, 5일, 20일, 60일 수익률 계산
5. get_sector_ranking(): 20일 수익률 기준 섹터 순위 반환
6. get_rotation_signal(): 방어주(XLU, XLP, XLV) vs 공격주(XLK, XLY, XLC) 상대강도 비교
수익률 계산:
1일: (오늘 종가 / 어제 종가) - 1
(5일, 20일, 60일도 동일한 공식 적용)
파일명: sector_analyzer.py

sector_analyzer.py에 섹터 수익률 히트맵 데이터를 생성하는 메서드를 추가해줘.
요구사항:
1. get_heatmap_data() 메서드: 11개 섹터 x 4개 기간(1일, 5일, 20일, 60일) 수익률 매트릭스 반환
2. 반환 형식: pandas DataFrame (인덱스: 섹터명, 컬럼: 1D, 5D, 20D, 60D)
3. 수익률을 퍼센트로 표시 (0.05 → 5.0)
4. to_heatmap_csv() 메서드: 히트맵 데이터를 sector_heatmap.csv로 저장
5. 가장 강한 섹터와 가장 약한 섹터를 출력
파일명: sector_analyzer.py에 메서드 추가

1-1부터 1-5까지 만든 모듈을 통합하는 데이터 수집 파이프라인을 만들어줘.
요구사항:
1. 클래스명: USDataPipeline
2. __init__에서 앞서 만든 모듈들을 초기화
3. run_full_collection() 메서드 순서:
a. S&P 500 종목 리스트 수집 → sp500_list.csv
b. 상위 50개 종목 OHLCV 수집 (시간 절약) → 종목별 지표 추가
c. 전체를 us_daily_prices.csv로 저장
d. 매크로 데이터 → us_macro.csv
e. 섹터 데이터 → us_sectors.csv
4. validate_data(df): 결측치 비율, 이상치(종가 0 이하) 체크
5. 수집 결과 요약 출력
저장 형식:
- us_daily_prices.csv: Symbol + Date를 MultiIndex로
- float은 소수점 4자리
- Date는 YYYY-MM-DD 형식
파일명: us_data_pipeline.py

us_data_pipeline.py의 USDataPipeline을 실행하는 간단한 실행 스크립트를 만들어줘.
요구사항:
1. 커맨드라인에서 python run_pipeline.py로 실행 가능
2. argparse를 사용하여 다음 옵션 추가:
- --top-n: 수집할 종목 수 (기본값 50)
- --period: 데이터 기간 (기본값 1y)
- --output-dir: 출력 디렉토리 (기본값 ./data)
3. 시작/종료 시각과 소요 시간을 출력
실행 예시: python run_pipeline.py --top-n 30 --period 6mo --output-dir ./output
파일명: run_pipeline.py
                  
방법 1: venv 활성화 후 실행
source .venv/bin/activate
python3 run_pipeline.py --top-n 30 --period 6mo                                                      
                                                                                       
방법 2: venv Python을 직접 지정
.venv/bin/python3 run_pipeline.py --top-n 30 --period 6mo

━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━

us_market이라는 폴더를 만들고, 그 안에 market_regime.py 파일을 생성해줘.
필요한 라이브러리를 import하고, MarketRegimeDetector 클래스의 기본 구조를 잡아줘.
yfinance, pandas, numpy, json, logging을 사용할 거야.
output 폴더에 결과를 저장할 예정이야.

MarketRegimeDetector 클래스에 _fetch_series 메서드를 추가해줘.
yfinance.download()로 특정 티커의 Close 가격 시계열을 가져오는 범용 함수야.
기본 기간은 6개월(period='6mo'), 실패하면 None을 반환하도록 해줘.
progress=False로 설정해서 불필요한 출력을 막아줘.

_vix_signal 메서드를 추가해줘. VIX 시계열을 입력받아서:
1. 현재 VIX 값 추출
2. 20일 이동평균 계산 (데이터 20일 미만이면 현재값 사용)
3. 추세 판단: current < ma20이면 'falling', 아니면 'rising'
4. 체제 분류: 0~16 risk_on, 16~22 neutral, 22~30 risk_off, 30+ crisis
이 경계값은 클래스 변수 VIX_BOUNDARIES로 정의해줘.
반환값은 딕셔너리: vix_current, vix_ma20, vix_trend, vix_regime

_trend_signal 메서드를 추가해줘. SPY Close 시계열을 입력받아서:
1. 현재가, 50일 SMA, 200일 SMA 계산
2. 200일 SMA의 20일 전 값과 비교하여 slope(기울기) 계산
3. 추세 분류:
- 가격 > 50일선 AND 가격 > 200일선 AND slope > 0 → risk_on
- 가격 > 200일선 (그 외) → neutral
- 가격 < 200일선 AND slope < 0 → risk_off
- 그 외 → neutral
4. 데이터가 200일 미만이면 neutral + data_insufficient=True 반환
반환값: trend_regime, spy_above_50, spy_above_200, sma200_slope

_breadth_signal 메서드를 추가해줘.
yfinance로 ^MMFI(NYSE 50일 MA 위 종목 비율)를 3개월치 가져와서:
- 70% 이상: risk_on
- 50~70%: neutral
- 30~50%: risk_off
- 30% 미만: crisis
데이터 수집 실패 시 {'breadth_pct': None, 'breadth_regime': 'neutral'} 반환.
logger.debug로 에러 로깅하되 시스템은 멈추지 않도록 해줘.

_yield_curve_signal 메서드를 추가해줘.
^TNX(10년 국채 금리)에서 ^IRX(13주 T-bill 금리)를 빼서 스프레드 계산:
- 스프레드 > 0.5: risk_on (정상적 금리 구조)
- 0 < 스프레드 <= 0.5: neutral
- 스프레드 < 0: risk_off (역전, 경기침체 경고)
실패 시 neutral 반환. 값은 소수점 둘째자리까지 반올림.

_credit_spread_signal 메서드를 추가해줘.
HYG(하이일드 회사채 ETF) / IEF(7-10년 국채 ETF) 비율을 계산:
1. 비율의 20일 이동평균 계산
2. 현재 비율 vs 20일 평균 비교:
- current > ma20 * 1.01: risk_on (위험 선호 증가)
- ma20 * 0.99 ~ ma20 * 1.01: neutral
- ma20 * 0.97 ~ ma20 * 0.99: risk_off
- current < ma20 * 0.97: crisis
둘 다 최소 20일 이상 데이터 필요. 실패 시 neutral.

detect_regime 메서드를 만들어줘. 위에서 만든 5개 신호를 가중 합산해서 최종 체제를 결정해.
1. ^VIX 3개월, SPY 1년 데이터 수집
2. 5개 신호 함수 호출 (데이터 없으면 neutral 기본값)
3. 점수 매핑: risk_on=0, neutral=1, risk_off=2, crisis=3
4. 가중치: vix 0.30, trend 0.25, breadth 0.18, credit 0.15, yield 0.12
5. 가중 합계로 최종 체제:
- < 0.75: risk_on
- 0.75~1.5: neutral
- 1.5~2.25: risk_off
- >= 2.25: crisis
6. Confidence: 5개 신호 중 다수결 일치 비율 (%)
7. 모든 결과를 딕셔너리로 반환

detect_regime 결과를 output/regime_config.json에 저장하는 기능을 추가해줘.
체제에 따라 다른 적응형 파라미터도 함께 저장해:
- risk_on: stop_loss -10%, max_drawdown_warning -12%
- neutral: stop_loss -8%, max_drawdown_warning -10%
- risk_off: stop_loss -5%, max_drawdown_warning -7%
- crisis: stop_loss -3%, max_drawdown_warning -5%
메인 실행 블록(if __name__ == '__main__')도 만들어서
python market_regime.py로 바로 실행 가능하도록 해줘.

market_gate.py 파일을 새로 만들어줘. 다음 함수들을 구현해:
1. calculate_rsi(series, period=14):
Wilder's Smoothing 사용 (ewm(alpha=1/period, adjust=False))
NaN이면 50.0 반환
2. calculate_macd_signal(series):
EMA12, EMA26으로 MACD 라인, EMA9로 시그널 라인 계산
크로스오버 감지: MACD가 시그널 위로 올라오면 "BULLISH", 아래로 내려가면 "BEARISH"
히스토그램이 빠르게 줄어들면(이전 대비 50% 미만) "NEUTRAL"
반환: "BULLISH" / "BEARISH" / "NEUTRAL"
3. calculate_volume_ratio(volume, period=20):
현재 거래량 / 20일 평균 거래량
이 함수들은 독립적으로(클래스 없이) 사용할 수 있게 일반 함수로 만들어줘.

market_gate.py에 다음을 추가해줘:
1. dataclass 2개:
- SectorResult: name, ticker, score, signal, price, change_1d, rsi, rs_vs_spy
- USMarketGateResult: gate(GO/CAUTION/STOP), score, reasons, sectors, metrics
2. SECTORS 딕셔너리: 11개 미국 섹터 ETF
Technology:XLK, Health Care:XLV, Financials:XLF, Cons Disc:XLY,
Cons Staples:XLP, Energy:XLE, Industrials:XLI, Materials:XLB,
Real Estate:XLRE, Utilities:XLU, Communication:XLC
3. 각 섹터 ETF에 대해 RSI, MACD, 거래량비율, SPY 대비 상대강도를 계산하고
종합 점수를 산출하는 함수
4. 전체 섹터 점수의 평균으로 게이트 판정:
- 70 이상: GO
- 40~70: CAUTION
- 40 미만: STOP

market_gate.py에 detect_volume_price_divergence(close, volume, lookback=10) 함수를 추가해줘.
10일간의 가격 변화와 거래량 추세를 비교해서:
- bearish_div: 가격 상승 + 거래량 12% 이상 감소 (매수세 약화)
- bullish_div: 가격 하락 + 거래량 12% 이상 감소 (매도세 소진)
- bearish_climax: 최근 2일 거래량이 20일 평균의 2배 이상 + 가격 상승 (블로오프 탑)
- bullish_climax: 최근 2일 거래량이 20일 평균의 2배 이상 + 가격 하락 (항복 매도)
- none: 특이사항 없음
Climax 감지를 먼저 하고, 그 다음 일반 다이버전스를 체크하도록 해줘.
가격 하락 + 거래량 15% 이상 증가는 bearish_div (적극적 매도 압력)로 처리해줘.

━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━

us_market 폴더에 data_fetcher.py 파일을 만들어줘.USStockDataFetcher 클래스를 만들어야 해.yfinance를 주요 데이터 소스로 사용하고, Finnhub을 fallback으로 써.__init__에서:- yfinance import 시도 (실패하면 yf_available=False)- curl_cffi가 있으면 Session(impersonate="chrome")으로 세션 생성- Finnhub API 키는 환경변수 FINNHUB_API_KEY에서 가져옴
- Alpha Vantage, FMP 키도 환경변수에서 확인get_history(ticker, period="3mo") 메서드:- yfinance로 주가 이력 DataFrame 반환- 실패 시 빈 DataFrame 반환get_info(ticker) 메서드:- yfinance Ticker(ticker).info 딕셔너리 반환- 실패 시 빈 딕셔너리 반환

us_market 폴더에 smart_money_screener_v2.py 파일을 만들어줘.EnhancedSmartMoneyScreener 클래스:- __init__(data_dir): output 경로 설정, USStockDataFetcher 초기화- volume_df, holdings_df, etf_df, spy_data를 None으로 초기화- _info_cache: Dict[str, Dict] = {} (API 캐시)from data_fetcher import USStockDataFetcher 로 import해줘.logging, pandas, numpy, yfinance, tqdm을 사용할 거야.

load_data() 메서드를 만들어줘.다음 파일들을 로드:1. output/us_volume_analysis.csv → self.volume_df (필수, 없으면 return False)2. output/us_13f_holdings.csv → self.holdings_df - filing_date 컬럼이 있으면 pd.to_datetime으로 변환 - 어제 이전에 제출된 데이터만 사용 (Look-ahead bias 방지) - 필터링된 수 로깅3. output/us_etf_flows.csv → self.etf_df4. data/us_stocks_list.csv → self.stocks_df (섹터 정보)5. SPY 3개월 데이터 → self.spy_data (self.fetcher.get_history("SPY", period="3mo"))
각 파일 로드 성공/실패를 logger.info/warning으로 기록해줘.모든 로드 완료 시 True 반환.

get_technical_analysis(ticker) 메서드의 RSI 계산 부분을 만들어줘.1. self.fetcher.get_history(ticker, period="1y")로 1년치 데이터2. 데이터가 50일 미만이면 _default_technical() 반환3. RSI 14일, Wilder's Smoothing 사용: - delta = close.diff() - gain = delta.where(delta > 0, 0).ewm(alpha=1/14, adjust=False).mean() - loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean() - rs = gain / loss - rsi = 100 - (100 / (1 + rs))_default_technical()도 만들어줘:rsi=50, macd=0, macd_signal=0, macd_histogram=0,ma20=0, ma50=0, ma_signal='Unknown', cross_signal='None',technical_score=50

get_technical_analysis에 MACD와 이동평균 분석을 추가해줘.MACD:- ema12 = close.ewm(span=12, adjust=False).mean()- ema26 = close.ewm(span=26, adjust=False).mean()- macd = ema12 - ema26- signal = macd.ewm(span=9, adjust=False).mean()
- histogram = macd - signal이동평균:- ma20, ma50 = 20일/50일 rolling mean- ma200 = 200일 rolling mean (데이터 부족 시 ma50 사용)- 배열: price > ma20 > ma50이면 "Bullish", price < ma20 < ma50이면 "Bearish", 나머지 "Neutral"Golden/Death Cross:- 현재 ma50 vs ma200와 5일 전 ma50 vs ma200 비교- ma50가 ma200 위로 돌파: "Golden Cross"- ma50가 ma200 아래로 돌파: "Death Cross"

get_technical_analysis의 마지막 부분으로 technical_score를 계산해줘.기본 50점에서 시작:RSI 점수:- < 30: +10 + int((30 - rsi) / 6) — 과매도 구간 스케일드- 30~45: +10- 45~60: +8- 60~70: +2- > 70: -5MACD 점수:- 히스토그램이 음→양 전환: +15 (Bullish crossover)- 히스토그램 양수: +8- 히스토그램 음수: -5MA 점수:- Bullish: +15- Bearish: -10- Golden Cross: +10- Death Cross: -15최종: max(0, min(100, tech_score))반환 딕셔너리: rsi, macd, macd_signal, macd_histogram,ma20, ma50, ma_signal, cross_signal, technical_score모든 값은 적절히 반올림(round).

get_fundamental_analysis(ticker) 메서드를 만들어줘.1. info = self._get_info_cached(ticker) 로 캐시된 정보 사용2. 추출할 필드: - trailingPE, forwardPE, priceToBook, priceToSalesTrailing12Months - revenueGrowth, earningsGrowth, profitMargins, returnOnEquity - marketCap, dividendYield 모든 필드에 `or 0` 처리 (None/빈값 방어)3. fundamental_score 계산 (기본 50점): - P/E 0~15: +15, 15~25: +10, >40: -10, <0(적자): -15 - 매출성장 >20%: +15, 10~20%: +10, 0~10%: +5, <0: -10 - ROE >20%: +10, 10~20%: +5, <0: -104. 시가총액 분류: >200B: "Mega Cap", >10B: "Large Cap", >2B: "Mid Cap", >300M: "Small Cap", 나머지: "Micro Cap"5. _default_fundamental()도 만들어줘 (에러 시 기본값)_get_info_cached(ticker) 메서드도 만들어줘:캐시에 없으면 self.fetcher.get_info(ticker) 호출, 있으면 캐시 반환.

get_analyst_ratings(ticker) 메서드를 만들어줘.info = self._get_info_cached(ticker) 에서:- longName 또는 shortName → company_name- currentPrice 또는 regularMarketPrice → 현재가- targetMeanPrice, targetHighPrice, targetLowPrice → 목표가- recommendationKey → 추천 (strongBuy/buy/hold/sell/strongSell)- numberOfAnalystOpinions → 애널리스트 수업사이드 = (targetMeanPrice - currentPrice) / currentPrice * 100analyst_score (기본 50점):- strongBuy: +15, buy: +10, hold: +0, sell: -10, strongSell: -15- 업사이드 > 30%: +10, 10~30%: +5, 0~10%: +2, 음수: -10- 애널리스트 > 10명: +5 (신뢰도 보정)반환: company_name, current_price, target_mean, target_high,target_low, upside_pct, recommendation, num_analysts, analyst_score에러 시 기본값 딕셔너리 반환.

get_relative_strength(ticker) 메서드를 만들어줘.SPY 대비 20일 수익률 차이를 계산:1. 해당 종목의 최근 20일 수익률 = (현재가 - 20일전가) / 20일전가 * 1002. SPY의 최근 20일 수익률 = (SPY현재가 - SPY 20일전가) / SPY 20일전가 * 1003. rs_vs_spy = 종목 수익률 - SPY 수익률self.spy_data가 None이면 0.0 반환.데이터가 20일 미만이면 가용한 기간으로 계산.결과는 소수점 첫째자리까지 반올림.

calculate_composite_score(ticker) 메서드를 만들어줘.6개 팩터 점수를 모두 가져와서 가중 합산:1. get_technical_analysis(ticker) → technical_score2. get_fundamental_analysis(ticker) → fundamental_score3. get_analyst_ratings(ticker) → analyst_score4. get_relative_strength(ticker) → rs_vs_spy (보정 후 0~100 스케일)5. volume_df에서 해당 ticker의 sd_score6. holdings_df에서 해당 ticker의 13f_scorecomposite_score = 가중 평균 (0~100)등급 분류:- 80+: "A" (Strong Accumulation)- 65~80: "B" (Moderate Accumulation)- 50~65: "C" (Neutral)
- 35~50: "D" (Moderate Distribution)- 20~35: "E" (Strong Distribution)- 20 미만: "F" (Capitulation)결과 딕셔너리에 모든 개별 점수와 등급 포함.

run_screening() 메서드와 if __name__ == '__main__' 블록을 만들어줘.run_screening():1. load_data() 호출 (실패 시 종료)2. volume_df의 모든 ticker를 tqdm으로 순회3. 각 ticker에 calculate_composite_score() 호출4. 결과를 리스트에 추가5. DataFrame 생성 → composite_score 내림차순 정렬6. 상위 20개만 선택7. output/smart_money_picks_v2.csv로 저장8. 결과 요약 로깅 (총 종목 수, 소요 시간, 상위 5개 미리보기)
메인 블록:screener = EnhancedSmartMoneyScreener(data_dir='.')screener.run_screening()

smart_money_picks_v2.csv의 품질을 검증하는 validate_results() 함수를 만들어줘.체크 항목:1. 파일 존재 여부2. DataFrame 행 수 > 03. 필수 컬럼 존재: ticker, composite_score, grade, technical_score, fundamental_score4. composite_score 범위: 0~1005. grade 값: A, B, C, D, E, F 중 하나6. 중복 ticker 없음7. NaN 값 비율이 20% 미만각 체크 결과를 PASS/FAIL로 출력하고,모든 체크 통과 시 "검증 완료" 메시지 표시.


종목 전략 셋업 점수 등급 SD Tech Fund RS vs SPY 파이널 결과는 이렇게 나아야해 그리고 py 실행 파일을 만들어주고 우리가 실행하면 진행과정을 나오도록 설계를해줘

결과는 result 폴더 만들어서 csv로 저장하게 해주고 양식은 그날의 일자를 기록해줘

━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━━━━━

ai_summary_generator.py 파일을 만들어줘.먼저 NewsCollector 클래스부터.__init__(self, finnhub_key=None):- headers에 User-Agent 설정 (브라우저 흉내)- finnhub_key는 인자 또는 환경변수 FINNHUB_API_KEYget_yahoo_news(self, ticker, limit=3):- import yfinance as yf- stock = yf.Ticker(ticker)- stock.news에서 title, publisher, link 추출- providerPublishTime을 datetime으로 변환해서 'YYYY-MM-DD' 형식- 각 기사를 딕셔너리로: title, publisher, link, published, source='Yahoo'- 에러 시 빈 리스트 반환, logger.debug로 에러 기록

NewsCollector에 두 가지 메서드를 추가해줘.get_google_news(self, ticker, company_name=None, limit=3):- Google News RSS URL: https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en- query: company_name이 있으면 '"회사명" OR 티커 stock', 없으면 '티커 stock'- urllib.parse.quote로 URL 인코딩- xml.etree.ElementTree로 XML 파싱- item 태그에서 title, pubDate, link, source 추출- pubDate는 email.utils.parsedate_to_datetime으로 파싱- 에러 시 빈 리스트get_finnhub_news(self, ticker, limit=3):- API URL: https://finnhub.io/api/v1/company-news- 파라미터: symbol, from(7일전), to(오늘), token- 응답에서 headline, source, url, datetime, summary 추출- summary는 200자로 잘라서 포함- API 키 없으면 빈 리스트 반환- 타임아웃 10초

NewsCollector에 통합 메서드를 추가해줘.get_news_for_ticker(self, ticker, company_name=None):1. Yahoo 뉴스 (3개)2. Google 뉴스 (3개)3. Finnhub 뉴스 (API 키 있을 때만, 3개)4. 전체 합치기5. _deduplicate_news()로 중복 제거6. published 날짜 기준 내림차순 정렬7. 최대 8개만 반환_deduplicate_news(self, news):- 제목(title) 앞 50자를 소문자로 변환해서 비교- 이미 본 제목이면 건너뛰기- seen_titles = set() 사용

.env에 아래 api에 넣어줘
1. 구글 - https://aistudio.google.com/apikey
<REDACTED: GOOGLE_API_KEY — use .env>

2. GPT - https://platform.openai.com/api-keys
<REDACTED: OPENAI_API_KEY — use .env>

3. 퍼플랙시티
https://console.perplexity.ai/account/setup
<REDACTED: PERPLEXITY_API_KEY — use .env>

curl -X POST 'https://api.perplexity.ai/search' \
  -H "Authorization: Bearer <REDACTED: PERPLEXITY_API_KEY>" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Perplexity API Platform",
    "max_results": 3,
    "max_tokens_per_page": 256
  }' | jq

4. 핀허브 - https://finnhub.io/register
d78bpihr01qs9virn6rgd78bpihr01qs9virn6s0

GeminiSummaryGenerator 클래스를 만들어줘.__init__(self, api_key=None):- self.api_key = api_key or os.getenv('GOOGLE_API_KEY')- 없으면 ValueError- model = os.getenv('GEMINI_MODEL', 'gemini-3-flash-preview')- self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"generate_summary(self, ticker, data, news, lang='ko', macro_context=None):
- prompt = self._build_prompt(ticker, data, news, lang, macro_context)- POST 요청: base_url?key=api_key- body: contents: [{"role": "user", "parts": [{"text": prompt}]}] generationConfig: temperature: 0.3 maxOutputTokens: 4000 thinkingConfig: {"thinkingLevel": "low"}- timeout: 120초- 응답 파싱: candidates[0].content.parts에서 'thought' 아닌 것만 필터 text_parts = [p['text'] for p in parts if 'text' in p and not p.get('thought')]- Safety filter 시: fallback JSON- 에러 시: _get_fallback_json(ticker, reason)_get_fallback_json(self, ticker, reason):- JSON 문자열 반환: thesis=에러내용, catalysts=[], bear_cases=[], recommendation="HOLD", confidence=0

GeminiSummaryGenerator에 _build_prompt 메서드를 만들어줘.lang 파라미터에 따라 한국어/영어 프롬프트 생성.프롬프트에 포함할 내용:1. 매크로 컨텍스트 (macro_context가 있을 때): - VIX, 10Y 금리, 장단기 금리차, 시장 Breadth, 크레딧 리스크 - Fear & Greed 지수, 실질금리, 구리/금 신호 - "RISK_OFF/CRISIS 시 BUY 기준을 높이고 하락 시나리오 비중 강화" 지침2. 종목 정보: - ticker, 회사명, 현재가, 등급, 종합점수 - 수급 점수, 기관 보유율, RSI, MA Signal - P/E, 매출성장률, 목표가 대비, S&P 500 대비3. 최근 뉴스 (최대 5개, "[날짜] 제목" 형식)4. 응답 규칙 (반드시 JSON으로): - Evidence: 모든 주장에 [출처, 날짜] 필수 - Bear Cases: 반드시 3개 (매수 추천이라도) - Data Conflicts: 기술적 vs 펀더멘탈 vs 뉴스 충돌 명시5. JSON 구조: thesis, catalysts[{point, evidence}], bear_cases[{point, evidence}] x3, data_conflicts[], key_metrics{pe, growth, rsi, inst_pct}, recommendation(BUY/HOLD/SELL), confidence(0~100)

OpenAISummaryGenerator 클래스를 만들어줘.__init__(self, api_key=None):- self.api_key = api_key or os.getenv('OPENAI_API_KEY')- self.base_url = "https://api.openai.com/v1/chat/completions"- self.model = "gpt-5-mini"generate_summary(self, ticker, data, news, lang='ko', macro_context=None):- GeminiSummaryGenerator의 _build_prompt 재사용: gemini_gen = GeminiSummaryGenerator.__new__(GeminiSummaryGenerator) gemini_gen.api_key = "" prompt = gemini_gen._build_prompt(ticker, data, news, lang, macro_context)- POST 요청 (Authorization Bearer 헤더): model: "gpt-5-mini"
messages: {"role": "developer", "content": "You are a professional hedge fund analyst. Always respond with valid JSON only."} {"role": "user", "content": prompt} reasoning: {"effort": "medium"} max_completion_tokens: 8000 (주의: temperature 파라미터 넣지 마! — reasoning 모델은 temperature 미지원)- timeout: 120초- 응답: choices[0].message.content- 에러 시: _get_fallback_json

PerplexitySummaryGenerator 클래스를 만들어줘.__init__(self, api_key=None):- self.api_key = api_key or os.getenv('PERPLEXITY_API_KEY')
- self.base_url = "https://api.perplexity.ai/chat/completions"- self.model = "sonar-pro"generate_summary(self, ticker, data, news, lang='ko', macro_context=None):- 기본 프롬프트 = GeminiSummaryGenerator._build_prompt 재사용- 웹 검색 지시문 추가 (company_name = data.get('name', ticker)): "IMPORTANT — USE WEB SEARCH to find and verify: 1. Latest earnings report or guidance update for {ticker} ({company_name}) 2. Analyst rating changes in past 7 days 3. Insider trading (Form 4) in past 30 days 4. Breaking news/regulatory/product from past 48 hours 5. Short interest or unusual options activity Cite sources and dates. If no results: 'No recent data found'. Do NOT fabricate."- POST 요청: model: "sonar-pro" system: "Professional hedge fund analyst with real-time web data. JSON only. Never fabricate." temperature: 0.3, max_tokens: 4000, timeout: 90초- 응답: choices[0].message.content

get_ai_provider(provider='gemini') 팩토리 함수를 만들어줘.- 'gemini': GeminiSummaryGenerator()- 'openai': OpenAISummaryGenerator()- 'perplexity': PerplexitySummaryGenerator()- 그 외: ValueError(f"Unknown provider: {provider}")if __name__ == '__main__' 블록에 argparse CLI:--provider: 기본 'gemini'--top: 분석할 종목 수, 기본 20--ticker: 특정 종목만 분석 (선택)--lang: 'ko' 또는 'en', 기본 'ko'--refresh: store_true, 캐시 무시메인 로직:1. smart_money_picks_v2.csv 로드2. --ticker 지정 시 해당 종목만, 아니면 상위 --top개3. NewsCollector로 뉴스 수집4. get_ai_provider(args.provider)로 AI 생성5. 각 종목 분석 (tqdm 진행바)6. output/ai_summaries.json에 저장

final_report_generator.py를 만들어줘.FinalReportGenerator 클래스:load_data():- output/smart_money_picks_v2.csv (없으면 FileNotFoundError)- output/ai_summaries.json (없으면 빈 딕셔너리)extract_ai_recommendation(summary):- 키워드 매칭으로 ai_score 계산: "적극 매수"/"strong buy": +20, recommendation="적극 매수" "조정 시 매수" (매수+조정): +15, "조정 시 매수" "매수"/"buy": +10, "매수" "과매수"/"overbought": -5 "조정 가능성": -3 "상승 추세"/"bullish": +5 "긍정적": +3, "성장": +3- (ai_score, recommendation) 튜플 반환calculate_final_score(row, ai_summaries):- quant_score = row.composite_score- AI가 있으면 extract_ai_recommendation 호출- ai_contribution = min(max(0, ai_score), 10) * 0.5- final_score = quant_score * 0.9 + ai_contribution- 모든 정보를 딕셔너리로 반환generate_report():- 모든 종목에 calculate_final_score- final_score 내림차순 → 상위 10개- output/final_top10_report.json 저장

전체 파이프라인을 한 번에 실행하는 run_full_pipeline.py 스크립트를 만들어줘.1. MarketRegimeDetector().detect_regime() → regime_config.json2. EnhancedSmartMoneyScreener().run_screening() → smart_money_picks_v2.csv3. AI 분석 (기본 Gemini) → ai_summaries.json4. FinalReportGenerator().generate_report() → final_top10_report.json각 단계의 소요 시간 로깅.한 단계 실패해도 다음 단계 계속 진행 (가능한 범위에서).최종 요약: 시장 체제, 분석 종목 수, Top 10 미리보기.

AI 응답을 안전하게 JSON으로 파싱하는 유틸리티 함수를 만들어줘.parse_ai_response(text):1. 텍스트에서 JSON 부분만 추출 (```json ... ``` 블록이 있으면 내부만)2. json.loads() 시도3. 실패하면 정규식으로 { ... } 블록 추출 시도4. 그래도 실패하면 None 반환validate_ai_response(parsed):- 필수 키 확인: thesis, recommendation, confidence- bear_cases가 3개인지 확인 (부족하면 경고)- confidence가 0~100 범위인지 확인- recommendation이 BUY/HOLD/SELL 중 하나인지 확인- 검증 통과 시 True, 실패 시 False + 이유 로깅

AI API 호출 비용을 추적하는 기능을 추가해줘.각 Provider의 generate_summary 응답에서 토큰 사용량을 추출:- Gemini: usageMetadata.promptTokenCount, candidatesTokenCount
- GPT-5-mini: usage.prompt_tokens, completion_tokens- Perplexity: usage.prompt_tokens, completion_tokens누적 토큰 사용량과 예상 비용을 로깅:- Gemini flash: 무료 (일 한도 있음, 초과 시 $0.10/1M input)- GPT-5-mini: $0.15/1M input, $0.60/1M output- Perplexity sonar-pro: ~$3/1000 requests실행 끝에 총 비용 요약 출력.

우리 시스템에 있는 플러그인 프론트 엔트를 사용해서 /Users/frindle/workspace/education/us-stock/output에 있는 데이터를 기반으로 주식 사이트 상위버전의 웹사이트를 만들어줘. 웹에서 검색한 다음에 최근 가장 트렌드한 디자인을 

지금까지 작업한 모든 내용(아래 내용, 웹사이트) 포함해서
{
    ⏺ 모든 테스트 통과. 구현 완료.

  변경 사항:

  - analyzers/ai_summary_generator.py — APIUsageTracker 클래스 추가 + 모듈 레벨 usage_tracker 싱글턴
    - GeminiSummaryGenerator: usageMetadata.promptTokenCount/candidatesTokenCount 추출
    - OpenAISummaryGenerator: usage.prompt_tokens/completion_tokens 추출
    - PerplexitySummaryGenerator: usage.prompt_tokens/completion_tokens 추출
    - __main__ 블록 끝에 usage_tracker.print_summary() 호출
  - run_full_pipeline.py — 파이프라인 종료 시 usage_tracker.print_summary() 호출

  비용 단가:

  ┌──────────────────┬──────────────────────────────┬──────────┐
  │     Provider     │             입력             │   출력   │
  ├──────────────────┼──────────────────────────────┼──────────┤
  │ Gemini Flash     │ $0.10/1M (무료 한도 초과 시) │ $0.40/1M │
  ├──────────────────┼──────────────────────────────┼──────────┤
  │ GPT-5-mini       │ $0.15/1M                     │ $0.60/1M │
  ├──────────────────┼──────────────────────────────┼──────────┤
  │ Perplexity Sonar │ $3/1K requests               │ —        │
  └──────────────────┴──────────────────────────────┴──────────┘

✻ Worked for 1m 47s
}
/Users/frindle/workspace/education/us-stock/docs/architecture.drawio
/Users/frindle/workspace/education/us-stock/docs/README.md
반영해줘. ultrathink
