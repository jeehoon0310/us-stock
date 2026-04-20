# US Stock Market Analysis System — Windows 완전 구축 가이드

## 이 프롬프트 사용 방법

Claude Code의 **Plan Mode**에서 이 파일 전체를 붙여넣고 실행하세요.
Phase 0부터 Phase 9까지 순서대로 진행하며, 각 Phase 완료 후 검증 명령을 실행해 정상 동작을 확인합니다.

- **Plan Mode 진입**: `Shift+Tab` (또는 `/plan`)
- **실행 환경**: Windows 10 / 11 (PowerShell 7 권장, winget 지원 버전)
- **전체 예상 소요시간**: 약 2~3시간 (인터넷 속도 및 API 응답 시간에 따라 변동)
- **모든 PowerShell 명령은 관리자 권한으로 실행하세요.**

---

## 시스템 개요

미국 주식 분석 시스템. 5개 파트로 구성:

- **Part 1**: S&P 500 데이터 수집 (yfinance + FRED)
- **Part 2**: 시장 체제 감지 (5-sensor 가중 투표)
- **Part 3**: 스마트머니 스크리닝 (6-factor 복합 점수)
- **Part 4**: AI 분석 리포트 (Gemini / OpenAI / Perplexity)
- **Part 5**: Next.js 대시보드 (13개 페이지)

평일 07:00에 Task Scheduler로 자동 실행되며, 결과는 SQLite DB와 JSON 파일로 저장됩니다.

### 최종 디렉토리 구조

```
us-stock\
├── src\
│   ├── collectors\          # 데이터 수집
│   ├── analyzers\           # 분석 엔진
│   ├── ml\                  # ML 파이프라인
│   │   ├── pipeline\
│   │   ├── features\equity\
│   │   ├── features\macro\
│   │   └── validation\
│   ├── us_market\           # 지수 예측 + 리스크
│   ├── db\                  # SQLite 연동
│   └── pipeline\            # 파이프라인 설정
├── scripts\                 # 실행 스크립트
├── frontend\                # Next.js 15
│   ├── app\                 # App Router 페이지
│   ├── src\components\
│   └── src\lib\
├── tests\
├── output\                  # 분석 결과
├── data\                    # 원시 데이터
├── logs\
└── .claude\agents\          # 에이전트 정의
```

---

## 🤖 Claude Code 설치 (이 프롬프트 실행 전 필수)

Claude Code는 터미널에서 동작하는 AI 코딩 에이전트입니다. 이 프롬프트를 실행하려면 먼저 Claude Code를 설치하고 Plan Mode를 활성화해야 합니다.

> **Claude란?** Anthropic이 개발한 AI로, 단순 답변을 넘어 함께 고민하는 지적 파트너 역할을 합니다. 특히 Opus 4.6은 SWE-bench 80.8%, BrowseComp 84.0%를 기록한 실전형 에이전트 모델입니다.

> ⚠️ **Claude Code는 macOS에 최적화**되어 있습니다. Windows에서는 **WSL2 (Windows Subsystem for Linux)** 환경에서 실행해야 합니다.

### 구독 플랜 선택

| 플랜 | 가격 | 사용량 | 추천 대상 |
|------|------|--------|-----------|
| **Pro** | $20/월 | 기본 | 입문자, 이 프로젝트 구축 ✅ |
| **Max 5x** | $100/월 | 5배 | 헤비 유저, 병렬 개발 |
| **Max 20x** | $200/월 | 20배 | 팀/전문가 |
| **API** | 사용량 기반 | 무제한 | 평균 $6/일 (90%가 $12 미만) |

> 이 프로젝트 구축에는 **Pro ($20/월, 약 2~3만 원)** 으로 충분합니다. 커피 3~4잔 값으로 AI 주니어 개발자를 고용하는 셈입니다.

### Windows 설치 순서

**Step 1. WSL2 설치** (PowerShell — 관리자 권한)

```powershell
# WSL2 설치
wsl --install

# 설치 후 PC 재부팅, Ubuntu 최초 실행 시 사용자 이름/비밀번호 설정
```

> **WSL2란?** Windows 안에서 Linux(Ubuntu)를 실행하는 가상 환경입니다. Claude Code는 이 환경에서만 정상 동작합니다.

**Step 2. 이후 모든 작업은 WSL Ubuntu 터미널에서 진행**

```bash
# Windows 시작 메뉴 → "Ubuntu" 검색 → 실행
# 또는 PowerShell에서: wsl
```

**Step 3. bun 설치** (WSL Ubuntu 터미널)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version   # 설치 확인
```

**Step 4. Claude Code 설치** (WSL Ubuntu 터미널)

```bash
npm install -g @anthropic-ai/claude-code
claude --version   # 설치 확인
```

**Step 5. 최초 로그인**

```bash
claude   # 실행 → 브라우저 자동 열림 → Anthropic 계정 로그인 → 터미널로 복귀
```

**Step 6. Plan Mode로 이 프롬프트 실행**

```bash
# 1. 프로젝트 디렉토리 생성 및 이동 (WSL 홈 디렉토리 권장)
mkdir -p ~/workspace/us-stock && cd ~/workspace/us-stock

# 2. Claude Code 실행
claude

# 3. Shift+Tab 눌러 Plan Mode 진입 → [PLAN MODE] 표시 확인

# 4. 이 파일(windows_v2.md) 전체 내용 복사 → 붙여넣기 → Enter

