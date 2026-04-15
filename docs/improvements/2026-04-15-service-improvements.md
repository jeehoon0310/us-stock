# US Stock 서비스 개선점 분석 (2026-04-15)

> **생성**: 2026-04-15 | **에이전트 팀**: architect · quant-analyst · ai-strategist · data-engineer · dashboard-dev · qa  
> **방법**: `docs/agents/` 정의 에이전트 6종 병렬 스폰 → 도메인별 코드 직접 탐색 → QA 종합 평가

---

## Executive Summary

| 항목 | 값 |
|------|-----|
| 종합 판정 | **FAIL** |
| QA 종합 점수 | **2.35 / 10** |
| Critical 이슈 | **18건** |
| P0 (즉시 수정) | **5건** (보안 2 + 파이프라인 무결성 3) |
| 전체 개선 항목 | **28건** |
| 파이프라인 수집 시간 | 현재 ~22분 → 최적화 후 ~3분 |
| AI 분석 성공률 | 현재 60% (10종목 중 4종목 실패) |
| 테스트 커버리지 | 5,057줄에 테스트 9개 (0.2%) |

**결론**: P0 5건(보안·파이프라인 무결성) + P1 분석 정확성 이슈 해결 후 재평가 필요. 특히 **C-08 13F look-ahead bias**는 백테스트 결과 전체를 무효화하므로 즉시 수정 대상.

---

## QA 평가 점수

| 카테고리 | 점수/10 | 가중치 | 가중 점수 | 주요 이슈 |
|----------|---------|--------|-----------|-----------|
| C1 데이터 품질 | 2.5 | 30% | 0.75 | 5일치 데이터(기준 180일), retry 없음, silent failure |
| C2 분석 정확성 | 2.0 | 25% | 0.50 | Confidence 다수결, Credit spread 오지표, Breadth 오분류 |
| C3 AI 품질 | 2.0 | 15% | 0.30 | Fallback 미구현(40% 실패), macro_context=None, dead code |
| C4 파이프라인 안정성 | 3.0 | 15% | 0.45 | 예외 삼킴, 계약 미검증, 수집 22분, AI 호출 100초 |
| C5 코드 품질 | 3.5 | 10% | 0.35 | API 키 평문 노출, sys.path 17회, RSI 4중 중복 |
| C6 대시보드 | — | 5% | — | 별도 평가 (아래 섹션 참조) |
| **종합** | | | **2.35** | C1 < 6.0 · Critical ≥ 1건 · 종합 < 7.0 — 3중 FAIL |

---

## 우선순위 매트릭스

### P0 — 즉시 수정 (보안·무결성)

| # | 이슈 | 파일:라인 | 수정 방법 |
|---|------|-----------|---------|
| P0-1 | **Gemini API 키 URL 쿼리스트링 평문 노출** | `src/analyzers/ai_summary_generator.py:364` `f"{self.base_url}?key={self.api_key}"` | `google-generativeai` SDK의 `genai.configure(api_key=...)` 사용 또는 `x-goog-api-key` 헤더로 전환. HTTP 로그에 키가 평문 기록 중 |
| P0-2 | **API 키가 `output/ai_summaries.json`에 노출** | `ai_summary_generator.py:347-355` `_get_fallback_json`: `"thesis": str(e)` — URL 포함 예외 메시지가 thesis에 삽입됨 | `"thesis": "분석 실패"` 등 고정 문자열 사용. `output/` 디렉토리를 `.gitignore`에 추가. **노출된 키 즉시 재발급** |
| P0-3 | **`timed` 데코레이터가 모든 예외 삼킴** | `scripts/run_full_pipeline.py:26-29` `except Exception as e: ... return None` | Step 별 실패 시 `raise` 재발생 또는 `main()`에서 None 체크 후 파이프라인 중단 |
| P0-4 | **단계 간 데이터 계약 미검증** | `scripts/run_full_pipeline.py` 전반 | 각 단계 진입 시 필수 입력 파일 존재 + 최소 row 수 검증 gate 추가. 빈 CSV → 허위 리포트 생성 차단 |
| P0-5 | **13F look-ahead bias 필터 불완전** | `src/analyzers/smart_money_screener_v2.py:57-59` `filing_date <= yesterday` | `report_period_of_report` + 45일 공시 지연 반영. 현재 2026-01-01 기준 포트폴리오가 2026-02-14에 filing된 경우 1월 2일에 사용 시 look-ahead bias 발생 |

