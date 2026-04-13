# Evolution Backlog

service-evolver가 발굴한 미결 개선 후보. Impact/Effort 매트릭스로 우선순위 관리.

---

## Open Candidates

### P0 (영향 높음, effort 낮음)
- [ ] **`us_macro.csv` 시계열 축적** — 현재 snapshot 1행만 저장. 매일 append로 ML 피처 축적 필요
  - 파일: `collectors/macro_collector.py`, `pipeline/us_data_pipeline.py`
  - Effort: Low (30분)
- [ ] **IndexPredictor 결과를 final_report_generator에 blending** — SPY/QQQ 방향 예측이 있으면 Top 10 등급 조정
  - 파일: `analyzers/final_report_generator.py`
  - 근거: cycle #2에서 SPY/QQQ BEARISH 신호 확인, 이를 종목 랭킹에 반영
  - Effort: Low (30분)
- [ ] **Brier Score + Platt Scaling 확률 보정** — IndexPredictor 성능 **-28% 개선** 검증됨
  - 파일: `us_market/index_predictor.py` (CalibratedClassifierCV 추가)
  - 근거: Summary2-8, Summary2-11 (US_Market 프로젝트에서 Brier 0.332 → 0.239, -28% 개선 실측)
  - 핵심: Accuracy는 유지되면서 **확률값 신뢰도**만 크게 향상 → confidence_pct 해석 정확도 ↑
  - Effort: Low (1h) — sklearn `CalibratedClassifierCV(method='sigmoid')` 래핑만

### P1 (영향 높음, effort 중간)
- [ ] **ERP를 6번째 센서로 market_regime.py에 통합** — 2026-04-05 추가된 ERP를 regime score에 반영
  - 파일: `analyzers/market_regime.py`
  - 근거: Morningstar 2025 ERP 논문
  - Effort: Medium (1-2h)
- [ ] **Volume sd_score 실제 계산** — 현재 고정값 50 플레이스홀더
  - 파일: `run_full_pipeline.py:62-69`, 신규 `analyzers/volume_analyzer.py`
  - Effort: Medium (2h)
- [ ] **Rule-Based vs ML 상충 감지 + mean-reversion 플래그** — 두 신호 불일치 시 경고
  - 파일: `analyzers/final_report_generator.py` (신규 `detect_signal_conflict()`)
  - 근거: Summary2-12, Summary2-13 (rule STRONG_BULL 44.4점 ↔ ML bearish 상충 케이스 실측)
  - 로직: rule-based > 60 AND ML BEARISH → "mean-reversion 경고" 플래그
  - Effort: Medium (1-2h)
- [ ] **Fold별 Accuracy 대시보드 노출** — 시장 체제 변화 감지용
  - 파일: `us_market/index_predictor.py`, 대시보드 JSON
  - 근거: Summary2-7 (Fold 1: 45.2% → Fold 4: 64.4%, 편차 7.7% = 체제 변화 증거)
  - 효과: 최근 fold 정확도 급락 시 model_accuracy만으로는 놓치는 체제 전환 조기 경고
  - Effort: Medium (1h)

### P2 (탐색 필요)
- [ ] **QCD (Quantile-Conditional Density) regime 보강** — 2025 MDPI 논문
  - 파일: `analyzers/market_regime.py`
  - Effort: High (4h+)
- [ ] **Factor decay 모니터링** — `smart_money_screener_v2.py`의 6팩터 IC rolling 90d
  - Effort: Medium
- [ ] **Top Feature Importance 대시보드 강화** — 현재 key_drivers에 있지만 시각화 부족
  - 파일: `dashboard/`, `us_market/index_predictor.py`
  - 근거: Summary2-11 (yield_spread_proxy 10.8%, spy_vol_trend_5d 8.2% 등 명확한 상위 피처)
  - Effort: Medium (1-2h)
- [ ] **Sample Weight 편향 보정** — 상승/하락 클래스 불균형 (60:40) 대응
  - 파일: `us_market/index_predictor.py` (GBM fit 시 class_weight='balanced' 또는 sample_weight)
  - 근거: Summary2-5 ("그냥 학습하면 '항상 오른다'는 답만 낸다")
  - Effort: Low (30분)
- [ ] **Isotonic Regression 대안 지원** — Platt Scaling과 비교 선택
  - 파일: `us_market/index_predictor.py`
  - 근거: Summary2-11 (Platt/Isotonic 둘 다 Brier -28% 개선, 데이터에 따라 선택)
  - Effort: Low (Brier Score 도입 후 함께 적용)

### P3 (장기 연구)
- [ ] **Sentiment ensemble** — 현재 AI 요약만, Twitter/Reddit/news sentiment 수치화
- [ ] **Options flow 수집** — 13F 대체/보완

---

## Completed (최근 14일)

- [x] 2026-04-05 Cycle #3: 문서 동기화 (4개 docs/ 파일 + drawio 겹침 수정)
- [x] 2026-04-05 Cycle #2: IndexPredictor GBM을 `run_full_pipeline.py` Step 8로 통합
- [x] 2026-04-05 Cycle #1: Equity Risk Premium (ERP) 센서 추가 (`macro_collector.py`)

---

## 📚 Reference: Summary2.md 이미지 분석 (2026-04-05)

사용자 Obsidian vault의 Summary2.md에서 22개 이미지 분석 → **6개 신규 후보** 추출.

**출처**: `/Users/frindle/Library/Mobile Documents/iCloud~md~obsidian/.../Summary2.md`

**참조 이미지 매핑**:
| Summary2 이미지 | 내용 | 도출된 후보 | 우선순위 |
|----------------|------|-----------|---------|
| Summary2-8 | Brier Score 개념 설명 | Brier Score 계산 추가 | P0 |
| Summary2-11 | Platt Scaling/Isotonic 비교 (Brier -28%) | 확률 보정 로직 | P0 |
| Summary2-12, 13 | Rule STRONG_BULL ↔ ML BEARISH 상충 케이스 | mean-reversion 경고 플래그 | P1 |
| Summary2-7 | 5-fold 편차 7.7% (45.2% ~ 64.4%) | Fold별 대시보드 | P1 |
| Summary2-11 | Top Feature Importance 수치 | 대시보드 시각화 강화 | P2 |
| Summary2-5 | 60:40 클래스 불균형 | Sample Weight 보정 | P2 |

**별도 프로젝트 참고**: 이미지들은 `US_Market` 프로젝트의 CLAUDE.md 구현 결과물. 우리 `us-stock`과 유사한 27 피처 IndexPredictor를 갖고 있고, **실측 데이터(Brier 0.332→0.239)**로 개선 효과가 검증됨. → 우리 프로젝트 적용 신뢰도 높음.