# 5. Claude가 전체 구축 계획 작성 → 검토 후 승인 → Phase 0부터 자동 진행
```

> **팁:** WSL 안의 파일은 Windows 탐색기에서 `\\wsl$\Ubuntu\home\{사용자명}\workspace\us-stock` 경로로 접근할 수 있습니다.

### 핵심 명령어

| 단축키 / 명령 | 기능 |
|--------------|------|
| `Shift + Tab` | **Plan Mode** 진입 — 코드 수정 없이 설계만 |
| `/model opus` | Opus로 전환 — 복잡한 설계·디버깅 시 사용 |
| `/model sonnet` | Sonnet으로 전환 — 일반 구현 (기본, 속도↑ 비용↓) |
| `/context` | 현재 토큰 사용량 확인 (비용 관리) |
| `/compact` | 컨텍스트가 가득 찼을 때 요약 압축 |
| `/init` | 프로젝트에 맞는 `CLAUDE.md` 자동 생성 |
| `Esc` | 현재 작업 중단 |
| `Esc + Esc` | 이전 상태로 되돌리기 (Rewind) |
| `y / n` | 파일 수정 권한 승인 / 거부 |

> **모델 전략:** 대부분의 Phase는 Sonnet(기본)으로 충분합니다. 오류가 반복되거나 아키텍처 설계가 필요할 때만 `/model opus`로 전환하세요.

---

## 시작 전 필수: API 키 발급 가이드

아래 사이트에서 API 키를 발급한 뒤 Phase 1의 `.env` 파일에 입력하세요.

| 키 | 필수 여부 | 발급 URL |
|----|-----------|----------|
| `FRED_API_KEY` | 필수 | https://fredaccount.stlouisfed.org/login/secure/ → API Keys 탭 |
| `GOOGLE_API_KEY` | AI 분석용 | https://aistudio.google.com/app/apikey → Create API Key |
| `OPENAI_API_KEY` | AI 분석용 | https://platform.openai.com/api-keys → Create new secret key |
| `PERPLEXITY_API_KEY` | AI 분석용 | https://www.perplexity.ai/settings/api → Generate |
| `FINNHUB_API_KEY` | 선택 | https://finnhub.io/dashboard → API key 탭 |

> AI 분석 키는 3개 중 1개 이상 있으면 됩니다. 우선순위: Gemini > OpenAI > Perplexity

---

## Phase 0: 시스템 환경 설치

> 예상 소요시간: 10~20분

### 목표

Python 3.13, Node.js 20 LTS를 설치하고 환경 변수를 등록합니다.

### 단계

PowerShell을 **관리자 권한**으로 실행 후 진행합니다.

```powershell
# winget으로 Python 3.13 설치
winget install Python.Python.3.13

# Node.js 20 LTS 설치
winget install OpenJS.NodeJS.LTS
```

설치 완료 후 PowerShell을 새로 열고 검증합니다.

### 검증

```powershell
python --version    # Python 3.13.x 확인
node --version      # v20.x.x 확인
npm --version       # 10.x.x 확인
```

---

## Phase 1: 프로젝트 초기화

> 예상 소요시간: 10~15분

### 목표

디렉토리 구조 생성, 가상환경 구성, 패키지 설치, `.env` 파일 설정.

### 단계

```powershell
# 작업 디렉토리 생성
New-Item -ItemType Directory -Force -Path C:\workspace\us-stock
Set-Location C:\workspace\us-stock

# 전체 디렉토리 구조 생성
$dirs = @(
    "src\collectors", "src\analyzers",
    "src\ml\pipeline", "src\ml\features\equity", "src\ml\features\macro", "src\ml\validation",
    "src\us_market", "src\db", "src\pipeline",
    "scripts", "tests",
    "output\picks", "output\reports", "output\models",
    "data", "logs",
    ".claude\agents\ai", ".claude\agents\equity", ".claude\agents\frontend",
    ".claude\agents\macro", ".claude\agents\mlops", ".claude\agents\model",
    ".claude\agents\performance", ".claude\agents\research",
    ".claude\agents\system", ".claude\agents\ingest"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d }

# __init__.py 생성
$initFiles = @(
    "src\__init__.py",
    "src\collectors\__init__.py",
    "src\analyzers\__init__.py",
    "src\ml\__init__.py",
    "src\ml\pipeline\__init__.py",
    "src\ml\features\__init__.py",
    "src\ml\features\equity\__init__.py",
    "src\ml\features\macro\__init__.py",
    "src\ml\validation\__init__.py",
    "src\us_market\__init__.py",
    "src\db\__init__.py",
    "src\pipeline\__init__.py"
)
foreach ($f in $initFiles) { New-Item -ItemType File -Force -Path $f }

# 가상환경 생성 및 활성화
python -m venv .venv
.venv\Scripts\activate
```

`requirements.txt` 파일을 생성합니다:

```
yfinance==1.2.0
fredapi==0.5.2
curl_cffi==0.13.0
pandas==3.0.2
numpy==2.4.4
scikit-learn==1.8.0
lightgbm==4.6.0
pyarrow==23.0.1
beautifulsoup4==4.14.3
requests==2.33.1
python-dotenv==1.2.2
matplotlib==3.10.8
seaborn==0.13.2
joblib==1.5.3
lxml==6.0.2
scipy==1.17.1
tqdm
optuna
```

```powershell
pip install -r requirements.txt
```

`.env` 파일을 생성합니다 (실제 키로 교체):

```
FRED_API_KEY=여기에_FRED_API_키_입력
GOOGLE_API_KEY=여기에_Gemini_API_키_입력
OPENAI_API_KEY=여기에_OpenAI_API_키_입력
PERPLEXITY_API_KEY=여기에_Perplexity_API_키_입력
FINNHUB_API_KEY=여기에_Finnhub_API_키_입력_선택사항
DATA_DB_PATH=output\data.db
```

### 검증

```powershell
.venv\Scripts\activate
python -c "import yfinance, lightgbm, fredapi, curl_cffi, pandas; print('패키지 설치 OK')"
```

---

## Phase 2: 데이터 수집기 구현 (src\collectors\)

> 예상 소요시간: 20~30분

### 목표

S&P 500 종목 리스트, OHLCV 데이터, 매크로 지표를 수집하는 모듈 구현.

### 단계

**2-1. `src\collectors\fetch_sp500_list.py`**

Wikipedia에서 S&P 500 종목 리스트를 파싱해 CSV로 저장합니다.

- `https://en.wikipedia.org/wiki/List_of_S%26P_500_companies` 에서 `pandas.read_html(url)[0]`으로 테이블 파싱
- Symbol 컬럼의 `.`을 `-`로 변환 (BRK.B → BRK-B)
- `data\sp500_list.csv` 저장 (Symbol, Security, GICS Sector, GICS Sub-Industry)
- `validate_sp500_list(df)` 함수: 행수 ≥ 500, GICS Sector 종류 ≥ 11, Symbol에 `.` 없음, 중복 없음 검증
- **주의**: `if __name__ == "__main__"` 가드 없이 작성 (파이프라인에서 직접 import 사용)