---

### P1 — 이번 주 내 (분석 정확성·성능)

| # | 이슈 | 파일:라인 | 수정 방법 | 예상 효과 |
|---|------|-----------|---------|---------|
| P1-1 | **Confidence 계산이 가중 합산과 무관** | `src/analyzers/market_regime.py:255-257` `confidence = majority_count / len(regimes) * 100` — 단순 다수결 카운트 | `1 - (weighted_score의 분산 / 최대분산)` 기반으로 교체. 가중 점수와 confidence가 독립적으로 계산되는 현행 구조 수정 | 체제 신뢰도 판단 정상화 |
| P1-2 | **Credit spread가 가격비율** | `src/analyzers/market_regime.py:155-170` `ratio = hyg / ief` | FRED BAMLH0A0HYM2(ICE BofA 하이일드 OAS) 또는 HYG yield - IEF yield 실제 스프레드 사용 | 매크로 체제 판정 정확도 개선 |
| P1-3 | **RSP/SPY breadth = size factor** | `src/analyzers/market_regime.py:114-115` `ratio = rsp / spy` | RSP/SPY는 equal-weight vs cap-weight 상대강도(small vs large). 실제 breadth는 NYSE Advance/Decline ratio 또는 `% stocks above 200MA` 사용 | 시장 폭 지표 오분류 수정 |
| P1-4 | **Volume divergence 역방향 분류** | `src/analyzers/market_gate.py:137-138` `if price_change < 0 and vol_change < -0.12: return "bullish_div"` — 가격↓ + 거래량↓ = bullish는 근거 약함 | OBV 기반 divergence로 교체. `detect_volume_price_divergence()` 함수가 정의만 되고 `run_market_gate()`에서 호출 안 됨 — 호출 추가 | 게이트 신호 방향 정상화 |
| P1-5 | **AI fallback 40% 실패** | `src/analyzers/ai_summary_generator.py` `get_ai_provider()` — 단일 provider, fallback chain 미구현 | Gemini → OpenAI → Perplexity 3-tier fallback 체인 구현. 현재 503 에러 4건(HPE/DAL/DELL/WDC) 발생 | AI 분석 성공률 60% → 100% |
| P1-6 | **macro_context=None 전달** | `scripts/run_full_pipeline.py` AI 호출부 | `regime_config.json` 로드 후 `generate_summary(macro_context=regime_data)` 전달. 현재 프롬프트의 매크로 섹션 9개 필드가 항상 빈 문자열 | AI 분석 품질 즉각 개선 |
| P1-7 | **데이터 5일치** | `data/us_daily_prices.csv` `2025-04-10~15` | 초기 수집 시 `period="1y"` 기본값이 파이프라인에 일관 적용되는지 확인. `incremental_update()`가 메인 파이프라인에 연결 안 됨(`run_full_pipeline.py:37-38`) — 연결 필요 | data_quality 채점 유효화 |
| P1-8 | **수집 22분 → 3분** | `src/collectors/fetch_sp500_prices.py:19-40` `for i, symbol in enumerate(symbols): time.sleep(1)` | `ThreadPoolExecutor(max_workers=10)` 병렬화 + exponential backoff retry | 데이터 수집 7배 단축 |
| P1-9 | **AI 분석 순차 100초** | `scripts/run_full_pipeline.py:109-123` `for i, ticker in enumerate(tickers)` | `asyncio.gather()` 또는 `ThreadPoolExecutor(max_workers=3)` (Gemini 15 RPM 기준 3 동시 적정) | AI 단계 1/3 단축 (~100초 → ~35초) |
| P1-10 | **sd_score/13f_score 계산 로직 부재** | `src/analyzers/smart_money_screener_v2.py:50-73` 외부 CSV 의존 | `us_volume_analysis.csv` 생성 스크립트가 코드베이스에 없음. composite score 30%를 차지하는 핵심 팩터의 출처 불명 — 로직 명시 필요 | 팩터 점수 추적 가능성 확보 |

