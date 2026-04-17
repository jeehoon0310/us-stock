# Research Backlog — 개선 후보 우선순위

최종 업데이트: 2026-04-16
담당: research-lead

우선순위 기준: P0=오늘 지시, P1=이번주 검토, P2=모니터링

---

## P0 — 즉시 작업 지시 (model-team)

### [BUG] Volume 팩터 실계산 복구
- **문제**: smart_money_screener_v2.py에서 Volume score가 전 종목 50점 고정 출력
- **영향**: 15% 가중치 완전 무력화. 전체 scoring 신뢰도 저하
- **조치**: volume_score 계산 로직 점검, data/us_daily_prices.csv 연동 확인
- **파일**: `src/analyzers/smart_money_screener_v2.py`
- **우선순위**: P0 (데이터 품질 직결)

### [BUG] 13F 팩터 실계산 복구
- **문제**: 13F score가 전 종목 50점 고정 출력
- **영향**: 10% 가중치 완전 무력화. 기관 추적 기능 상실
- **조치**: 13F filing_date 필터 및 holdings 데이터 파이프라인 점검
- **파일**: `src/analyzers/smart_money_screener_v2.py`
- **우선순위**: P0 (Volume과 함께 처리)

---

## P1 — 이번주 검토

### [FACTOR] Analyst Estimate Revision Momentum
- **출처**: Mill Street Research (https://www.millstreetresearch.com/do-analyst-estimate-revisions-still-help-forecast-relative-stock-returns/), FactSet Symposium Paper
- **개요**: 애널리스트 EPS 추정치 상향/하향 속도와 방향으로 revision momentum 구성. 상향 비율(breadth)과 상향 크기(magnitude) 결합
- **구현 파일**: `src/analyzers/smart_money_screener_v2.py` — 신규 `_calc_revision_score()` 메서드
- **데이터**: yfinance `ticker.analyst_price_targets` + `ticker.earnings_estimate` (분기 EPS 컨센서스 변화)
- **예상 Rank IC**: +0.018~0.025 (기존 Analyst score와 보완적, 상관 낮음)
- **Alpha Decay**: 12~18개월 (revision staircase 효과가 1~2개 분기 지속)
- **상관 리스크**: 기존 Analyst 팩터(15%)와 부분 중복 가능 → 사전 상관 검증 필수
- **추정 effort**: 중간 (3~4일) — yfinance API 안정성 검증 포함
- **가중치 제안**: 기존 Analyst 15% 내에서 Revision 5%p 분리 또는 신규 5% 배정

### [FACTOR] Short-Term Reversal (1주 반전)
- **출처**: QuantPedia (https://quantpedia.com/strategies/short-term-reversal-in-stocks/), Alpha Architect
- **개요**: 직전 1주(5거래일) 수익률 하위 종목 매수, 상위 종목 매도. 대형주 유니버스 한정 시 거래비용 내 생존
- **구현 파일**: `src/analyzers/smart_money_screener_v2.py` — `_calc_short_reversal_score()` 신규
- **데이터**: `data/us_daily_prices.csv` — 이미 존재하는 OHLCV 데이터 활용
- **예상 Rank IC**: +0.010~0.015 (단기 노이즈 많음, 대형주 필터 후)
- **Alpha Decay**: 1~2주 (매우 단기, 리밸런싱 비용 고려 필요)
- **주의**: S&P 500 전체 적용 시 거래비용으로 alpha 소멸 가능. 시가총액 상위 200개 한정 권고
- **추정 effort**: 낮음 (1~2일) — 기존 price data 재활용
- **가중치 제안**: Technical 내 sub-component로 통합 (별도 5% 신설 불필요)

---

## P2 — 모니터링 후 판단

### [FACTOR] Earnings Quality / Accruals
- **출처**: Sloan (1996), QuantPedia Accrual Anomaly (https://quantpedia.com/strategies/accrual-anomaly/), SSRN #1793364
- **개요**: 총발생액(Total Accruals) = 순이익 - 영업현금흐름. 낮은 발생액(현금이익) 종목이 초과수익
- **구현 파일**: `src/analyzers/smart_money_screener_v2.py` — `_calc_accrual_score()` 신규
- **데이터**: yfinance `ticker.cashflow` + `ticker.income_stmt` (분기 재무제표)
- **예상 Rank IC**: +0.008~0.012 (2003년 이후 alpha 약화 반영한 보수적 추정)
- **Alpha Decay**: 12개월 (연간 리밸런싱 기준, 단 2003년 이후 지속 모니터링 필요)
- **리스크**: 2003년 이후 arbitrage로 alpha 상당 소멸. Out-of-sample 검증 없이 프로덕션 투입 금지
- **추정 effort**: 중간 (3일) — 분기 재무제표 파싱 로직 신규
- **가중치 제안**: Fundamental 20% → 15%로 축소, 해방된 5%를 Accruals 신규 편입 후 검증

---

## 완료 항목

(없음 — 초기 백로그)

---

## 기각 항목

| 날짜 | 후보 | 기각 사유 |
|------|------|-----------|
| — | — | — |