**2-2. `src\collectors\us_price_fetcher.py`**

```python
from curl_cffi import requests as cffi_requests
import yfinance as yf

class USPriceFetcher:
    MAX_RETRIES = 3

    def __init__(self):
        self.session = cffi_requests.Session(impersonate="chrome")

    def fetch_ohlcv(self, symbol: str, period: str = "1y") -> pd.DataFrame:
        """OHLCV 데이터 반환. 실패 시 빈 DataFrame."""
        # yf.download with session=self.session
        # exponential backoff retry (2**attempt 초 대기)
        # 빈 df 시 빈 DataFrame 반환 (절대 crash 없음)

    def fetch_batch(self, symbols: list, period: str = "1y") -> dict:
        """여러 종목 수집. 종목 간 1초 sleep. {symbol: df} dict 반환."""
```

**2-3. `src\collectors\macro_collector.py`**

```python
from fredapi import Fred

VIX_BOUNDARIES = {"risk_on": 16, "neutral": 22, "risk_off": 30}

class MacroDataCollector:
    def __init__(self):
        self.fred = Fred(api_key=os.getenv("FRED_API_KEY"))
        self.session = cffi_requests.Session(impersonate="chrome")

    def get_vix(self) -> dict:         # current_vix, ma20, trend
    def get_fred_data(self) -> dict:   # DFF, T10Y2Y, BAMLH0A0HYM2
    def get_fear_greed(self) -> dict:  # score, classification
    def get_macro_summary(self) -> dict  # 전체 합산
    def get_regime_from_vix(self, vix: float) -> str:  # risk_on/neutral/risk_off/crisis
```

**2-4. `src\collectors\data_fetcher.py`**

```python
class USStockDataFetcher:
    """yfinance → Finnhub fallback chain"""
    def get_history(self, ticker: str, period: str = "1y") -> pd.DataFrame
    def get_info(self, ticker: str) -> dict   # 기업 기본 정보
```

**2-5. `src\collectors\fetch_sp500_prices.py`**

```python
# ThreadPoolExecutor(max_workers=10) 병렬 수집
# fetch_with_retry(fetcher, symbol, output_dir, period)
# MAX_RETRIES=3, exponential backoff (2**attempt 초 대기)
# 결과: data\sp500_prices\ 디렉토리에 {symbol}.csv 저장
```

### 검증

```powershell
Set-Location C:\workspace\us-stock
.venv\Scripts\activate
python src\collectors\fetch_sp500_list.py
(Get-Content data\sp500_list.csv).Count   # 500+ 줄 확인

python -c @"
from src.collectors.us_price_fetcher import USPriceFetcher
p = USPriceFetcher()
df = p.fetch_ohlcv('AAPL')
print(f'AAPL 데이터: {len(df)}행, 컬럼: {list(df.columns[:5])}')
"@
```

---

## Phase 3: 분석 엔진 구현 (src\analyzers\)

> 예상 소요시간: 30~40분

### 목표

기술적 지표, 섹터 분석, 시장 체제 감지, 스크리닝, AI 요약 모듈 구현.

### 단계

**3-1. `src\analyzers\technical_indicators.py`**

```python
# 모든 함수: df.copy() 후 처리 → 원본 DataFrame 불변
def add_moving_averages(df) -> pd.DataFrame:   # SMA_20, SMA_50, SMA_200
def add_rsi(df, period=14) -> pd.DataFrame:    # Wilder's Smoothing (ewm alpha=1/period)
def add_atr(df, period=14) -> pd.DataFrame:    # Average True Range
def add_bollinger_bands(df, period=20, std=2) -> pd.DataFrame:  # BB_Upper/Middle/Lower/Width
def add_all_indicators(df) -> pd.DataFrame:    # 위 4개 일괄 적용
```

**3-2. `src\analyzers\sector_analyzer.py`**

```python
SECTOR_ETFS = {
    "Technology": "XLK", "Financials": "XLF", "Energy": "XLE",
    "Healthcare": "XLV", "Consumer Disc": "XLY", "Consumer Staples": "XLP",
    "Industrials": "XLI", "Materials": "XLB", "Real Estate": "XLRE",
    "Utilities": "XLU", "Communication": "XLC"
}
DEFENSIVE = ["XLU", "XLP", "XLV"]
OFFENSIVE = ["XLK", "XLY", "XLC"]

class SectorAnalyzer:
    def get_sector_returns(self) -> pd.DataFrame    # 1d/5d/20d/60d 수익률
    def get_rotation_signal(self) -> str            # offensive/defensive/neutral
    def get_ranked_sectors(self) -> pd.DataFrame    # 20일 수익률 기준 순위
```

