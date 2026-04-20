---
created: 2026-04-19
updated: 2026-04-19
type: daily-note
project: us-stock
tags:
  - us-stock
  - dev-log
  - "2026-04"
git_commits: 4
session_count: 11+
session_tokens_out: 0
gha_runs: 4
sync_count: 1
last_sync: "—"
---

# 2026-04-19 us-stock 개발 노트

<!-- AUTO-START -->

## 개발 로그

### Claude 세션 현황

> [!info] 2026-04-18~19 Claude Code 세션 요약
> | 항목 | 값 |
> |------|-----|
> | 세션 수 | 11+ (resume 목록 기준) |
> | 출력 토큰 | — |
> | Git 커밋 | 4건 (2026-04-18) |
> | 주요 작업 | 강의자료 v8.4 업그레이드, 수강생 배포 패키지, Board 강의자료 패널, GHA SCP 우회, 아키텍처 문서 갱신 |

---

### 커밋 내역 (2026-04-18)

1. `21ebcd5` **[추가]** Board — 강의자료 패널 추가 + GHA SCP 실패 우회
2. `0d8970c` **[추가]** Board — Prompts/공지사항 카테고리 HTML 패널 연동
3. `0e1a6cc` **[개선]** Header — 명언 롤링 제거, 아인슈타인 명언 고정
4. `93845d9` **[배포]** downloads/us-stock.zip — 수강생 배포 패키지 추가

---

### 세션 작업 상세

#### 1. 강의자료 시스템 (핵심 테마)

| 세션 | 작업 내용 |
|------|----------|
| `lecture-materials-v8-4-upgrade` | 강의자료 v8.4 업그레이드 — 챕터 구성·콘텐츠 보강 |
| `upgrade-lecture-materials-v05` | v0.5 마일스톤 완성 — 전체 커리큘럼 재정비 |
| `part6-lecture-slides-md-cleanup` | Part 6 강의 슬라이드 Markdown 정리 |
| `stock-lecture-material-agent-team` | 강의자료 멀티에이전트 팀 구성·운용 |
| `create-us-teaching-materials` | 교육 자료 일괄 생성 (`docs/teaching-materials/` — 전체 HTML 포함) |

#### 2. Board / 대시보드 개선

| 변경 | 내용 |
|------|------|
| Board 강의자료 패널 | `docs/teaching-materials/` HTML을 Board에 직접 임베드 |
| Board Prompts·공지사항 | 카테고리 HTML 패널 연동 (정적 HTML fetch 방식) |
| GHA SCP 실패 우회 | `rsync` 대신 SSH pipe 방식으로 강의자료 파일 전송 우회 |
| Header 명언 고정 | 롤링 제거 → 아인슈타인 명언 단일 고정 (성능·주의 분산 개선) |

#### 3. 수강생 배포 패키지

| 세션 | 작업 내용 |
|------|----------|
| `create-student-deployment-package` | `downloads/us-stock.zip` 생성 — 수강생 배포용 패키지 |
| Download 페이지 (이전 커밋) | Navigation 등록 + i18n EN/KO + 더미 zip 서빙 |

#### 4. 시각화 / 그래프

| 세션 | 작업 내용 |
|------|----------|
| `stock-graph-knowledge-visualization` | 종목 지식 그래프 시각화 (Graph 페이지 연계) |
| `graph-sidebar-scroll-fullscreen` | 그래프 사이드바 스크롤 + 풀스크린 모드 |

#### 5. 인프라 / 데이터

| 세션 | 작업 내용 |
|------|----------|
| `sqlite-alert-system-migration` | SQLite 알림 시스템 마이그레이션 (Board 연동) |
| `rename-research-agent-data` | `docs/research/` → `docs/research-agent-data/` 이름 변경 (2026-04-17 작업 연속) |
| `update-architecture-docs` | `docs/architecture/` 다이어그램·운영 문서 갱신 |

---

### GHA 배포 현황

