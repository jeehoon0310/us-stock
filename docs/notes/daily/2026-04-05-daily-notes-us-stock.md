# 2026-04-05 Evolution Cycle #3 — 문서 동기화 + drawio 겹침 수정

## Phase 1: 현황 파악

**직전 작업**: Summary2.md 22 이미지 분석 → backlog 6건 추가 (P0 1건 + P1 2건 + P2 3건)
**사용자 제보**: drawio 스크린샷 공유 — `p5_cfg`/`p5_confidence` 박스가 `p5_f_macro`/`p5_f_vol`/`p5_f_mom` 피처 박스와 겹쳐 있음

**현재 상태**:
- backlog.md는 업데이트됨 (Summary2 인사이트 6건 반영)
- 공개 문서 4개 (`docs/`)는 미동기화 상태
- drawio는 시각적 겹침 발생

## Phase 2: 트렌드 리서치 (스킵)

사용자 직접 지시라 외부 리서치 불필요. backlog 점검만 수행.

## Phase 3: Gap Analysis

| 영역 | 현재 | 필요 | Gap |
|------|------|------|-----|
| docs/architecture.drawio | p5_cfg x=540,y=1620 (피처 박스와 겹침) | 겹침 제로 | 좌표 이동 필요 |
| docs/DASHBOARD-EASY-GUIDE.md | Summary2 인사이트 미반영 | Brier Score 섹션 | 초등학생 톤 추가 |
| docs/prompt_전체.md | Part 5 섹션만 있음 | Summary2 분석 기록 | 5.7 하위 섹션 |
| docs/prompt_v2.md | 프롬프트 1~12 | Brier+Platt 프롬프트 | 13, 14 추가 |

## Phase 4: 오늘의 개선 선정

- **제목**: 문서 동기화 + drawio 좌표 겹침 수정
- **대상**: 4개 docs/ 파일
- **근거**: 사용자 직접 제보 + 직전 backlog 업데이트 후속 작업
- **Impact**: High (문서-backlog 정합성 유지, 시각 가독성 복원)
- **Effort**: Medium (4개 파일 수정, ~40분)
- **Risk**: Low (문서만 수정, 코드 무변경)

## Phase 5: 코드(문서) 변경

### drawio 좌표 이동
```
p5_cfg:        (540, 1620, 300x40) → (60, 1680, 490x32)
p5_confidence: (540, 1668, 300x40) → (560, 1680, 280x32)
신규 p7_summary2_ref: (60, 1990, 1490x28)
```

### 3개 문서 섹션 추가
- **DASHBOARD-EASY-GUIDE.md**: "Brier Score — 확률 정답률 채점표" (초등학생 톤)
- **prompt_전체.md**: 5.7 Summary2.md 이미지 분석 섹션
- **prompt_v2.md**: 프롬프트 13 (Brier+Platt) + 14 (Rule↔ML 상충)

## Phase 6: 검증 결과

- **Layer 1 (XML parse)**: ✅ `ET.parse('architecture.drawio')` 성공
- **Layer 2 (좌표 확인)**:
  - p5_cfg: x=60, y=1680, w=490 ✅
  - p5_confidence: x=560, y=1680, w=280 ✅
  - p7_summary2_ref: x=60, y=1990, w=1490 ✅
- **Layer 3 (grep 확인)**:
  - DASHBOARD Brier Score: 5건 ✅
  - prompt_전체 5.7 섹션: 1건 ✅
  - prompt_v2 프롬프트 13/14: 2건 ✅
  - drawio Summary2 ref: 1건 ✅

## Phase 7: 문서

- `.docs/evolution/memory.md`: Cycle #3 entry + Do's 항목 추가 ("다이어그램 좌표 충돌 선검사")
- `.docs/evolution/backlog.md`: Completed에 Cycle #3 추가
- `.docs/evolution/2026-04-05_cycle3.md`: 본 파일 (7-Phase 로그)

## 다음 사이클 후보 (Cycle #4)

### P0 우선 (backlog 기반)
- [ ] **Brier Score + Platt Scaling 확률 보정** (prompt_v2.md 프롬프트 13 기반, 근거 Summary2-11 -28% 실측)
- [ ] `us_macro.csv` 시계열 축적
- [ ] IndexPredictor → final_report blending

### 이번 사이클 교훈
- 사용자 제보는 **즉시 최우선 처리**: 기존 backlog P0보다 사용자 직접 제보가 우선
- 다이어그램 업데이트 시 **기존 노드 좌표 충돌 검사** 자동화 필요 (future: drawio_overlap_checker.py)