**3-3. `src\analyzers\market_regime.py`**

5-sensor 가중 투표로 시장 체제를 판정합니다.

```python
class MarketRegimeDetector:
    WEIGHTS = {"vix": 0.30, "trend": 0.25, "breadth": 0.18, "credit": 0.15, "yield_curve": 0.12}
    THRESHOLDS = {"risk_on": 0.75, "neutral": 1.5, "risk_off": 2.25}

    def _vix_signal(self) -> tuple[float, dict]
    def _trend_signal(self) -> tuple[float, dict]    # SPY vs SMA50/SMA200
    def _breadth_signal(self) -> tuple[float, dict]  # RSP/SPY 상대강도
    def _credit_spread_signal(self) -> tuple[float, dict]  # HYG/IEF 비율
    def _yield_curve_signal(self) -> tuple[float, dict]    # ^TNX - ^IRX

    def detect(self) -> dict:
        # 5개 센서 신호 수집 → 가중 합산 → 체제 판정
        # regime: risk_on / neutral / risk_off / crisis
        # 결과: output\regime_result.json, output\regime_config.json 저장
```

적응형 파라미터:
- `risk_on`: stop_loss=-10%, max_drawdown=-12%
- `neutral`: stop_loss=-8%, max_drawdown=-10%
- `risk_off`: stop_loss=-5%, max_drawdown=-7%
- `crisis`: stop_loss=-3%, max_drawdown=-5%

**3-4. `src\analyzers\market_gate.py`**

```python
from dataclasses import dataclass

@dataclass
class SectorResult:
    name: str; ticker: str; score: float

@dataclass
class USMarketGateResult:
    gate: str  # GO / CAUTION / STOP
    sector_scores: list[SectorResult]
    avg_score: float
    volume_divergence: dict
    signals: dict

def calculate_rsi(prices, period=14) -> float
def calculate_macd_signal(prices) -> str       # bullish/bearish
def calculate_volume_ratio(volume_series) -> float  # 현재/20일평균

class USMarketGate:
    def analyze(self) -> USMarketGateResult:
        # 11섹터 각각 점수화 (RSI 30% + MACD 30% + Volume 20% + RS 20%)
        # 평균 ≥70 → GO, 40-70 → CAUTION, <40 → STOP

    def detect_volume_price_divergence(self) -> dict:
        # bearish_divergence, bullish_divergence, bearish_climax, bullish_climax
```

**3-5. `src\analyzers\smart_money_screener_v2.py`**

```python
class EnhancedSmartMoneyScreener:
    WEIGHTS = {
        "technical": 0.25, "fundamental": 0.20, "analyst": 0.15,
        "relative_strength": 0.15, "volume": 0.15, "institutional": 0.10
    }
    GRADES = {"A": 80, "B": 70, "C": 60, "D": 50}  # 이상이면 해당 등급

    def __init__(self):
        self._info_cache = {}   # 메모이제이션
        self.spy_data = None    # SPY 3개월 데이터

    def load_data(self):
        # sp500_list.csv 로드
        # look-ahead bias 방지: filing_date <= yesterday 조건 적용
        # SPY 3개월 데이터 로드

    def get_technical_analysis(self, ticker) -> float:   # 0-100
        # 기본 50점에서 시작
        # RSI<30 +10, MACD 골든크로스 +15, Bullish MA +15
        # max(0, min(100, score))

    def get_fundamental_analysis(self, ticker) -> float  # 0-100
    def get_analyst_ratings(self, ticker) -> float       # 0-100
    def get_relative_strength(self, ticker) -> float     # 0-100, vs SPY 20일
    def get_volume_score(self, ticker) -> float          # 0-100
    def get_institutional_score(self, ticker) -> float   # 0-100, 13F holdings

    def calculate_composite_score(self, ticker) -> dict:
        # 6개 팩터 가중 합산
        # 등급 판정: A(80+) / B(70+) / C(60+) / D(50+) / F(<50)
        # strategy: Trend / Swing / Reversal
        # setup: Breakout / Pullback / Base

    def run_screening(self, symbols=None) -> pd.DataFrame:
        # ThreadPoolExecutor 병렬 처리
        # 상위 20개 반환
        # output\picks\smart_money_picks_{YYYYMMDD}.csv 저장
```

**3-6. `src\analyzers\ai_response_parser.py`**

```python
REQUIRED_KEYS = ["thesis", "recommendation", "confidence"]
VALID_RECOMMENDATIONS = ["BUY", "HOLD", "SELL"]

def parse_ai_response(text: str) -> dict:
    # 1차: ```json ... ``` 블록 추출
    # 2차: { ... } raw JSON 파싱
    # 3차: 정규식으로 키-값 추출
    # 필수 키 검증, confidence 0-100 범위 강제
    # 실패 시 fallback dict 반환 (절대 crash 없음)
```

**3-7. `src\analyzers\ai_summary_generator.py`**

```python
class NewsCollector:
    def collect(self, ticker: str) -> list[dict]:
        # Yahoo Finance RSS: https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}
        # Google News RSS: https://news.google.com/rss/search?q={ticker}+stock
        # Finnhub API (FINNHUB_API_KEY 있을 때만)
        # 중복 제거 (제목 앞 50자 기준), 날짜 내림차순, 최대 8개

AI_OUTPUT_SCHEMA = {
    "thesis": str,          # 핵심 투자 논거 (50자 이상)
    "catalysts": list,      # 상승 촉매 3개
    "bear_cases": list,     # 하락 위험 3개 (필수)
    "data_conflicts": str,  # 데이터 간 모순
    "recommendation": str,  # BUY/HOLD/SELL
    "confidence": int       # 0-100
}

class GeminiSummaryGenerator:
    MODEL = "gemini-2.5-flash-preview-04-17"

    def generate(self, ticker, news, macro_context) -> dict:
        # temperature=0.3
        # _build_prompt(): VIX/10Y/Fear&Greed 포함
        # responseSchema=AI_OUTPUT_SCHEMA, responseMimeType="application/json"
        # 실패 시 _get_fallback_json(ticker) 반환

class OpenAISummaryGenerator:
    MODEL = "gpt-4o-mini"

class PerplexitySummaryGenerator:
    MODEL = "sonar-pro"
    # timeout=90초, 실시간 웹 검색 포함

def get_ai_provider(provider: str):
    # "gemini"     → GeminiSummaryGenerator
    # "openai"     → OpenAISummaryGenerator
    # "perplexity" → PerplexitySummaryGenerator
```

