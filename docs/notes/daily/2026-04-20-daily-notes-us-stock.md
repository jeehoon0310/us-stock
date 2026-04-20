---
created: 2026-04-20
updated: 2026-04-20
type: daily-note
project: us-stock
tags:
  - us-stock
  - dev-log
  - "2026-04"
git_commits: 3
session_count: 0
session_tokens_out: 0
gha_runs: 3
sync_count: 0
last_sync: "—"
---

# 2026-04-20 us-stock 개발 노트

<!-- AUTO-START -->

## 개발 로그

### Claude 세션 현황

> [!info] 2026-04-20 Claude Code 세션 요약
> | 항목 | 값 |
> |------|-----|
> | 세션 수 | 0 (현재 집계 전) |
> | 출력 토큰 | — |
> | Git 커밋 | 3건 |
> | 주요 작업 | 강의자료 PDF 3종 추가, Viewer 비밀번호 인증, lesson01~03 zip 파일 정리 |

---

### 커밋 내역

1. `0c4eaca` **[추가]** downloads — 강의자료 PDF 3종 추가 (전체 슬라이드 변환)
2. `38135fc` **[개선]** Viewer — PDF 내려받기 비밀번호 인증 추가
3. `06afbcb` **[삭제]** downloads — lesson01~03 zip 파일 제거

---

### GHA 배포 현황

| 결과 | 워크플로 | SHA | 시각 (UTC) |
|------|---------|-----|----------|
| ✅ success | Build & Deploy to Synology | 0c4eaca | 2026-04-20 02:06 |
| ✅ success | Build & Deploy to Synology | 38135fc | 2026-04-20 01:40 |
| ✅ success | Build & Deploy to Synology | 06afbcb | 2026-04-20 01:34 |

---

### 개선 포인트

> [!warning] 이슈 / 개선 (오늘 세션)
> - [개선 ✅][downloads] lesson01~03 zip 파일 제거 → PDF 3종으로 대체. 파일 포맷 단일화 (zip → PDF)
> - [개선 ✅][Viewer] PDF 내려받기에 비밀번호 인증 추가 — 수강생 외 무단 다운로드 방지

> [!question] 결정 필요 사항
> - [ ] PDF 변환 자동화 여부 — 강의자료 업데이트 시 수동 재변환 vs CI 자동 생성 파이프라인
> - [ ] 비밀번호 인증 방식 — 현재 단일 비밀번호, 수강생별 토큰 방식으로 확장 필요 시점 판단

<!-- AUTO-END -->

---

<!-- BACKLOG-START -->

## 백로그 스냅샷

> [!todo] P0/P1 미결 항목 (backlog.md 자동 발췌)
> - [ ] **[P0]** `us_macro.csv` 시계열 축적 — `collectors/macro_collector.py`
> - [ ] **[P0]** IndexPredictor 결과를 final_report_generator에 blending — `analyzers/final_report_generator.py`
> - [ ] **[P0]** Brier Score + Platt Scaling 확률 보정 — `us_market/index_predictor.py`
> - [ ] **[P1]** ERP를 6번째 센서로 market_regime.py에 통합 — `analyzers/market_regime.py`
> - [ ] **[P1]** Volume sd_score 실제 계산 — `run_full_pipeline.py`, `analyzers/volume_analyzer.py`
> - [ ] **[P1]** Rule-Based vs ML 상충 감지 + mean-reversion 플래그 — `analyzers/final_report_generator.py`
> - [ ] **[P1]** Fold별 Accuracy 대시보드 노출 — `us_market/index_predictor.py`
> - [ ] **[P1]** GHA SCP 실패 근본 원인 해결 — Synology 권한·포트 설정

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