---

### P2 — 이번 달 내 (코드 품질·기능 완성)

| # | 이슈 | 파일:라인 | 수정 방법 |
|---|------|-----------|---------|
| P2-1 | **`ai_response_parser.py` dead code** | 전체 프로젝트 import 0건 | `generate_summary()` 반환값을 `parse_ai_response()` + `validate_ai_response()`로 검증하도록 연결 |
| P2-2 | **AI 추천 파싱이 전체 JSON 키워드 매칭** | `src/analyzers/final_report_generator.py:40-66` `text = json.dumps(summary).lower()` | `summary.get("recommendation", "HOLD")` 직접 참조로 교체. 현재 bear_cases에 "매수" 언급 시 매수로 오판 |
| P2-3 | **OpenAI provider `__new__()` 해킹** | `src/analyzers/ai_summary_generator.py:433-435` `GeminiSummaryGenerator.__new__(GeminiSummaryGenerator)` | `_build_prompt()`를 독립 함수 또는 공통 Base 클래스로 추출. `__new__` anti-pattern 제거 |
| P2-4 | **뉴스 신선도 필터 없음** | `src/analyzers/ai_summary_generator.py:107-182` Yahoo/Google RSS 소스 | 7일 이내 필터 전 소스 공통 적용. 현재 Finnhub만 날짜 필터 있음 |
| P2-5 | **SMA_200 전처리 미연결** | `src/ml/features/equity/build_equity_features.py:50-51` | `add_all_indicators()` 전처리 단계를 `build_features_per_ticker()` 진입 전에 명시적으로 호출 |
| P2-6 | **top_n 불일치** | `scripts/run_full_pipeline.py:38,143,185` 수집=10, GBM=20, AI=10 | `PipelineConfig` dataclass 단일 진입점으로 파라미터 통합 |
| P2-7 | **HTTP timeout 기본값 없음** | `src/collectors/macro_collector.py` Fear&Greed만 10초 | 모든 HTTP 클라이언트에 `timeout=30` 기본값 설정 |
| P2-8 | **파이프라인 부분 재실행 불가** | `scripts/run_full_pipeline.py:164-238` | CLI `--steps 4,5,6` 인자 추가. AI 프롬프트 수정 시 데이터 수집 22분 재실행 불필요하게 |
| P2-9 | **`build_macro_features.py`가 ML pipeline과 미연결** | `src/ml/features/macro/` | macro features를 equity features와 join하여 conditional factor model 구성. 체제 변화 시 모델 성능 급락 방지 |
| P2-10 | **테스트 커버리지 0.2%** | `tests/` 디렉토리 (9개 테스트) | `market_regime.py`, `smart_money_screener_v2.py`, `final_report_generator.py` 최소 단위 테스트 추가 (pytest-mock으로 yfinance mocking) |
| P2-11 | **대시보드 데이터 이중성** | `frontend/src/lib/data.ts:2-10` 빌드타임 import + CSR fetch 혼재 | 빌드타임 import 제거. 모든 데이터는 CSR `fetch('/data/*.json', { cache: "no-store" })`로 통일 |
| P2-12 | **`/costs` 페이지 실제 데이터 없음** | `frontend/app/costs/page.tsx` | 파이프라인에서 `api_costs.json` 생성 (`{date, gemini, openai, perplexity, total}`). 프론트 연결 |
| P2-13 | **Breadth Gauge 하드코딩** | `frontend/app/DashboardClient.tsx:381` `w-[60%]` 고정 | `signals.breadth` 상태를 실제 값으로 반영 |
| P2-14 | **ML/AI 페이지 CalendarPicker 미사용** | `frontend/app/ml/page.tsx:111-129`, `frontend/app/ai/page.tsx:121-139` | 이미 구현된 CalendarPicker 컴포넌트 + dates_manifest.json 패턴 적용 |