**3-8. `src\analyzers\final_report_generator.py`**

```python
class FinalReportGenerator:
    def load_data(self):
        # output\picks\smart_money_picks_v2.csv 로드
        # output\ai_summaries.json 로드

    def calculate_final_score(self, quant_score, ai_data) -> float:
        # final = quant_score * 0.9 + ai_contribution (최대 10점)
        # ai_contribution: "적극 매수" +20, "매수" +10, "과매수" -5 키워드 매칭

    def generate(self) -> dict:
        # Top 10 최종 리포트
        # output\final_top10_report.json 저장
```

### 검증

```powershell
.venv\Scripts\activate
python -c @"
from src.analyzers.market_regime import MarketRegimeDetector
d = MarketRegimeDetector()
result = d.detect()
print(f'체제: {result[`"regime`"]}, 점수: {result[`"weighted_score`"]:.2f}')
"@
```

---

## Phase 4: ML 파이프라인 구현 (src\ml\)

> 예상 소요시간: 25~35분

### 목표

피처 스토어, 매크로/주식 피처 빌더, GBM 학습/추론, Walk-Forward 검증 구현.

### 단계

**4-1. `src\ml\pipeline\feature_store.py`**

```python
class FeatureStore:
    def latest(self) -> pd.DataFrame:          # 최신 피처 parquet 로드
    def save(self, df: pd.DataFrame):          # 버전 스탬프 포함 저장
    def join_for_training(self) -> pd.DataFrame  # macro + equity join
    def _validate_no_leakage(self, df):        # 미래 데이터 참조 없음 검증
```

**4-2. `src\ml\features\macro\build_macro_features.py`**

```python
# FRED 25개 피처 생성
# 4가지 패턴:
# 1. Z-score: (x - rolling_mean) / rolling_std, shift(1) 필수 (look-ahead 방지)
# 2. Momentum: pct_change(20)
# 3. Spread: DGS10 - DGS2 (yield curve)
# 4. Regime Dummy: vix > 30 → crisis_dummy=1
# 저장: data\macro_features_{YYYYMMDD}.parquet
```

**4-3. `src\ml\features\equity\build_equity_features.py`**

```python
def build_features_per_ticker(df: pd.DataFrame) -> pd.DataFrame:
    # 40+ 기술 지표 피처
    # 모멘텀(6):    ret_1m, ret_3m, ret_6m, ret_12m, ret_1m_minus_12m, ret_6m_skip1m
    # 평균회귀(5):  rsi_14, bb_pct_b, distance_52w_high, distance_52w_low, z_score_60d
    # 변동성(6):    vol_20d, vol_60d, atr_14, beta_60d, realized_skew, realized_kurt
    # 거래량(4):    vol_ratio_20_60, dollar_volume, amihud_illiq, turnover_rate
    # MA교차(4):    price_ma20, price_ma50, ma20_slope, golden_cross
    # cross-sectional rank(pct=True) — look-ahead 방지 필수
```

**4-4. `src\ml\pipeline\train.py`**

```python
SEED = 42
TARGET_COLUMNS = ["fwd_5d_return", "fwd_20d_return", "fwd_60d_return", "fwd_5d_rank", "fwd_20d_rank"]

DEFAULT_LGBM_PARAMS = {
    "objective": "rank_xendcg",
    "metric": "ndcg",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "seed": SEED,
}

def train_model(features_df, target_col="fwd_20d_rank"):
    # TimeSeriesSplit(n_splits=5) 시계열 교차검증
    # early_stopping(patience=50)
    # Optuna HPO 50 trials (일요일만)
    # 모델 저장: models\lgbm_{target}_{YYYYMMDD}.pkl
    # 메타데이터: feature_hash(MD5), best_iteration, n_samples
```

**4-5. `src\ml\pipeline\predict.py`**

```python
def load_latest_model(target="fwd_20d_rank"):
    # models\lgbm_{target}_*.pkl 중 최신 로드

def predict_top_candidates(top_n=20) -> pd.DataFrame:
    # 최신 피처로 today 예측
    # 상위 top_n 반환
    # data\gbm_predictions.parquet 저장
```

**4-6. `src\ml\validation\walk_forward.py`**

```python
TRAIN_WINDOW = 730   # 2년
VAL_WINDOW   = 180   # 6개월
TEST_WINDOW  = 90    # 3개월
EMBARGO      = 20    # 20일 누출 방지 갭

def make_walk_forward_folds(dates, train_dates=TRAIN_WINDOW, test_dates=TEST_WINDOW, embargo_dates=EMBARGO)
def compute_pbo(oos_returns) -> float    # Probability of Backtest Overfitting (López de Prado)
def compute_dsr(sharpe, n_trials) -> float  # Deflated Sharpe Ratio
```

### 검증

```powershell
.venv\Scripts\activate
python src\ml\features\macro\build_macro_features.py
Get-ChildItem data\macro_features_*.parquet   # 파일 생성 확인
```

---

## Phase 5: DB + 리스크 모듈 구현

> 예상 소요시간: 15~20분

### 목표

SQLite 데이터 저장소, 지수 예측기, 리스크 모니터 구현.

### 단계

**5-1. `src\db\data_store.py`**

```python
import sqlite3, os

DB_PATH = os.getenv("DATA_DB_PATH", "output\\data.db")

# 11개 테이블 스키마
# 시계열 (date PK):  data_daily_reports, data_risk_alerts, data_prediction_history
# 스냅샷 (id=1 단일행): data_regime, data_market_gate, data_ai_summaries,
#                        data_gbm_predictions, data_index_prediction,
#                        data_risk, data_performance, data_graph

def get_db() -> sqlite3.Connection
def init_db(conn)          # 테이블 생성
def upsert_daily_report(conn, date, data: dict)
def upsert_regime(conn, data: dict)
def upsert_market_gate(conn, data: dict)
def get_latest_report(conn) -> dict
def get_reports_by_date(conn, date: str) -> dict
```

**5-2. `src\us_market\index_predictor.py`**

```python
FEATURE_NAMES = [
    # SPY 7개:   spy_return_1d, spy_return_5d, spy_rsi, spy_macd_signal,
    #             spy_bb_position, spy_volume_ratio, spy_atr_pct
    # VIX 3개:   vix_level, vix_change, vix_ma20_diff
    # QQQ 2개:   qqq_return_5d, qqq_spy_ratio
    # 시장폭 2개: advance_decline, new_high_low
    # 섹터 3개:   xlk_relative, xly_relative, xlu_relative
    # 매크로 3개: yield_curve, credit_spread, fear_greed
    # 거래량 3개: spy_volume_surge, sector_volume_trend, dark_pool_ratio
    # 모멘텀 4개: momentum_1m, momentum_3m, momentum_6m, roc_20
]  # 합계 27개

class IndexPredictor:
    def __init__(self, symbol="SPY"):
        self.symbol = symbol  # SPY 또는 QQQ
        self.model_path = f"output\\predictor_model_{symbol.lower()}.joblib"

    def train(self) -> dict:
        # GradientBoostingClassifier(n_estimators=150, max_depth=4, learning_rate=0.05)
        # TimeSeriesSplit(n_splits=5) 교차검증
        # predict_next_week 동반 학습 (Regressor도 함께)
        # 모델 저장: predictor_model_{symbol}.joblib

    def predict_next_week(self) -> dict:
        # direction:       bullish/bearish
        # probability:     0-1
        # confidence:      HIGH(≥0.70) / MODERATE(≥0.60) / LOW
        # predicted_return: float
        # key_drivers:     상위 5개 피처 이름
        # _save_prediction_history() 호출 (최대 100개 cap)
```

**5-3. `src\us_market\risk_alert.py`**

```python
class RiskMonitor:
    def calculate_portfolio_risk(self, picks_df, regime, gate) -> dict:
        # position_sizing, stop_loss, var_95, concentration

    def generate_alerts(self) -> list[dict]:
        # latest_report.json 읽어서 위험 신호 생성
        # SQLite data_risk_alerts 테이블에 저장
```

### 검증

```powershell
.venv\Scripts\activate
python -c @"
from src.db.data_store import get_db, init_db
conn = get_db()
init_db(conn)
print('DB 초기화 완료')
"@
```

---

## Phase 6: 통합 실행 스크립트 (scripts\)

> 예상 소요시간: 20~30분

### 목표

전체 파이프라인을 단계적으로 실행하는 스크립트 구현.

### 단계

**6-1. `scripts\run_screening.py`**

```python
# tqdm 진행 표시
# sp500_list.csv 전체 종목 스크리닝
# 결과: output\picks\smart_money_picks_{YYYYMMDD}.csv
# Top 20 콘솔 출력 (등급, 점수, 전략, 셋업 포함)
```

**6-2. `scripts\run_integrated_analysis.py`**

```python
# argparse: --date YYYY-MM-DD (기본: 오늘)

# Phase 0: 데이터 최신성 체크
#   - sp500_list.csv mtime > 7일이면 재수집
#   - us_daily_prices.csv mtime > 1일이면 incremental 다운로드

# Phase 1: Verdict 판정
#   - regime = MarketRegimeDetector().detect()
#   - gate   = USMarketGate().analyze()
#   - ml     = IndexPredictor("SPY").predict_next_week()
#   - ml_bullish = spy_direction=="bullish" and spy_accuracy>=0.55
#
#   Verdict 로직:
#   if regime in ("crisis", "risk_off") or gate.gate == "STOP":
#       verdict = "STOP"
#   elif regime == "risk_on" and gate.gate == "GO" and ml_bullish:
#       verdict = "GO"
#   else:
#       verdict = "CAUTION"

# Phase 2: 종목 선별 + Strategy/Setup 분류

# Phase 3: Action 매핑
#   GO + Grade A/B       → BUY
#   GO + Grade C+        → WATCH
#   CAUTION + Grade A    → SMALL BUY
#   CAUTION + others     → WATCH
#   STOP + any           → HOLD

# 결과: output\latest_report.json, SQLite upsert
```

**6-3. `scripts\run_full_pipeline.py`**

```python
# argparse: --steps 1,2,3,...  (기본: 전체)
# 9단계 파이프라인:
# Step 1: SP500 종목 리스트 수집
# Step 2: 주가 데이터 수집 (503종목)
# Step 3: Macro 피처 빌드
# Step 4: Equity 피처 빌드 (80+개)
# Step 5: AI 분석 (ThreadPoolExecutor max_workers=3)
# Step 6: 백테스트
# Step 7: GBM 추론 (predict_top_candidates)
# Step 8: IndexPredictor (SPY/QQQ)
# Step 9: Dashboard 데이터 export
#
# 단계 실패 시 continue (전체 중단 없음)
# 마지막에 API 비용 집계 출력
```

**6-4. `scripts\run_daily_scheduler.py`**

```python
# argparse: --status, --install-task, --time HH:MM
#
# --install-task:
#   schtasks 명령으로 Task Scheduler에 등록
#   평일 07:00 실행
#   또는 .bat 파일 생성 안내
```

**6-5. `scripts\regen_dashboard_data.py`**

```python
# output\data.db → frontend\public\data\*.json 동기화
# 생성 파일:
#   latest_report.json, regime_result.json, regime_config.json,
#   ai_summaries.json, final_top10_report.json, market_gate.json,
#   index_prediction.json, prediction_history.json, gbm_predictions.json,
#   performance.json, graph.json, dates_manifest.json
```

### 검증

```powershell
.venv\Scripts\activate
python scripts\run_integrated_analysis.py
Get-Item output\latest_report.json   # 파일 존재 및 크기 > 0 확인
```

---

## Phase 7: Next.js 프론트엔드 (frontend\)

> 예상 소요시간: 30~40분

### 목표

13개 페이지, API Routes, 공유 컴포넌트, i18n, SQLite 연결이 포함된 Next.js 15 대시보드 구현.

### 단계

**7-1. 초기화**

```powershell
Set-Location C:\workspace\us-stock
New-Item -ItemType Directory -Force -Path frontend
Set-Location frontend
npm init -y
```

**7-2. `package.json` 의존성 설정**

```json
{
  "name": "us-stock-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "clsx": "^2.1.1",
    "next": "^15.1.6",
    "next-themes": "^0.4.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-force-graph-2d": "^1.29.1",
    "recharts": "^3.8.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "postcss": "latest",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3"
  }
}
```

**7-3. 13개 페이지 생성 (`frontend\app\`)**

| 경로 | 설명 |
|------|------|
| `app\board\page.tsx` | Reddit 스타일 게시판 |
| `app\page.tsx` | 홈 대시보드 (Overview) |
| `app\regime\page.tsx` | 시장 체제 (5개 센서) |
| `app\top-picks\page.tsx` | Top 10 종목 |
| `app\ai\page.tsx` | AI 분석 리포트 |
| `app\forecast\page.tsx` | SPY/QQQ 방향 예측 |
| `app\ml\page.tsx` | GBM ML 리더보드 |
| `app\risk\page.tsx` | 리스크 모니터 |
| `app\performance\page.tsx` | 성과 추적 |
| `app\graph\page.tsx` | 종목 관계도 (ForceGraph) |
| `app\ai-builder\page.tsx` | AI 에이전트 실행 포털 |
| `app\download\page.tsx` | 자료 다운로드 |
| `app\costs\page.tsx` | API 비용 추적 (항상 마지막) |

**7-4. API Routes (`frontend\app\api\data\`)**

각 Route Handler는 better-sqlite3로 `output\data.db`를 쿼리해 JSON을 반환합니다.

```
reports\route.ts           # GET: 일일 리포트 목록
regime\route.ts            # GET: 시장 체제 데이터
market-gate\route.ts       # GET: 마켓 게이트
ai-summaries\route.ts      # GET: AI 요약
gbm-predictions\route.ts
index-prediction\route.ts
prediction-history\route.ts
performance\route.ts
graph\route.ts
risk\route.ts
risk-dates\route.ts
dates\route.ts             # GET: 리포트 날짜 목록
```

**7-5. 공유 컴포넌트 (`frontend\src\components\`)**

```
Navigation.tsx    # 13개 항목, costs 항상 마지막
HelpBtn.tsx       # 도움말 버튼 (35개 토픽)
ReportDateNav.tsx # 날짜 네비게이션 (← →)
LangProvider.tsx  # 한국어/영어 Context
LangToggle.tsx    # 언어 전환 버튼
ThemeProvider.tsx # 다크/라이트 테마
ThemeToggle.tsx   # 테마 전환 버튼
```

**7-6. `frontend\src\components\Navigation.tsx`**

> costs 항상 마지막 규칙 준수 필수

```typescript
const NAV = [
  { href: "/board",       labelKey: "nav.board"       },
  { href: "/",            labelKey: "nav.overview"    },
  { href: "/regime",      labelKey: "nav.regime"      },
  { href: "/top-picks",   labelKey: "nav.topPicks"    },
  { href: "/ai",          labelKey: "nav.ai"          },
  { href: "/forecast",    labelKey: "nav.forecast"    },
  { href: "/ml",          labelKey: "nav.ml"          },
  { href: "/risk",        labelKey: "nav.risk"        },
  { href: "/performance", labelKey: "nav.performance" },
  { href: "/graph",       labelKey: "nav.graph"       },
  { href: "/ai-builder",  labelKey: "nav.aiBuilder"   },
  { href: "/download",    labelKey: "nav.download"    },
  { href: "/costs",       labelKey: "nav.costs"       }, // 항상 마지막
];
```

**7-7. `frontend\src\lib\i18n.ts`**

한국어/영어 키-값 맵과 `useT()` hook을 제공합니다.
`nav.board`부터 `nav.costs`까지 모든 네비게이션 키 포함.

**7-8. `frontend\src\lib\db.ts`**

```typescript
import Database from "better-sqlite3";

const DB_PATH = process.env.DATA_DB_PATH ?? "..\\output\\data.db";
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) _db = new Database(DB_PATH, { readonly: true });
  return _db;
}
```

**7-9. 설정 파일 생성**

- `frontend\next.config.js`: App Router 설정
- `frontend\tsconfig.json`: TypeScript 설정
- `frontend\tailwind.config.js`: Tailwind CSS 설정
- `frontend\postcss.config.js`: PostCSS 설정
- `frontend\app\layout.tsx`: RootLayout (ThemeProvider + LangProvider 포함)
- `frontend\app\globals.css`: Tailwind base/components/utilities import

### 검증

```powershell
Set-Location C:\workspace\us-stock\frontend
npm install
npm run build   # TypeScript 에러 없음 확인