| 결과 | 워크플로 | SHA | 시각 (UTC) |
|------|---------|-----|----------|
| ✅ | Build & Deploy to Synology | 21ebcd5 | 2026-04-18 |
| ✅ | Build & Deploy to Synology | 0d8970c | 2026-04-18 |
| ✅ | Build & Deploy to Synology | 0e1a6cc | 2026-04-18 |
| ✅ | Build & Deploy to Synology | 93845d9 | 2026-04-18 |

---

### 개선 포인트

> [!warning] 주요 이슈 / 개선 (2026-04-18 세션)
> - [발견→개선 ✅][GHA] SCP를 통한 강의자료 파일 전송 실패 → SSH pipe 방식으로 우회. 근본 원인(Synology SCP 권한) 미해결 상태
> - [발견→개선 ✅][Header] 명언 롤링 애니메이션이 불필요한 주의 분산 유발 → 아인슈타인 명언 고정으로 심플화
> - [발견→개선 ✅][Board] 강의자료 HTML 패널 — 정적 HTML을 Board에 직접 임베드, iframe vs fetch 방식 선택
> - [발견→개선 ✅][downloads] 수강생 배포 패키지 경로 통일 — Download 페이지에서 직접 서빙

> [!question] 결정 필요 사항
> - [ ] GHA SCP 실패 근본 원인 해결 — Synology 측 권한/포트 설정 확인 필요
> - [ ] 강의자료 HTML vs Markdown 이중 관리 — `docs/teaching-materials/` 소스 단일화 방안
> - [ ] `stock-graph-knowledge-visualization` 세션 결과물 실제 반영 여부 — Graph 페이지 연동 완료 확인 필요
> - [ ] 수강생 배포 zip 자동화 — 강의자료 업데이트 시 zip 재생성 자동화 여부

<!-- AUTO-END -->

---

<!-- BACKLOG-START -->

## 백로그 스냅샷

> [!todo] P0/P1 미결 항목
> - [ ] **[P0]** `us_macro.csv` 시계열 축적 — `collectors/macro_collector.py`
> - [ ] **[P0]** IndexPredictor 결과를 final_report_generator에 blending — `analyzers/final_report_generator.py`
> - [ ] **[P0]** Brier Score + Platt Scaling 확률 보정 — `us_market/index_predictor.py`
> - [ ] **[P1]** ERP를 6번째 센서로 market_regime.py에 통합 — `analyzers/market_regime.py`
> - [ ] **[P1]** Volume sd_score 실제 계산 — `run_full_pipeline.py`, `analyzers/volume_analyzer.py`
> - [ ] **[P1]** GHA SCP 실패 근본 원인 해결 — Synology 권한·포트 설정

<!-- BACKLOG-END -->

---

## 리서치 메모

- 강의자료 멀티에이전트 팀(`stock-lecture-material-agent-team`) 세션 — 에이전트 팀 패턴으로 대량 교육 콘텐츠 생성이 가능함을 검증. 단일 세션 대비 병렬 생산 효율 우수.
- Board의 HTML 임베드 패턴(정적 파일 직접 패널화)이 SQLite API 방식 대비 구현 비용 훨씬 낮음. 강의자료처럼 자주 바뀌지 않는 콘텐츠에는 유효한 접근.

---

## 오늘의 계획

- [ ] GHA SCP 실패 근본 원인 조사 (Synology 측 권한·포트)
- [ ] 강의자료 최신화 반영 여부 edu.frindle.synology.me 헬스체크
- [ ] Graph 페이지 knowledge-visualization 결과물 확인
- [ ] P0 백로그 진행 여부 결정

## 메모

- 2026-04-18 대규모 강의자료 작업 — resume 세션 11개 중 약 6개가 강의자료 관련
- 수강생 배포 패키지(`downloads/us-stock.zip`) 첫 배포 완료
- 2026-04-19 현재까지 신규 커밋 없음

## 퇴근 전 점검

- [ ] GHA 빌드 확인 (`gh run list --limit 5`)
- [ ] 데이터 갱신 여부 확인 (chore(data) 커밋 필요 시 파이프라인 실행)
- [ ] edu.frindle.synology.me 헬스체크
- [ ] 강의자료 페이지 Board 임베드 정상 표시 확인
- [ ] 오늘 변경분 커밋·푸시 (사용자 승인 후)