---

### P3 — 다음 달 (개선·새 기능)

| # | 이슈 | 방법 | 예상 효과 |
|---|------|------|---------|
| P3-1 | **RSI 4중 중복** | `technical_indicators.py`를 표준 라이브러리로 지정, 3곳 import 통일 | 지표 불일치 버그 원천 차단 |
| P3-2 | **curl_cffi 세션 6중 생성** | `src/common/session.py` 싱글턴 팩토리, DI 패턴 적용 | TCP 커넥션 재사용, rate-limit 통합 관리 |
| P3-3 | **sys.path.insert 17회 산재** | `pyproject.toml` 패키지화 + `pip install -e .` | import 구조 정상화, IDE 자동완성 |
| P3-4 | **VIX 정적 임계값** | 6개월 rolling percentile 기반 적응형 임계값 | VIX 16.1에서 항상 neutral 판정되는 위양성 제거 |
| P3-5 | **모멘텀 팩터 단일 기간 (20일)** | 1M/3M/6M/12M-1M 분리 (Jegadeesh & Titman 표준) | cross-sectional momentum premium 포착 |
| P3-6 | **Quality 팩터 미구현** | Piotroski F-Score, Gross Profitability, FCF margin 추가 | Value trap 회피 |
| P3-7 | **Put/Call Ratio 센서 없음** | CBOE P/C ratio (^PCALL) — 6번째 체제 센서 | VIX와 독립적인 극단 역발상 신호 |
| P3-8 | **섹터 히트맵 미구현** | `/regime` 페이지에 11×N 수익률 색상 그리드. 데이터는 `sectors[]`에 이미 있음 | 섹터 로테이션 한눈에 파악 |
| P3-9 | **시장 체제 히스토리 없음** | prediction_history.json 활용 SVG 타임라인 | regime 맥락 제공 |
| P3-10 | **팩터 레이더 차트 없음** | 라이브러리 없는 SVG 5각형 레이더 (Top-picks 클릭 시 드로어) | 종목별 강약점 시각화 |
| P3-11 | **CSV 내보내기 없음** | `lib/export.ts` 순수 함수 + Top Picks 헤더 버튼 | 사용자 엑셀 활용 |
| P3-12 | **shiftDate 6개 파일 중복** | `useReportDate` custom hook 추출 | 코드 ~300줄 절감 |
| P3-13 | **데이터 신선도 경고 없음** | `generated_at` vs `now()` 비교, 1일 이상 시 stale 배너 | 파이프라인 미실행 시 오래된 데이터 의사결정 방지 |
| P3-14 | **Fear&Greed 단일 실패 지점** | Alternative.me API 또는 CNN 외 대체 소스 추가 | 가용성 개선 |

---

## 1. 아키텍처 분석 (architect)

### 구조적 강점 (유지)
- **파일 기반 loose-coupling**: CSV/JSON 매개로 단계 독립 실행 가능. 각 모듈이 `__main__` 블록 보유
- **Graceful degradation**: holdings_df/etf_df 없어도 기본값 50으로 동작 (`smart_money_screener_v2.py:51-73`)
- **API 비용 추적**: `APIUsageTracker` 싱글턴이 모든 provider 토큰·비용 실시간 추적
- **ML 시계열 엄격성**: train.py의 시계열 split + embargo 처리 (`train.py:92-137`) — look-ahead bias 정확히 방지
- **TypeScript 타입 안전성**: `frontend/src/lib/data.ts`에 모든 JSON 인터페이스 정의