# 개발 서버 백그라운드 실행
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# 200 이면 정상
```

---

## Phase 8: 자동화 스케줄러 설정 (Task Scheduler)

> 예상 소요시간: 5~10분

### 목표

평일 07:00에 `run_integrated_analysis.py`를 자동 실행하는 Task Scheduler 작업 등록.

### 단계

PowerShell을 **관리자 권한**으로 실행합니다.

```powershell
# 가상환경 Python 경로 설정
$pythonPath = "C:\workspace\us-stock\.venv\Scripts\python.exe"
$scriptPath = "C:\workspace\us-stock\scripts\run_integrated_analysis.py"
$workDir    = "C:\workspace\us-stock"

# 액션 정의
$action = New-ScheduledTaskAction `
    -Execute $pythonPath `
    -Argument $scriptPath `
    -WorkingDirectory $workDir

# 평일 07:00 트리거
$trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday `
    -At 7am

# 작업 등록
Register-ScheduledTask `
    -TaskName "US-Stock-Daily" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -Description "US Stock daily analysis pipeline"
```

.bat 방식을 선호하는 경우 `scripts\run_daily.bat` 파일을 생성합니다:

```bat
@echo off
cd /d C:\workspace\us-stock
call .venv\Scripts\activate
python scripts\run_integrated_analysis.py >> logs\daily_run.log 2>&1
```

