# Service Evolution Memory

us-stock 서비스의 매일 진화 사이클 Reflexion memory.
성공/실패 패턴 누적 학습, 동일 실수 반복 금지.

---

## Do's (반복할 성공 패턴)
- **이미 구현된 모듈 재활용**: 이미 만들어진 GBM/지표 모듈이 파이프라인에 미통합인 경우가 있음. backlog 점검 시 "완성되어 있으나 미노출" 항목 우선. (cycle #2)
- **출력 구조 먼저 확인**: JSON 파일 직접 읽어서 필드 타입 파악 후 포맷 코드 작성. `confidence` vs `confidence_pct` 같은 혼동 방지. (cycle #2)
- **외부 논문/기사 근거**: Morningstar, arXiv 링크를 인라인 주석에 필수 기록. 미래 감사/롤백 시 "왜 이걸 넣었는지" 즉시 파악 가능. (cycle #1)
- **사용자 외부 자료(Obsidian 등) 스캔하여 backlog 도출**: 사용자가 이미 만든 강의자료/실험 결과에 **검증된 개선 수치**(예: Brier -28%)가 있을 수 있음. 외부 자료를 정기적으로 스캔하면 신뢰도 높은 후보 확보. (2026-04-05 Summary2 분석)
- **다이어그램 좌표 충돌 선검사**: drawio/SVG 업데이트 시 새 노드의 x/y/w/h만 보지 말고 **기존 노드와의 바운딩 박스 겹침**을 Python parser로 검증. (cycle #3)

## Don'ts (반복 금지 실패 패턴)
- **format code 추측 금지**: `.0f`, `:+.2f` 등 포맷 코드는 실제 값 타입 확인 후 사용. string을 `:.0f`로 포맷하면 ValueError. (cycle #2)

## Open Questions (추가 리서치 필요)
- IndexPredictor의 `model_accuracy`가 0.53 (거의 랜덤 수준). 27 피처가 5일 방향 예측에 부족한가? QCD/regime 통합으로 개선 가능?

---

## 일일 사이클 로그

## 2026-04-05 (사이클 #3)
- **개선**: 문서 동기화 + drawio 겹침 수정
- **근거**: 사용자 직접 이미지 제보 — drawio p5_cfg/p5_confidence가 피처 박스 위에 겹쳐 있음. 또한 backlog 6건 신규 후보가 공개 문서에 미반영.
- **파일**:
  - `docs/architecture.drawio`: p5_cfg (540,1620,300x40) → (60,1680,490x32), p5_confidence (540,1668,300x40) → (560,1680,280x32), p7_summary2_ref 신규
  - `docs/DASHBOARD-EASY-GUIDE.md`: "Brier Score — 확률 정답률 채점표" 섹션 (초등학생 톤)
  - `docs/prompt_전체.md`: 5.7 Summary2 분석 섹션 추가
  - `docs/prompt_v2.md`: 프롬프트 13 (Brier+Platt) + 14 (Rule vs ML 상충) 추가
- **결과**: 4개 문서 완전 동기화, drawio 겹침 0건
- **학습**: 다이어그램 업데이트 시 **기존 노드 좌표와의 충돌 체크 필수**. 새 노드만 고려하지 말고 기존 노드도 확인.
- **검증**: XML parse ✅, 좌표 이동 확인 ✅, 각 문서 섹션 grep 일치 ✅
- **롤백**: `git checkout -- docs/architecture.drawio docs/DASHBOARD-EASY-GUIDE.md docs/prompt_전체.md docs/prompt_v2.md`

## 2026-04-05 (사이클 #2)
- **개선**: IndexPredictor(27 피처 GBM) 전체 파이프라인 통합
- **근거**: 이미 만들어진 `us_market/index_predictor.py`가 `run_full_pipeline.py`에 미통합 상태 (backlog P0)
- **파일**: `run_full_pipeline.py` +25줄 (Step 8 함수 + main 호출 + summary 출력)
- **결과**: SPY/QQQ 5일 방향 예측 활성화
  - SPY: BEARISH (-3.13%, 신뢰도 92% / high)
  - QQQ: BEARISH (-3.59%, 신뢰도 86% / high)
  - 6.4초 소요, prediction_history.json에 3번째 entry append
  - 현재 시장과 정합 (VIX 23.87, ERP 1.87% 과열 신호와 일치)
- **학습**:
  - IndexPredictor 출력에서 `confidence`는 str ('high'), `confidence_pct`가 숫자 — 혼동 주의
  - 이미 구현된 모듈 재활용이 최고 ROI (20분 작업, 검증된 기능 활성화)
- **검증**: syntax ✅ import ✅ unit ✅ (6.4s 예측)
- **롤백**: `git checkout -- run_full_pipeline.py`
- **다음 단계 후보**: IndexPredictor 결과를 final_report_generator에 blending하여 최종 Top 10 등급에 반영

## 2026-04-05 (사이클 #1)
- **개선**: Equity Risk Premium (ERP) 센서 추가
- **근거**: https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns
  - Morningstar 2025: ERP = S&P500 earnings yield − TIPS 10y real yield가 장기 수익률 예측력 최상위
- **파일**: `collectors/macro_collector.py` +60줄
  - `fetch_tips_10y_real_yield()` 신규
  - `fetch_spy_earnings_yield()` 신규
  - `fetch_equity_risk_premium()` 신규
  - `get_macro_summary()` +3줄
- **결과**: ERP 1.87% → "과열 (주식 고평가)" 신호
  - TIPS 10y real: 1.97%
  - SPY forward earnings yield: 3.84% (P/E 26.0)
- **학습**: FRED DFII10 series와 yfinance forwardPE 조합이 안정적. 매번 호출당 ~2초 추가.
- **검증**: syntax ✅ import ✅ unit ✅
- **롤백**: `git checkout -- collectors/macro_collector.py`
- **다음 단계 후보**: ERP 값을 `market_regime.py`의 6번째 센서로 통합 고려