### ADR 제안

**ADR-001: curl_cffi 세션 싱글턴**  
`src/common/session.py`에 `get_shared_session()` 싱글턴 팩토리. 파이프라인 1회 실행 시 현재 6개 독립 Session → 1개 공유 Session. 모든 fetcher/analyzer 생성자에 `session=None` DI 파라미터.

**ADR-002: 파이프라인 step 선택 실행 + 입력 검증 gate**  
CLI `--steps 4,5,6`. 각 step 진입 시 `StepGuard` 데코레이터로 필수 입력 파일 + 최소 row 수 검증. AI 프롬프트 수정 후 Step 5만 재실행 가능하게.

**ADR-003: 기술적 지표 단일 소스**  
`src/analyzers/technical_indicators.py`를 표준 라이브러리로 지정. RSI 4중, MACD 2중 구현 통합.

---

## 2. 퀀트 분석 개선 (quant-analyst)

### 기술적 지표 검증 결과

| 지표 | 판정 | 근거 |
|------|------|------|
| RSI | **정확** | `ewm(alpha=1/period, adjust=False)` — Wilder's smoothing과 동일 |
| MACD | **정확** | EMA12, EMA26, Signal=EMA9 표준 구현 |
| Bollinger Bands | **정확** | 20일 SMA ±2σ 표준 구현 |
| ATR | **정확** | True Range + Wilder's EWM 표준 구현 |
| MACD 히스토그램 판정 | **주의** | `market_gate.py:80-83` 히스토그램 감소 체크가 크로스오버 체크보다 먼저 실행되어 유효한 크로스오버를 NEUTRAL로 덮어쓸 수 있음 |

### Look-ahead Bias 감사

| 항목 | 판정 | 근거 |
|------|------|------|
| ML features | PASS | 모든 피처에 `.shift(1)` 적용 (`build_equity_features.py:40-82`) |
| ML target | PASS | `close.shift(-h)` forward return 정확히 계산 |
| train.py embargo | PASS | `cutoff = max_date - timedelta(days=label_horizon+5)` |
| walk_forward embargo | PASS | fold간 10일 갭 |
| **13F filing_date 필터** | **PARTIAL FAIL** | `report_period_of_report` 미검증. 45일 공시 지연 미반영 |
| yfinance fundamental data | **FAIL (잠재적)** | `get_info()`가 현재 시점 trailingPE/ROE 반환 — 과거 시점 백테스트에 사용 시 look-ahead bias |

### 미해결 질문
- `us_volume_analysis.csv`의 **sd_score 계산 로직**이 코드베이스에 없음 (composite score 15% 가중치)
- `us_13f_holdings.csv`의 **13f_score 계산 로직**도 부재 (10% 가중치)
- Market Regime `crisis` + Market Gate `GO` 상충 시 우선순위 미정의

---

## 3. AI 전략 개선 (ai-strategist)

### 프롬프트 품질 현황

| 항목 | 점수/10 | 문제 |
|------|---------|------|
| JSON 파싱 안정성 | **4/10** | 파서 존재하나 미사용, split 기반 추출만, 성공률 측정 없음 |
| bear_cases 강제성 | **3/10** | 프롬프트 지시 있으나 검증 미연결. fallback 0개 반환. 실제 4/10 종목이 0개 |
| 할루시네이션 방지 | **2/10** | 팩트체크 레이어 전무. key_metrics에 모순된 값(N/A vs 0) 제공 |
| 매크로 컨텍스트 연동 | **1/10** | 프롬프트 구조는 잘 설계됨(9개 필드). 실행 시 `macro_context=None`으로 100% 미사용 |

### 비용 추정

| 시나리오 | 비용 |
|---------|------|
| 현재 (Gemini 무료 한도) | $0 |
| 무료 한도 초과 시 | ~$0.08/회 실행 (10종목 × 2K input + 1K output) |
| Fallback 체인 구현 후 | +$0.006/종목 OpenAI, +$0.003/종목 Perplexity |
| 최적화 (key_metrics 제거 + 뉴스 3개) | 현재 대비 ~25% 절감 |