### 검증

```powershell
Get-ScheduledTask -TaskName "US-Stock-Daily" | Select-Object TaskName, State
# State: Ready 이면 정상
```

---

## Phase 9: Claude 에이전트 설정 (.claude\agents\)

> 예상 소요시간: 15~20분

### 목표

10개 팀, 총 25개+ 에이전트 정의 파일 생성.

### 단계

아래 구조대로 각 팀 디렉토리에 에이전트 MD 파일을 생성합니다.

```
.claude\agents\
├── performance\   # perf-lead, backtest-engineer, signal-optimizer, critic-reviewer, perf-verifier
├── equity\        # equity-lead, equity-factor-builder, equity-flow-analyst
├── model\         # model-lead, gbm-trainer, gbm-code-reviewer, walk-forward-validator
├── macro\         # macro-lead, macro-feature-engineer, regime-ml-classifier
├── mlops\         # mlops-lead, ml-pipeline-architect, service-evolver
├── system\        # system-lead, system-architect, system-optimizer
├── ai\            # ai-lead, ai-strategist, ai-evaluator
├── frontend\      # ux-lead, frontend-designer, ux-analyst
├── research\      # research-lead, paper-researcher, factor-discoverer, market-researcher
└── ingest\        # ingest-lead, ingest-validator, ingest-worker
```

