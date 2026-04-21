---
created: 2026-04-22
updated: 2026-04-22
type: daily-note
project: us-stock
tags:
  - us-stock
  - dev-log
  - "2026-04"
git_commits: 2
session_count: 0
session_tokens_out: 0
gha_runs: 0
sync_count: 1
last_sync: "2026-04-22T09:00:00+09:00"
---

# 2026-04-22 us-stock 개발 노트

<!-- AUTO-START -->

## 개발 로그

### Claude 세션 현황

> [!info] 2026-04-22 Claude Code 세션 요약
> | 항목 | 값 |
> |------|-----|
> | 세션 수 | 0 |
> | 출력 토큰 | 0 |
> | Git 커밋 | 2 |
> | 주요 작업 | (세션 데이터 없음) |

---

### 커밋 내역

1. `853b38d` `[수정]` v2 URL에 v3 콘텐츠 적용 — gen 스크립트가 v2/v3 동시 출력
2. `9eea3b9` `[추가]` 강의 슬라이드 v3 — 다크/라이트 토글 포함

---

### GHA 배포 현황

- GHA 데이터 없음

---

### 개선 포인트

> [!warning] 1건의 이슈/메모 (오늘 세션에서 발견·개선)
> - [발견→개선 ✅][수정] v2 URL에 v3 콘텐츠 적용 — gen 스크립트가 v2/v3 동시 출력

> [!question] 결정 필요 사항
> - [ ] `[추가]` 직후 `[수정]` 패턴 감지 — 강의 슬라이드 v3 추가 직후 URL 수정 발생, 설계 재검토 고려 (v2/v3 URL 분기 전략 확정 필요)

<!-- AUTO-END -->

---

<!-- BACKLOG-START -->

## 백로그 스냅샷

> [!todo] P0/P1 미결 항목 (backlog.md 자동 발췌)
> - [ ] **[P0]** **`us_macro.csv` 시계열 축적** — 현재 snapshot 1행만 저장. 매일 append로 ML 피처 축적 필요
> - [ ] **[P0]** **IndexPredictor 결과를 final_report_generator에 blending** — SPY/QQQ 방향 예측이 있으면 Top 10 등급 조정
> - [ ] **[P0]** **Brier Score + Platt Scaling 확률 보정** — IndexPredictor 성능 **-28% 개선** 검증됨
> - [ ] **[P1]** **ERP를 6번째 센서로 market_regime.py에 통합** — 2026-04-05 추가된 ERP를 regime score에 반영
> - [ ] **[P1]** **Volume sd_score 실제 계산** — 현재 고정값 50 플레이스홀더

<!-- BACKLOG-END -->

---

## 리서치 메모

- 

---

## 오늘의 계획

- [ ] 

## 메모

- 

## 퇴근 전 점검

- [ ] GHA 빌드 확인 (`gh run list --limit 3`)
- [ ] 데이터 갱신 여부 확인 (chore(data) 커밋 필요 시 파이프라인 실행)
- [ ] 스크린샷 갱신 필요 여부 (`take_screenshots.py`)
- [ ] edu.frindle.synology.me 헬스체크
- [ ] 내일 작업 계획 수립
