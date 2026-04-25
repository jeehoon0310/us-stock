데이터 수집 완료. 검증 리포트를 작성하겠습니다.

---

# 2026-04-25 모델 검증

## 종합 상태: 🔴 위험

---

## GBM 모델 상태
- **모델 파일**: 없음 ⚠️ (`output/models/` 디렉토리 비어있음)
- **예측 파일**: 없음 ⚠️ (`output/gbm_predictions.parquet` 미존재)
- **ML 파이프라인**: 없음 ⚠️ (`src/ml/pipeline/` 디렉토리 미존재)
- **학습 주기**: 미학습 — rule-based 운영 중

---

## 최근 스크리닝 성과
- **최신 picks 기준일**: 2026-04-10 (오늘 기준 **15일 경과** ⚠️)
- **final_top10_report.json 기준일**: 2026-04-10
- **top_stocks 배열**: **0개** (빈 배열 — 리포트 데이터 없음 ⚠️)

**최신 picks 상위 10종목** (smart_money_picks_20260410.csv):

| 순위 | 티커 | 점수 | 등급 | 전략 | RS vs SPY |
|------|------|------|------|------|-----------|
| 1 | HPE | 70.2 | B | Trend/Breakout | +15.8% |
| 2 | DAL | 70.0 | B | Swing/Base | +13.9% |
| 3 | WDC | 69.5 | B | Trend/Breakout | +24.9% |
| 4 | DELL | 69.5 | B | Trend/Breakout | +22.3% |
| 5 | SNDK | 68.5 | B | Trend/Breakout | +29.1% |
| 6 | LITE | 67.5 | B | Trend/Breakout | +32.3% |
| 7 | SO | 67.3 | B | Trend/Base | +0.6% |
| 8 | UAL | 67.1 | B | Swing/Base | +6.9% |
| 9 | JBL | 66.8 | B | Trend/Breakout | +13.9% |
| 10 | ALL | 66.6 | B | Trend/Breakout | +3.5% |

- **Grade 분포**: A **0개** ⚠️ / B **10개** / C 이하 0개
- **점수 범위**: 66.6 ~ 70.2 (분산 3.6점 — 매우 좁음)

---

## 체제 감지 현황
- **현재 체제**: `neutral`
- **체제 점수**: 0.81 (neutral 경계 0.75 바로 위)
- **신뢰도**: **40%** ⚠️ (낮음 — 센서 신호 혼조)
- **VIX 수준**: **19.23** (MA20=25.0, falling — 개선 중)
- **Gate 신호**: CAUTION 추정 (neutral regime 기준)

**센서별 신호**:

| 센서 | 가중치 | 신호 |
|------|--------|------|
| VIX | 30% | neutral (19.23, MA20 25.0 대비 하락) |
| Trend | 25% | ✅ risk_on (SPY > SMA50/200, slope +6.7) |
| Breadth | 18% | ⚠️ risk_off (RSP/SPY 0.2894, MA20 대비 -1.34%) |
| Credit | 15% | neutral (HYG/IEF 0.8393) |
| Yield Curve | 12% | ✅ risk_on (spread +0.72) |

> Breadth가 risk_off인 점 주목: S&P 500 내 개별 종목 참여도가 약화됨. 지수는 상승하나 일부 대형주 주도 가능성.

---

## 피처 중요도 Top 5
**GBM 미학습 — rule-based 운영 중** (피처 중요도 측정 불가)

composite_score 팩터 가중치 현황 (rule-based 기준):

| 팩터 | 가중치 | 비고 |
|------|--------|------|
| Technical | 25% | 실계산 중 |
| Fundamental | 20% | 실계산 중 |
| Analyst | 15% | 실계산 중 |
| RS vs SPY | 15% | 실계산 중 |
| Volume | 15% | ⚠️ 기본값 50 사용 (무력화 상태) |
| 13F Holdings | 10% | ⚠️ 기본값 50 사용 (SEC 미연동) |

---

## 최근 사이클 성과
- **2026-04-22**: `load_data()` 분포 검증 추가 — 데이터 파일 오염 방지 패턴 도입 ✅
- **2026-04-22**: 5D forward return win_rate 87% / alpha +1.68% 확인 (1D: 37% / +0.43%)
- **2026-04-22**: `us_volume_analysis.csv` 기본값 50 초기화 버그 식별 → volume_score 완전 무력화 상태 지속 중
- **사이클 로그**: 없음

---

## 이슈 목록

| 번호 | 심각도 | 이슈 | 권고 |
|------|--------|------|------|
| 1 | 🔴 Critical | picks 파일 15일 미갱신 (최신: 20260410, 오늘: 20260425) | `run_integrated_analysis.py` 즉시 재실행 필요 |
| 2 | 🔴 Critical | `final_top10_report.json` top_stocks 배열 0개 — 유효 결과 없음 | 스크리닝 재실행 및 리포트 재생성 필요 |
| 3 | 🔴 Critical | GBM 모델 미학습, ML 파이프라인 미구축 | `src/ml/pipeline/` 구조 없음 — rule-based 전용 운영 상태 |
| 4 | 🟡 Warning | Grade A 종목 0개 (전부 B) — 강한 매수 후보 없음 | 스크리닝 임계값 또는 팩터 재검토 |
| 5 | 🟡 Warning | 체제 신뢰도 40% — Breadth(risk_off) vs Trend/YieldCurve(risk_on) 충돌 | Breadth 센서 가중치 재검토 또는 sub-index 세분화 |
| 6 | 🟡 Warning | volume_score 기본값 50 (가중치 15%) — 실계산 미작동 | `us_volume_analysis.csv` 재생성 및 null/NaN 초기화 전환 |
| 7 | 🟡 Warning | 13f_score 기본값 50 (가중치 10%) — SEC EDGAR 미연동 | SEC EDGAR 무료 API 연동 여부 조사 (P2) |
| 8 | 🔵 Info | composite_score 분산 3.6점 (66.6~70.2) — 변별력 약함 | sector-neutral Z-score 스케일 확대 검토 |
| 9 | 🔵 Info | `RiskAlertSystem`에 `ai_summaries` 속성 없음 — 테스트 FAIL | `test_generate_alerts_output_structure` 수정 필요 |
