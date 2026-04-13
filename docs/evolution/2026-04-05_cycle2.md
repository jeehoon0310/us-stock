# 2026-04-05 Evolution Cycle #2 — IndexPredictor 파이프라인 통합

## Phase 1: 현황 파악

**어제 변경**: Cycle #1에서 `macro_collector.py`에 ERP 센서 추가 (TIPS 10y + earnings yield)
**Backlog 상태**: P0 2개, P1 2개, P2 2개, P3 2개

**발견**: `us_market/index_predictor.py`가 이미 완성된 27 피처 GBM 모듈이지만 `run_full_pipeline.py` 전체 파이프라인에 미통합.
- `predict_next_week()` 메서드 호출 시 SPY/QQQ 5일 방향 + 수익률 + 신뢰도 반환
- `output/index_prediction.json` + `output/prediction_history.json` (max 100) 자동 저장

## Phase 2: 트렌드 리서치

이번 사이클은 **기존 자산 활용** 관점이라 신규 외부 리서치 생략. backlog에 쌓인 P0 항목에서 선정.

## Phase 3: Gap Analysis

| 트렌드/요구 | 현재 구현 | Gap |
|-------------|-----------|-----|
| 지수 방향 예측 (SPY/QQQ) | 완성됨 (us_market/) | ❌ 파이프라인 미통합 |
| 매크로 시계열 | snapshot만 | 수집 로직 변경 필요 |
| ERP → 6번째 센서 | N/A | 가중치 재배분 (risk medium) |

## Phase 4: 오늘의 개선 선정

- **제목**: IndexPredictor(27 피처 GBM)를 run_full_pipeline.py Step 8로 통합
- **근거**: backlog P0 — 이미 만들어진 모듈 재활용, 파이프라인 표면 노출
- **대상**: `run_full_pipeline.py` (+25줄)
- **예상 effort**: 20분

## Phase 5: 코드 변경

**Diff 요약**: +25줄, 0줄 수정
- `step_index_prediction()` 함수 추가 (Step 8)
- `main()`에 호출 추가
- 종합 요약 섹션에 SPY/QQQ 출력 추가

**중간 시행착오**: 초기 출력 포맷에서 `p.get('confidence')` 사용했는데 실제 타입은 str('high'). `confidence_pct` (float)로 변경.

## Phase 6: 검증 결과

- **Layer 1 (Syntax)**: ✅
- **Layer 2 (Import)**: ✅
- **Layer 3 (Unit)**: ✅
  - 실행 시간: 6.4초
  - SPY: **BEARISH** (-3.13%, 신뢰도 92% / high)
  - QQQ: **BEARISH** (-3.59%, 신뢰도 86% / high)
  - `prediction_history.json`: 3 entries 누적
  - model_accuracy: SPY 0.53, QQQ 0.51 (거의 랜덤 수준 — 개선 여지)

## Phase 7: 문서

- `.docs/evolution/memory.md`: ✅ Cycle #2 entry + Do's/Don'ts 추가
- `.docs/evolution/backlog.md`: ✅ Completed 이동, 신규 P0 "blending" 후보 추가
- `docs/README.md`: (다음 사이클에서 업데이트 예정)

## 다음 사이클 후보

### P0
- [ ] **IndexPredictor 결과 → final_report_generator blending** (신규 추가됨)
- [ ] `us_macro.csv` 시계열 축적

### 이번 사이클에서 발견된 Open Question
- IndexPredictor `model_accuracy` 0.53 (랜덤 수준). 27 피처 부족? QCD/regime 통합으로 개선 가능?
