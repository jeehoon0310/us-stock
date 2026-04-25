**Part 7: 섹터 분석 & 옵션 플로우 --- 프롬프트 모음**

**1. 학습 규칙 (필독)**

각 프롬프트 실행 시 다음 3단계를 반드시 준수해야 합니다. 코드의 복잡성이
증가함에 따라 발생할 수 있는 오류를 사전에 차단하고 디버깅 효율을 높이기
위한 필수 절차입니다.

1.  **프롬프트 입력:** 제공된 프롬프트를 Claude Code에 복사하여
    입력합니다.

2.  **테스트 블록 실행:** 터미널 명령어를 통해 코드가 정상 작동하는지
    확인합니다.

3.  **체크리스트 확인:** 명시된 조건을 모두 통과한 경우에만 다음
    프롬프트로 진행합니다.

**테스트 실패 시 대처 방안**

- Claude Code에 에러 메시지를 복사한 후 수정을 요청합니다. (예: \"이
  에러 고쳐줘\")

- 해결되지 않을 경우 이전 프롬프트로 돌아가 생략된 요구사항이 없는지
  재검토합니다.

- 본 문서 하단의 \'트러블슈팅(Q&A)\' 섹션을 참고합니다.

**2. 모듈 개요 및 실전 활용 시나리오**

Part 1\~6 과정에서 도출된 투자 대상(워치리스트)과 위험도 기준을
바탕으로, 시장 자금의 흐름을 추적하는 3가지 모듈을 구축합니다.

**2.1. 구축 모듈 구성**

- **섹터 순환 (sector_rotation.py):** 경기
  사이클(초기/중기/후기/침체기)을 판단하여 투자 적합 섹터를 결정합니다.

- **섹터 히트맵 (sector_heatmap.py):** 110개 주요 종목의 등락을
  시각화하여 업종별 자금 유출입을 파악합니다.

- **옵션 플로우 (options_flow.py):** 기관 투자자들의 옵션
  포지션(콜/풋)을 분석하여 시장 방향성을 예측합니다.

**2.2. 실전 활용 시나리오**

**시나리오 A: 매일 아침 루틴 (시장 방향성 점검)**

sector_report.py 실행 → 현재 경기 국면 확인(예: Mid Cycle) → 주도 섹터
확인(예: XLK, XLC) → 옵션 시그널 확인(예: NVDA 매수세 집중, TSLA 매도세
집중) → 관심종목 등록 및 포지션 비중 조절

**시나리오 B: 어닝 시즌 (단기 변동성 대응)**

실적 발표 D-2 → P/C Ratio 분석(예: 0.42, Very Bullish) 및 Unusual Calls
발생 건수 확인 → 상승 서프라이즈 베팅 여부 판단 → 소규모 옵션 매수 또는
현물 일부 진입 (전체 자금의 2\~3% 이내 제한)

**시나리오 C: 시장 급락일 (공포 장세 대응)**

P/C Ratio 급등(예: 2.1, 극단적 공포) 및 VIX 지수 상승 확인 → 방어주(XLU,
XLP) 매수세 확인 → 관망세 유지 및 기술적 반등 확인 후 단계적 분할 매수
진행

**3. 프롬프트 실행 가이드**

사전 조건: Part 6까지의 코드 구현이 완료된 상태여야 합니다.

> **실행 환경:** 프로젝트 루트(`synology/us-stock/`)에서 아래 환경을 활성화 후 실행합니다.
> ```bash
> source .venv/bin/activate
> # 검증 테스트는 PYTHONPATH=src 를 명령어 앞에 붙여 실행
> ```

**프롬프트 1: SectorRotationTracker 클래스 기본 골격**

**목적:** 섹터 순환 추적을 위한 기본 클래스 및 변수 설정

**프롬프트 입력**

Plaintext

섹터 순환을 추적하는 SectorRotationTracker 클래스를 만들어 줘.

파일 경로: src/us_market/sector_rotation.py

요구사항:

\- 클래스명: SectorRotationTracker

\- \_\_init\_\_에서 data_dir 받기 (기본값 \'.\')

\- output_file: output/sector_rotation.json

\- SECTOR_ETFS 클래스 변수: 11개 SPDR 섹터 ETF 딕셔너리

\* XLK→Technology, XLF→Financials, XLV→Healthcare, XLY→Consumer Disc.,
XLP→Consumer Staples, XLE→Energy, XLI→Industrials, XLB→Materials,
XLRE→Real Estate, XLU→Utilities, XLC→Comm. Services

\- CYCLE_MAP 클래스 변수: 경기 4국면별 대표 ETF

\* Early Cycle: XLF, XLY, XLI

\* Mid Cycle: XLK, XLC, XLB

\* Late Cycle: XLE, XLRE

\* Recession: XLU, XLP, XLV

\- CYCLE_ANGLES: Early=45, Mid=135, Late=225, Recession=315 (시각화용)

\- 사이클 판단 가중치: phase_weight_1w=0.25, phase_weight_1m=0.40,
phase_weight_3m=0.35

\- \_load_regime_config()로 sector_rotation 키 읽어서 가중치 오버라이드

\- logging 사용

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_rotation import SectorRotationTracker

t = SectorRotationTracker()

print(\'SECTOR_ETFS 개수:\', len(t.SECTOR_ETFS))

print(\'CYCLE_MAP 국면:\', list(t.CYCLE_MAP.keys()))

print(\'가중치 합:\', t.phase_weight_1w + t.phase_weight_1m +
t.phase_weight_3m)

print(\'Recession ETFs:\', t.CYCLE_MAP\[\'Recession\'\])

\"

- **체크리스트:**

  - \[ \] 11 출력 확인 (XLK\~XLC 총 11개)

  - \[ \] 4개 국면 모두 표시 확인

  - \[ \] 가중치 합 1.0 확인

  - \[ \] ModuleNotFoundError 발생하지 않음

**프롬프트 2: 다기간 수익률 분석**

**목적:** 11개 섹터 ETF와 SPY의 5개 기간별 수익률 계산

**프롬프트 입력**

Plaintext

SectorRotationTracker에 get_multi_period_performance() 메서드를 추가해
줘.

요구사항:

\- 11개 섹터 ETF + SPY를 yfinance로 1년치 Close 가격 다운로드 (한 번에)

\- yfinance 세션: curl_cffi Session(impersonate="chrome") 사용 (rate-limit 방지, index_predictor.py 패턴 참조)

\- 5개 기간 수익률 계산: 1w(7일), 1m(30일), 3m(90일), 6m(180일),
12m(365일)

\- 각 기간별:

\* idx = max(0, len(prices) - days)로 시작점 결정

\* 수익률 = ((current / start) - 1) \* 100, round(2)

\- 각 ticker의 current_price와 name도 포함

\- 데이터 없는 ticker는 스킵

\- 에러 시 빈 dict 반환

\- 반환: {\'XLK\': {\'name\': \'Technology\', \'current_price\': 220.50,
\'1w\': 1.25, \'1m\': 3.80, \...}}

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_rotation import SectorRotationTracker

t = SectorRotationTracker()

perf = t.get_multi_period_performance()

print(\'반환 종목 수:\', len(perf))

print(\'키 샘플:\', list(perf.keys())\[:5\])

print(\'XLK 데이터:\')

for k, v in perf.get(\'XLK\', {}).items():

print(f\' {k}: {v}\')

\"

- **체크리스트:**

  - \[ \] 총 12개 키 반환 (11 섹터 + SPY)

  - \[ \] 각 ETF에 current_price / 1w / 1m / 3m / 6m / 12m 필드 존재
    여부

  - \[ \] 현재가가 현실적 범위 내에 있는지 확인 (\$30 \~ \$600)

  - \[ \] KeyError 발생 여부 및 빈 dict 반환 여부 점검 (실패 시 yfinance
    재호출 또는 업데이트 진행)

**프롬프트 3: 상대 강도 히스토리**

**목적:** SPY 대비 각 섹터의 주간 단위 상대 수익률 추적

**프롬프트 입력**

Plaintext

SectorRotationTracker에 calculate_relative_strength_history(weeks=12)
메서드를 추가해 줘.

요구사항:

\- 12주 + 여유분 일수의 데이터를 yfinance로 다운로드

\- 금요일 기준 주간 리샘플링: data.resample(\'W-FRI\').last()

\- SPY 대비 각 섹터의 주간 상대 수익률 계산

\- dates 리스트 (YYYY-MM-DD 문자열)

\- 반환 형태:

{

\'dates\': \[\'2025-12-05\', \'2025-12-12\', \...\],

\'XLK\': \[1.2, 0.8, 1.5, \...\],

\'XLF\': \[-0.3, 0.5, \...\],

\...

}

\- SPY 데이터 없으면 빈 dict 반환

\- 주간 데이터 2주 미만이면 빈 dict 반환

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_rotation import SectorRotationTracker

t = SectorRotationTracker()

rs = t.calculate_relative_strength_history(weeks=12)

print(\'dates 개수:\', len(rs.get(\'dates\', \[\])))

print(\'첫 주 / 마지막 주:\', rs\[\'dates\'\]\[0\], \'\~\',
rs\[\'dates\'\]\[-1\])

print(\'XLK 최근 3주 상대강도:\', rs.get(\'XLK\', \[\])\[-3:\])

print(\'XLE 최근 3주 상대강도:\', rs.get(\'XLE\', \[\])\[-3:\])

\"

- **체크리스트:**

  - \[ \] dates 개수가 12개(±1)인지 확인

  - \[ \] 날짜 형식이 YYYY-MM-DD인지 확인

  - \[ \] 주요 섹터 데이터가 리스트로 반환되는지 확인

  - \[ \] 값의 범위가 대략 -10 \~ +10 내외인지 확인 (초과 수익률)

**프롬프트 4: 경기 사이클 판단 메서드**

**목적:** 섹터 수익률 가중 평균을 통한 현재 경기 국면 도출

**프롬프트 입력**

Plaintext

SectorRotationTracker에 detect_cycle_phase(performance) 메서드를 추가해
줘.

요구사항:

\- performance: get_multi_period_performance()의 반환값

\- 각 사이클 국면(Early/Mid/Late/Recession)에 대해 점수 계산:

\* 해당 국면 ETF들의 가중 평균 수익률

\* 가중치: 1w \* phase_weight_1w + 1m \* phase_weight_1m + 3m \*
phase_weight_3m

\- SPY 대비 초과 수익률도 계산 (상대 강도)

\- 가장 높은 점수의 국면을 현재 사이클로 판단

\- 반환:

{

\'current_phase\': \'Mid Cycle\',

\'phase_scores\': {\'Early Cycle\': 2.1, \'Mid Cycle\': 4.3, \...},

\'leading_sectors\': \[\'XLK\', \'XLC\'\],

\'lagging_sectors\': \[\'XLU\', \'XLP\'\],

\'angle\': 135

}

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_rotation import SectorRotationTracker

t = SectorRotationTracker()

perf = t.get_multi_period_performance()

cycle = t.detect_cycle_phase(perf)

print(\'현재 경기 국면:\', cycle\[\'current_phase\'\])

print(\'주도 섹터 Top 3:\', cycle\[\'leading_sectors\'\]\[:3\])

print(\'열위 섹터 Bot 3:\', cycle\[\'lagging_sectors\'\]\[:3\])

print(\'국면별 점수:\')

for phase, score in cycle\[\'phase_scores\'\].items():

print(f\' {phase:15s}: {score:+.2f}\')

\"

- **체크리스트:**

  - \[ \] current_phase가 4개 국면 중 하나인지 확인

  - \[ \] phase_scores에 4개 국면 점수가 모두 존재하는지 확인

  - \[ \] leading_sectors / lagging_sectors가 리스트 형식인지 확인

  - \[ \] phase_scores의 최고 점수 국면과 current_phase가 일치하는지
    확인 (참고: 기술주 강세장에서는 Mid Cycle이 지속 도출될 수 있음)

**프롬프트 5: SectorHeatmapCollector 클래스**

**목적:** 11개 섹터별 상위 10개 종목의 단기 등락폭 데이터 수집 및 저장

**프롬프트 입력**

Plaintext

섹터 히트맵 데이터를 수집하는 SectorHeatmapCollector 클래스를 만들어 줘.

파일 경로: src/us_market/sector_heatmap.py

요구사항:

\- \_\_init\_\_에서:

\* sector_etfs 딕셔너리: 11개 SPDR ETF + name + color
(Technology=#4A90A4, Financials=#6B8E23, Healthcare=#FF69B4,
Energy=#FF6347, Consumer Disc.=#FFD700, Consumer Staples=#98D8C8,
Industrials=#DDA0DD, Materials=#F0E68C, Utilities=#87CEEB, Real
Estate=#CD853F, Comm. Services=#9370DB)

\* sector_stocks 딕셔너리: 11개 섹터별 시총 상위 10개 종목 (실제 S&P500
기업)

\- get_sector_performance(period=\'1d\') 메서드:

\* period_map으로 yfinance 기간 매핑

\- yfinance 세션: curl_cffi Session(impersonate="chrome") 사용 (rate-limit 방지, index_predictor.py 패턴 참조)

\* 1d 기간일 때 5d 데이터를 받고 마지막 2일만 비교

\* 그 외 기간은 첫 날과 마지막 날 비교

\* 각 섹터: ticker, name, color, current_price, change_pct, volume

\- get_stock_performance(sector, period=\'1d\') 메서드:

\* sector_stocks에서 해당 섹터 종목 리스트 가져오기

\* 각 종목의 change_pct 계산

\* 반환: \[{ticker, name, change_pct, current_price, volume}\]

\- save_data(output_dir=None) 메서드:

\* get_sector_performance()로 11개 섹터 데이터 수집

\* metadata(generated_at, sectors_count) 추가

\* output/sector_heatmap.json에 저장

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_heatmap import SectorHeatmapCollector

import json, os

c = SectorHeatmapCollector()

perf = c.get_sector_performance(\'1d\')

print(\'섹터 수:\', len(perf))

print(\'첫 3개 섹터:\')

for s in perf\[:3\]:

print(f\\\" {s\[\'ticker\'\]}: {s\[\'change_pct\'\]:+.2f}%
(color={s\[\'color\'\]})\\\")

tech_stocks = c.get_stock_performance(\'Technology\', \'1d\')

print(f\'Technology 섹터 종목 수: {len(tech_stocks)}\')

print(f\'첫 종목: {tech_stocks\[0\] if tech_stocks else None}\')

c.save_data()

path = \'output/sector_heatmap.json\'

print(\'파일 생성:\', os.path.exists(path), os.path.getsize(path),
\'bytes\')

\"

- **체크리스트:**

  - \[ \] 11개 섹터 데이터 전체 반환 확인

  - \[ \] color(#HEX) 및 change_pct 필드 존재 여부 확인

  - \[ \] 개별 섹터 내 종목이 정상 도출되는지 확인

  - \[ \] JSON 파일이 0 byte가 아닌 크기로 정상 생성되었는지 확인

**프롬프트 6: OptionsFlowAnalyzer 클래스 기본 골격**

**목적:** 개별 종목의 옵션 체인 데이터(P/C Ratio, 거래량, 미결제약정)
수집

**프롬프트 입력**

Plaintext

옵션 플로우를 분석하는 OptionsFlowAnalyzer 클래스를 만들어 줘.

파일 경로: src/us_market/options_flow.py

요구사항:

\- \_\_init\_\_에서 data_dir 받기, self.watchlist =
self.\_load_from_screener()

\- \_load_from_screener(top_n=15):

\* output/picks/ 폴더에서 최신 smart_money_picks_YYYYMMDD.csv 파일을 glob으로 로드
  (예: sorted(glob.glob('output/picks/smart_money_picks_*.csv'))[-1])

\* 없으면 기본 15개: AAPL, NVDA, TSLA, MSFT, AMZN, META, GOOGL, SPY,
QQQ, AMD, NFLX, BA, DIS, COIN, PLTR

\- get_options_summary(ticker) 메서드:

\* yf.Ticker(ticker).options로 만기 리스트

\* 가장 가까운 만기의 option_chain 가져오기

\* 계산: total_call_volume, total_put_volume, total_call_oi,
total_put_oi

\* P/C Ratio (volume 기준, OI 기준)

\* max_call_strike, max_put_strike (OI 최대 행사가)

\* unusual_calls/puts: 평균 거래량 3배 초과

\* avg_call_iv, avg_put_iv (impliedVolatility \* 100)

\* \_interpret_signal()로 sentiment 해석

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.options_flow import OptionsFlowAnalyzer

a = OptionsFlowAnalyzer()

print(\'워치리스트 크기:\', len(a.watchlist))

print(\'워치리스트 Top 5:\', a.watchlist\[:5\])

s = a.get_options_summary(\'AAPL\')

if \'error\' in s:

print(\'에러:\', s\[\'error\'\])

else:

print(f\\\"AAPL 분석 결과:\\\")

print(f\\\" 현재가: \\\${s\[\'current_price\'\]:.2f}\\\")

print(f\\\" 만기일: {s\[\'expiration\'\]}\\\")

print(f\\\" P/C Volume Ratio: {s\[\'pc_vol_ratio\'\]:.2f}\\\")

print(f\\\" 총 콜 거래량: {s\[\'total_call_volume\'\]:,}\\\")

print(f\\\" 총 풋 거래량: {s\[\'total_put_volume\'\]:,}\\\")

print(f\\\" Max Call Strike: \\\${s.get(\'max_call_strike\',
\'N/A\')}\\\")

\"

- **체크리스트:**

  - \[ \] 워치리스트 15개 종목 로드 확인

  - \[ \] AAPL 옵션 데이터가 에러 없이 반환되는지 확인 (장 마감/주말 시
    에러 발생 가능)

  - \[ \] pc_vol_ratio 값의 유효성 (일반적으로 0.1\~3.0 범위)

  - \[ \] 거래량 수치가 0 이상인지 확인

**프롬프트 7: 옵션 시그널 해석**

**목적:** 옵션 지표를 기반으로 시장 참여자들의 심리(Sentiment)를
객관적으로 분류

**프롬프트 입력**

Plaintext

OptionsFlowAnalyzer에 \_interpret_signal(pc_vol_ratio, pc_oi_ratio,
unusual_calls, unusual_puts) 메서드를 추가해줘.

요구사항:

\- P/C Volume Ratio 기반 sentiment:

\* \< 0.5: \"Very Bullish\", score 90

\* 0.5\~0.7: \"Bullish\", score 70

\* 0.7\~1.0: \"Neutral\", score 50

\* 1.0\~1.3: \"Bearish\", score 30

\* \> 1.3: \"Very Bearish\", score 10

\- Unusual Activity 해석:

\* unusual_calls \> unusual_puts \* 2: \"Heavy Call Buying\"

\* unusual_puts \> unusual_calls \* 2: \"Heavy Put Buying\"

\* unusual_calls \> 3 or unusual_puts \> 3: \"High Unusual Activity\"

\* else: \"Normal Activity\"

\- 반환: {\'sentiment\': str, \'sentiment_score\': int, \'activity\':
str}

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.options_flow import OptionsFlowAnalyzer

a = OptionsFlowAnalyzer()

cases = \[

(\'Very Bullish\', 0.42, 0.60, 12, 2),

(\'Very Bearish\', 1.68, 1.45, 2, 15),

(\'Neutral\', 0.82, 0.90, 3, 2),

(\'High Unusual\', 0.75, 0.80, 4, 4),

\]

print(f\\\"{\'케이스\':15s} {\'P/C\':\>5s} \| {\'예상\':15s} /
{\'실제\':15s} \| {\'Activity\':25s}\\\")

print(\'-\'\*90)

for expected, pcv, pco, uc, up in cases:

r = a.\_interpret_signal(pcv, pco, uc, up)

status = \'✅\' if r\[\'sentiment\'\] == expected else \'❌\'

print(f\\\"{status} {expected:13s} {pcv:\>5.2f} \| {expected:15s} /
{r\[\'sentiment\'\]:15s} \| {r\[\'activity\'\]:25s}\\\")

\"

- **체크리스트:**

  - \[ \] 4개 케이스 모두 실제 출력과 일치하는지 확인 (실패 시 경계값
    조건 재검토)

  - \[ \] 4가지 Activity 상태가 모두 정상적으로 도출되는지 확인

**프롬프트 8: 옵션 워치리스트 분석 + 저장**

**목적:** 워치리스트 전체 종목의 옵션 데이터를 일괄 분석 및 기록

**프롬프트 입력**

Plaintext

OptionsFlowAnalyzer에 analyze_watchlist()와 save_data() 메서드를 추가해
줘.

analyze_watchlist():

\- self.watchlist의 모든 종목에 대해 get_options_summary() 호출

\- 에러 없는 결과만 수집

\- unusual_activity 카운트 합계(unusual_call_count + unusual_put_count)
내림차순 정렬

\- 반환: List\[Dict\]

save_data(output_dir=None):

\- analyze_watchlist() 결과 가져오기

\- metadata 추가:

{

\'metadata\': {

\'generated_at\': ISO timestamp,

\'stocks_analyzed\': len(data),

\'watchlist_source\': \'smart_money_picks_YYYYMMDD.csv\' 또는 \'default\'

},

\'data\': data

}

\- output/options_flow.json에 저장

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.options_flow import OptionsFlowAnalyzer

import json, os

a = OptionsFlowAnalyzer()

print(\'분석 시작\... (15종목, 1\~2분 소요)\')

a.save_data()

path = \'output/options_flow.json\'

print(\'파일 생성:\', os.path.exists(path))

with open(path) as f: d = json.load(f)

meta = d.get(\'metadata\', {})

data = d.get(\'data\', \[\])

print(f\\\"분석 종목 수: {meta.get(\'stocks_analyzed\')}\\\")

print(f\\\"소스: {meta.get(\'watchlist_source\')}\\\")

print(f\\\"\\\\nTop 3 Unusual Activity:\\\")

for i, item in enumerate(data\[:3\]):

print(f\\\" {i+1}. {item\[\'ticker\'\]:6s} \| P/C
{item.get(\'pc_vol_ratio\', 0):.2f} \| {item.get(\'activity\',
\'-\')}\\\")

\"

- **체크리스트:**

  - \[ \] JSON 파일이 정상적으로 생성되었는지 확인

  - \[ \] metadata.stocks_analyzed가 10 이상인지 확인

  - \[ \] 데이터 배열이 Unusual Activity 기준 내림차순으로 정렬되었는지
    확인

**프롬프트 9: 어닝 임팩트 분석**

**목적:** 실적 발표 전후의 과거 주가 반응과 현재 내재변동성(IV) 분석

**프롬프트 입력**

Plaintext

어닝 발표 영향을 분석하는 기능을 src/us_market/options_flow.py에 추가해 줘.

OptionsFlowAnalyzer에 analyze_earnings_impact(ticker) 메서드 추가:

요구사항:

\- yf.Ticker(ticker)로 접근

\- stock.calendar에서 다음 실적 발표일 확인

\- stock.earnings_history 또는 stock.quarterly_earnings에서 과거 4분기
실적 확인

\- 각 분기별:

\* 실적 발표일 전후 5일 주가 변동 계산

\* 서프라이즈 여부 (실적 \> 컨센서스)

\- 반환:

{

\'ticker\': ticker,

\'next_earnings_date\': \'2026-04-25\',

\'historical_reactions\': \[

{\'quarter\': \'Q4 2025\', \'surprise\': True, \'price_reaction_pct\':
5.2},

{\'quarter\': \'Q3 2025\', \'surprise\': False, \'price_reaction_pct\':
-3.1}

\],

\'avg_positive_reaction\': 6.5,

\'avg_negative_reaction\': -4.2,

\'current_iv\': 45.2

}

\- 데이터 없으면 빈 dict with error key

\- try-except로 모든 yfinance 에러 처리

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.options_flow import OptionsFlowAnalyzer

a = OptionsFlowAnalyzer()

result = a.analyze_earnings_impact(\'NVDA\')

if \'error\' in result:

print(\'에러:\', result\[\'error\'\])

else:

print(f\\\"종목: {result\[\'ticker\'\]}\\\")

print(f\\\"다음 실적: {result.get(\'next_earnings_date\', \'N/A\')}\\\")

print(f\\\"현재 IV: {result.get(\'current_iv\', \'N/A\')}%\\\")

print(f\\\"과거 반응 ({len(result.get(\'historical_reactions\',
\[\]))}분기):\\\")

for r in result.get(\'historical_reactions\', \[\])\[:4\]:

sign = \'📈\' if r\[\'price_reaction_pct\'\] \> 0 else \'📉\'

surprise = \'✅\' if r.get(\'surprise\') else \'❌\'

print(f\\\" {r\[\'quarter\'\]:10s} {surprise} surprise \| {sign}
{r\[\'price_reaction_pct\'\]:+.1f}%\\\")

print(f\\\"평균 상승 반응: +{result.get(\'avg_positive_reaction\',
0):.1f}%\\\")

print(f\\\"평균 하락 반응: {result.get(\'avg_negative_reaction\',
0):+.1f}%\\\")

\"

- **체크리스트:**

  - \[ \] next_earnings_date가 정상 규격(YYYY-MM-DD)인지 확인

  - \[ \] current_iv 수치 확인

  - \[ \] 예외 처리 로직 작동 여부 (소형주의 경우 데이터 부재 시 빈 dict
    처리)

**프롬프트 10: 통합 섹터 리포트 생성**

**목적:** 구축된 3가지 모듈의 데이터를 종합하여 최종 리포트 출력

**프롬프트 입력**

Plaintext

세 모듈을 통합하는 generate_sector_report() 함수를 만들어 줘.

파일: src/us_market/sector_report.py (신규)

요구사항:

\- SectorRotationTracker, SectorHeatmapCollector, OptionsFlowAnalyzer
임포트

\- generate_sector_report(data_dir=\'.\') 함수:

1\. SectorRotationTracker(data_dir):

\- get_multi_period_performance() → performance

\- detect_cycle_phase(performance) → cycle

\- calculate_relative_strength_history() → rs_history

2\. SectorHeatmapCollector():

\- get_sector_performance(\'1d\') → heatmap

3\. OptionsFlowAnalyzer(data_dir):

\- analyze_watchlist() → options_flow

4\. 결과 통합:

{

\'generated_at\': ISO timestamp,

\'sector_rotation\': {performance, cycle, rs_history},

\'sector_heatmap\': heatmap,

\'options_flow\': {

\'overall_sentiment\': 전체 평균 sentiment_score 기반,

\'stocks_analyzed\': len(options_flow),

\'unusual_activity_count\': unusual 종목 수,

\'details\': options_flow

}

}

5\. output/sector_report.json에 저장

6\. 결과 반환

\- 각 모듈 에러 시 해당 섹션만 빈 dict로 (전체 실패 방지)

**✅ 검증 테스트**

Bash

PYTHONPATH=src python -c \"

from us_market.sector_report import generate_sector_report

import json, os

report = generate_sector_report(data_dir=\'.\')

sections = \[\'sector_rotation\', \'sector_heatmap\', \'options_flow\'\]

for s in sections:

has = s in report and bool(report\[s\])

print(f\\\" {s}: {\'✅\' if has else \'❌\'}\\\")

print(\'\\\\n📊 요약\')

print(f\\\" 경기 국면:
{report\[\'sector_rotation\'\].get(\'current_phase\', \'N/A\')}\\\")

print(f\\\" 주도 섹터:
{report\[\'sector_rotation\'\].get(\'leading_sectors\',
\[\])\[:3\]}\\\")

print(f\\\" 옵션 심리:
{report\[\'options_flow\'\].get(\'overall_sentiment\', \'N/A\')}\\\")

print(f\\\" Unusual Activity:
{report\[\'options_flow\'\].get(\'unusual_activity_count\', 0)}건\\\")

path = \'output/sector_report.json\'

print(f\\\"\\\\n💾 파일: {path}\\\")

print(f\\\" 존재: {os.path.exists(path)}\\\")

print(f\\\" 크기: {os.path.getsize(path):,} bytes\\\")

\"

- **체크리스트:**

  - \[ \] 3개 통합 섹션(rotation / heatmap / options_flow) 정상 병합
    확인

  - \[ \] 생성된 파일의 용량이 10KB 이상인지 점검

  - \[ \] 특정 모듈 API 호출 실패 시에도 전체 시스템이 중단되지 않는지
    확인

**프롬프트 11: 단위 테스트**

**목적:** 구축된 로직의 안정성 검증 (yfinance 네트워크 호출 모킹)

**프롬프트 입력**

Plaintext

tests/test_sector_analysis.py를 만들어 줘.

테스트 목록:

1\. test_sector_etfs_count: SECTOR_ETFS가 11개인지

2\. test_cycle_map_coverage: CYCLE_MAP의 모든 ETF가 SECTOR_ETFS에
포함되는지

3\. test_cycle_angles: 4개 국면 모두 각도 값이 있는지

4\. test_phase_weights_sum: 3개 가중치 합이 1.0인지

5\. test_options_default_watchlist: 기본 워치리스트가 15개인지

6\. test_interpret_signal_bullish: pc_ratio 0.3에서 \"Very Bullish\"
반환하는지

7\. test_interpret_signal_bearish: pc_ratio 1.5에서 \"Very Bearish\"
반환하는지

8\. test_sector_stocks_count: 각 섹터의 종목 수가 10개인지

9\. test_heatmap_period_map: \'1d\' 기간이 \'5d\' fetch로 변환되는지

10\. test_heavy_call_buying: unusual_calls=10, unusual_puts=2일 때
\"Heavy Call Buying\"인지

yfinance API 호출은 monkeypatch로 모킹.

**✅ 검증 테스트**

Bash

pytest tests/test_sector_analysis.py -v

- **체크리스트:**

  - \[ \] 10개의 테스트가 모두 PASSED 상태인지 확인

  - \[ \] 실행 속도가 5초 미만인지 확인 (정상 모킹 여부)

**프롬프트 12: 전체 실행 스크립트**

**목적:** 통합 스크립트 실행 환경 구성

**프롬프트 입력**

Plaintext

src/us_market/sector_report.py에 if \_\_name\_\_ == \'\_\_main\_\_\' 블록을
추가해 줘.

실행 순서:

1\. generate_sector_report(data_dir=\'.\') 호출

2\. 결과 출력:

\- 현재 경기 국면

\- 주도 섹터 / 열위 섹터

\- 섹터 히트맵 상위/하위 3개

\- 옵션 전체 심리

\- Unusual Activity 종목 리스트

3\. output/sector_report.json 저장 확인

실행: python src/us_market/sector_report.py

**✅ 검증 테스트**

Bash

python src/us_market/sector_report.py

- **체크리스트:**

  - \[ \] 파이프라인 전체 에러 없이 구동 완료

  - \[
    \] output/sector_report.json, sector_heatmap.json, options_flow.json 3개
    파일 모두 정상 존재 확인

  - \[ \] 콘솔 출력에 주요 지표(경기 국면, 섹터 Top3, 옵션 심리) 모두
    표출 여부 점검

모든 검증 사항이 통과되었다면 해당 모듈 구축이 성공적으로 완료된
것이므로, 다음 단계인 Part 8(Flask API 서버 구성)로 진행합니다.

**4. 트러블슈팅 (Q&A)**

**Q1: yfinance에서 옵션 데이터가 반환되지 않습니다 (No options data).**

- 해당 종목에 옵션이 상장되지 않았거나 제공처에서 지원하지 않는
  소형주입니다. 에러를 딕셔너리로 반환하고 자동 스킵 처리되므로 시스템
  구동에는 지장이 없습니다.

**Q2: 옵션 분석 소요 시간이 깁니다.**

- API 구조상 옵션 체인 순차 다운로드로 인해 종목당 지연이
  발생합니다. top_n 파라미터를 하향 조정하거나 주요 ETF 중심의 제한적
  분석으로 속도를 개선할 수 있습니다.

**Q3: KeyError: \'impliedVolatility\' 에러가 발생합니다.**

- yfinance 라이브러리의 버전에 따라 반환 데이터프레임의 컬럼명이 상이할
  수 있습니다. opt.calls.columns를 출력하여 실제 명칭을 확인 후 코드를
  수정하십시오.

**Q4: 경기 사이클 판단이 장기간 \"Mid Cycle\"로 고정됩니다.**

- 주기적 상승 국면에서는 기술주 주도의 팩터가 장기간 유지되므로 정상적인
  출력입니다. 장기적 관점의 추세를 파악하기 위해 3개월(35%) 가중치가
  적용되어 있습니다.

**Q5: 상대 강도 데이터가 비어 있습니다.**

- 최소 12주 이상의 가격 데이터가 확보되지 않은 신규 상장 ETF거나
  파라미터 값이 데이터베이스 보유 기간을 초과했을 때
  발생합니다. weeks 수치를 조정하십시오.

**Q6: S&P 500 섹터 구성 종목(sector_stocks)의 최신화 주기는 어떻게
됩니까?**

- 지수 리밸런싱에 맞추어 연 1\~2회 시가총액 기준으로 직접 업데이트를
  수행해야 합니다.

**Q7: 거래량(Volume)과 미결제약정(Open Interest)의 차이는 무엇입니까?**

- Volume은 당일 발생한 신규 거래 활성도이며, Open Interest는 청산되지
  않고 누적된 포지션 규모를 뜻합니다. 양 지표가 모두 높다면 특정
  행사가에 자본이 강하게 집중되고 있음을 의미합니다.

**Q8: \'Max Pain\' 이론이란 무엇입니까?**

- 옵션 매도자(마켓 메이커)가 만기 시점에 가장 적은 손실을 보는 가격대를
  뜻합니다. 주가가 해당 가격으로 수렴하려는 경향성을 설명하는 이론이며,
  현 로직에서는 지표 참고용으로만 활용됩니다.

**Q9: 추출된 어닝 발표 일자가 실제와 다릅니다.**

- yfinance에서 제공되는 기업 일정 데이터의 무결성은 100% 보장되지
  않습니다. 실전 자금 투입 시 교차 검증(Nasdaq Calendar 등)을 필수적으로
  진행해야 합니다.

**Q10: P/C Ratio의 극단적 수치를 역발상 전략으로 활용할 수 있습니까?**

- 가능합니다. P/C \> 1.5는 극단적 공포(매도 과열)로 단기 바닥 신호일
  확률이 높고, P/C \< 0.3은 탐욕(매수 과열) 구간으로 단기 고점 확률을
  내포합니다. 단독 사용보다 VIX 등 타 지표와의 복합적 검토를 권장합니다.