### 핵심 수정 사항
1. `_get_fallback_json()`에서 `str(e)` → `"분석 실패"` 고정 문자열 (API 키 노출 차단)
2. `_build_prompt()`를 독립 함수로 추출 (`__new__` 해킹 제거)
3. `extract_ai_recommendation()`을 `summary.get("recommendation", "HOLD")` 직접 참조로 변경
4. `key_metrics`를 프롬프트에서 제거하고 코드에서 직접 삽입
5. `ai_response_parser.py`를 실제 파이프라인에 연결

---

## 4. 데이터 파이프라인 개선 (data-engineer)

### 수집 성능 분석

```
현재:
  503개 종목 × (0.5~1.5초 yfinance + 0.1초 파일쓰기 + 1.0초 sleep) = ~22분

병렬화 후 (ThreadPoolExecutor max_workers=10):
  22분 / 10 ≈ 2분 15초 (실제 ~3분, jitter 고려)
  Rate: 10 workers × 0.2 req/sec = 2 req/sec (yfinance 권장 이하)
```

### 병렬화 핵심 코드

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import random

def fetch_with_retry(symbol, max_retries=3):
    for attempt in range(max_retries):
        try:
            df = fetcher.fetch_ohlcv(symbol, period="1y")
            if not df.empty:
                return symbol, df, None
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt + random.uniform(0, 1))  # jitter
            else:
                return symbol, None, str(e)
    return symbol, None, "max_retries"

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(fetch_with_retry, sym): sym for sym in symbols}
    for future in as_completed(futures):
        symbol, df, error = future.result()
        if df is not None:
            success_count += 1
```

### 데이터 품질 누락 검증 항목

| 항목 | 중요도 | 구현 방법 |
|------|--------|---------|
| High < Low 또는 Close > High | Critical | OHLC 관계 검증 |
| 분할/배당 조정 여부 | Critical | `ticker.splits` 이력 비교 |
| 거래량 이상치 | High | 20일 평균 ±300% flagging |
| 중복 날짜 | High | `df.index.duplicated().sum()` |
| 소스 간 가격 일치도 | High | yfinance vs Finnhub 오차 <2% |
| 매크로 데이터 freshness | Medium | VIX 수집 날짜 == 오늘 |

---

## 5. 대시보드 개선 (dashboard-dev)

### 구현 현황

| 페이지 | 상태 | 비고 |
|-------|------|------|
| `/` Overview | ✅ 완전 구현 | Verdict/Gate/Top5 Picks |
| `/regime` | ✅ 완전 구현 | 5 Sensor + Sector Gate 11개 |
| `/top-picks` | ✅ 완전 구현 | CalendarPicker 통합 |
| `/ai` | ✅ 완전 구현 | Bull/Bear thesis |
| `/forecast` | ✅ 완전 구현 | SPY/QQQ + SVG sparkline |
| `/ml` | ✅ 완전 구현 | 6팩터 테이블 |
| `/costs` | ⚠️ **껍데기** | 정적 가격표만, 실제 비용 없음 |
| `/performance` | ✅ 완전 구현 | 수익률 시뮬레이터 |

### 누락 기능 체크리스트

| 기능 | 상태 |
|------|------|
| 섹터 히트맵 (11×N 수익률 매트릭스) | ❌ 미구현 (섹터 카드만 있음) |
| 시장 체제 히스토리 타임라인 | ❌ 미구현 |
| 팩터 분포 레이더 차트 | ❌ 미구현 |
| API 비용 트래커 (일별) | ❌ 미구현 (껍데기만) |
| 종목 비교 기능 | ❌ 미구현 |
| 날짜 선택기 전 페이지 통일 | ⚠️ 부분 구현 (ML/AI 페이지는 구식 input) |
| 즐겨찾기/워치리스트 | ❌ 미구현 |
| CSV/PDF 내보내기 | ❌ 미구현 |
| 캔들스틱 차트 | ❌ 외부 TradingView 링크로 대체 |

### 데이터 신선도 권장 아키텍처

현재 `data.ts:2-10`에서 9개 JSON을 빌드타임 import로 번들에 포함. CSR fetch와 혼재.  
**권장**: 빌드타임 import 전부 제거 → 모든 데이터를 CSR `fetch('/data/*.json', { cache: "no-store" })`로 통일. Synology 정적 서빙 환경에서 ISR 불가이므로 CSR이 정답.

---

## 6. 빠른 수정 (Quick Wins — 30분 내)

```python
# Quick Win 1: timed 데코레이터 예외 삼킴 수정
# run_full_pipeline.py:26-29
# Before:
except Exception as e:
    logger.error(f"Step failed: {e}")
    return None  # ← 삭제