각 에이전트 파일 형식 (예: `.claude\agents\model\gbm-trainer.md`):

```markdown
---
name: gbm-trainer
model: claude-sonnet-4-6
---

# GBM Trainer

## 역할
LightGBM 모델 학습과 하이퍼파라미터 최적화를 담당합니다.

## 담당 파일
- src\ml\pipeline\train.py
- src\ml\pipeline\feature_store.py

## 주요 기능
- TimeSeriesSplit 교차검증 실행
- Optuna HPO (일요일 50 trials)
- 모델 직렬화 및 메타데이터 저장

## 제약사항
- look-ahead bias 유발 코드 작성 금지
- 학습 데이터에 미래 수익률 직접 포함 금지
```

모델 선택 기준:
- Lead 에이전트: `claude-opus-4-5`
- 일반 구현 에이전트: `claude-sonnet-4-6`
- 단순 검증 에이전트: `claude-haiku-4-5`

### 검증

```powershell
Get-ChildItem .claude\agents -Recurse -Filter "*.md" | Measure-Object | Select-Object -ExpandProperty Count
# 25 이상이면 정상
```

---

## 최종 검증 체크리스트

모든 Phase 완료 후 아래 항목을 순서대로 확인합니다.

```powershell
Set-Location C:\workspace\us-stock
.venv\Scripts\activate

# 1. Python 패키지 확인
python -c "import yfinance, lightgbm, fredapi, curl_cffi, pandas; print('패키지 OK')"

# 2. S&P 500 데이터 수집
python src\collectors\fetch_sp500_list.py
(Get-Content data\sp500_list.csv).Count   # 500+ 줄

# 3. 시장 체제 감지
python -c @"
from src.analyzers.market_regime import MarketRegimeDetector
print(MarketRegimeDetector().detect()['regime'])
"@

# 4. 통합 분석 실행
python scripts\run_integrated_analysis.py
Get-Item output\latest_report.json   # 파일 존재 및 크기 > 0

# 5. SQLite DB 확인
python -c @"
import sqlite3
conn = sqlite3.connect('output\data.db')
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()
print(f'DB 테이블 수: {len(tables)}')
"@

# 6. 프론트엔드 빌드
Set-Location frontend
npm run build
Write-Host "빌드 성공"

# 7. 개발 서버 기동
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"
Start-Sleep -Seconds 5
(Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing).StatusCode
# 200 이면 정상

# 8. 스케줄러 상태 확인
Set-Location C:\workspace\us-stock
Get-ScheduledTask -TaskName "US-Stock-Daily" | Select-Object TaskName, State
```

모든 항목이 정상이면 구축 완료입니다.
