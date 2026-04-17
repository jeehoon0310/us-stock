# 2026-04-05 Evolution Cycle #1 — Equity Risk Premium 센서 추가

## Phase 1: 현황 파악

**서비스 규모**:
- 21 에이전트 (기존 6 + GBM 15 + service-evolver 1 = 22개)
- 4 Part 아키텍처 (데이터/체제/스크리닝/AI+ML)
- 기존 5-센서 regime detection (VIX 30% / Trend 25% / Breadth 18% / Credit 15% / Yield 12%)
- 기존 ML: `us_market/index_predictor.py` (27 피처 GBM, SPY/QQQ 5일 방향)

**최근 변경** (git log 대안: 파일 타임스탬프):
- 2026-04-05 21:07: `run_full_pipeline.py` (Step 7 GBM 추가)
- 2026-04-05 21:04: `ml/pipeline/train.py` 신규
- 2026-04-05 09:46-09:50: 기존 6 에이전트 생성
- 2026-04-04: 파이프라인 기본 구조

**Memory 상위 학습**: 첫 사이클 (empty memory)

## Phase 2: 트렌드 리서치

**WebSearch 1회 수행**:
> "US stock market analysis system 2025 daily improvement feature engineering market regime new indicators"

**인사이트**:
1. **ERP 지표** — [Morningstar 2025](https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns)
   > "S&P 500 earnings yield minus long-term real TIPS yield has significant power to predict stock market returns"
   - 적용 가능성: ⭐⭐⭐⭐⭐ (매우 간단한 수식, 우리 시스템에 직접 추가 가능)
2. **ML regime detection** — [SSGA 2025](https://www.ssga.com/library-content/assets/pdf/global/pc/2025/decoding-market-regimes-with-machine-learning.pdf)
   - 적용 가능성: ⭐⭐⭐ (현재 rule-based regime을 보강 가능)
3. **QCD 체제 분석** — [MDPI 2025](https://www.mdpi.com/2078-2489/16/7/584)
   - 적용 가능성: ⭐⭐ (복잡도 높음)

## Phase 3: Gap Analysis

| 트렌드 | 현재 구현 | 적용 모듈 | Effort |
|--------|-----------|-----------|--------|
| **ERP 지표** | ❌ 미구현 | `collectors/macro_collector.py` | Low (30분) ⭐ |
| ML regime | 부분 (GBM 있음) | `us_market/index_predictor.py` | Medium |
| QCD regime | ❌ 미구현 | `analyzers/market_regime.py` | High |

## Phase 4: 오늘의 개선 선정

- **제목**: Equity Risk Premium (ERP) 센서 추가
- **근거**: [Morningstar 2025](https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns)
- **대상 파일**: `collectors/macro_collector.py`
- **예상 diff**: +60줄, 0줄 수정
- **검증 방법**: 단독 실행 → TIPS + earnings yield + ERP 출력 확인

## Phase 5: 코드 변경

**Diff 요약**:
- 신규 메서드 3개 + `get_macro_summary()` 3줄 추가
- `fetch_tips_10y_real_yield()`: FRED `DFII10` 시리즈 호출
- `fetch_spy_earnings_yield()`: yfinance `SPY.forwardPE` 역수
- `fetch_equity_risk_premium()`: earnings_yield − tips_yield 계산 + 4단계 valuation 라벨

## Phase 6: 검증 결과

- **Layer 1 (Syntax)**: ✅ `ast.parse` 통과
- **Layer 2 (Import)**: ✅ `from collectors.macro_collector import MacroDataCollector`
- **Layer 3 (Unit)**: ✅
  - TIPS 10y real: **1.97%**
  - SPY earnings yield: **3.84%** (P/E 26.0)
  - **ERP: 1.87% → "과열 (주식 고평가)"**

## Phase 7: 문서

- `.docs/evolution/memory.md`: ✅ Cycle #1 entry 작성
- `.docs/evolution/backlog.md`: ✅ P0-P3 후보 정리
- `docs/README.md`: (다음 사이클에서 업데이트)

## 다음 사이클 후보 (P0)

- [ ] `us_macro.csv` 시계열 축적 기능 추가
- [ ] `index_predictor.py`를 `run_full_pipeline.py` Step 8에 통합
- [ ] ERP를 `market_regime.py`의 6번째 센서로 가중치 반영