# After:
except Exception as e:
    logger.error(f"Step failed: {e}")
    raise  # ← 재발생

# Quick Win 2: API 키 노출 차단
# ai_summary_generator.py:347-355 _get_fallback_json()
# Before: "thesis": str(e)
# After:  "thesis": "분석 실패 (API 오류)"

# Quick Win 3: output/ .gitignore 추가
echo "output/" >> .gitignore
echo "data/" >> .gitignore

# Quick Win 4: market_gate.py volume divergence 호출 추가
# run_market_gate() 마지막에 추가:
divergence = detect_volume_price_divergence(df)
result["divergence"] = divergence

# Quick Win 5: 파이프라인 단계 gate
# run_full_pipeline.py 각 step 후:
if output_df is None or len(output_df) == 0:
    logger.error(f"Step {n} output empty — aborting")
    return
```

---

## 실행 로드맵

### Week 1 (P0 + P1 핵심)
- [ ] P0: API 키 노출 2건 수정 + 키 재발급
- [ ] P0: timed 데코레이터 예외 삼킴 수정
- [ ] P0: 파이프라인 단계 gate 추가
- [ ] P0: 13F look-ahead bias 수정
- [ ] P1: AI fallback 3-tier chain 구현
- [ ] P1: macro_context 연동 (regime_config.json → AI 호출)
- [ ] P1: 데이터 수집 ThreadPoolExecutor 병렬화

### Week 2 (P1 분석 정확성)
- [ ] P1: Credit spread → FRED BAMLH0A0HYM2
- [ ] P1: RSP/SPY breadth → NYSE A/D ratio
- [ ] P1: Volume divergence 방향 수정 + run_market_gate() 연결
- [ ] P1: Confidence 재계산 방식 수정
- [ ] P1: sd_score/13f_score 계산 로직 구현

### Month 1 (P2 코드 품질)
- [ ] P2: ai_response_parser.py 파이프라인 연결
- [ ] P2: `_build_prompt()` 독립 함수 추출 (`__new__` 제거)
- [ ] P2: extract_ai_recommendation() 직접 참조 전환
- [ ] P2: 테스트 커버리지 핵심 모듈 추가
- [ ] P2: 대시보드 데이터 이중성 해소
- [ ] P2: CalendarPicker ML/AI 페이지 통합

### Month 2 (P3 새 기능)
- [ ] P3: 섹터 히트맵 구현
- [ ] P3: 체제 히스토리 타임라인
- [ ] P3: 팩터 레이더 차트
- [ ] P3: Put/Call Ratio 6번째 센서
- [ ] P3: 모멘텀 팩터 세분화 (1M/3M/6M/12M)
- [ ] P3: Quality Factor (Piotroski F-Score)

---

*생성: 2026-04-15 | 에이전트: architect(opus) · quant-analyst(opus) · ai-strategist(opus) · data-engineer(sonnet) · dashboard-dev(sonnet) · qa(sonnet)*
