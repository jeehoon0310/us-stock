---
created: 2026-04-17
updated: 2026-04-17
type: daily-note
project: us-stock
tags:
  - us-stock
  - dev-log
  - "2026-04"
git_commits: 10+
session_count: 1
session_tokens_out: 0
gha_runs: 0
sync_count: 1
last_sync: "10:55"
---

# 2026-04-17 us-stock 개발 노트

<!-- AUTO-START -->

## 개발 로그

### Claude 세션 현황

> [!info] 2026-04-17 Claude Code 세션 요약
> | 항목 | 값 |
> |------|-----|
> | 세션 수 | 1 (현재 세션, 미집계) |
> | 출력 토큰 | — (세션 종료 후 `/daily-note-us-stock` 재실행 시 갱신) |
> | Git 커밋 | 10건 (오늘 누적) |
> | 주요 작업 | KEY DRIVERS 라벨 사용자 친화화, FeatureInfoBtn 클릭 토글 팝오버, HelpBtn 모달 확장 (max-w-4xl), 모바일 반응형 대응, 프론트엔드 검증 하네스 wiki 작성, daily 노트 디렉토리 정리 + 스킬 경로 갱신 |

---

### 커밋 내역

1. `c4899e4` **[개선]** Performance look-ahead bias 수정 + Smart Money 방법론 HelpBtn + 캘린더 버그 수정
2. `797d1a3` **[수정]** CalendarPicker 날짜 비활성 버그 2종 수정
3. `3b9d6f3` **[수정]** frontend/app/api/data/ 라우트 git 추가 + .gitignore 예외 처리
4. `5a15c99` **[수정]** .dockerignore — data/ → /data/ (루트 한정, api/data 라우트 포함)
5. `670b7ae` **[수정]** .dockerignore — frontend/app/api/data/ 빌드 컨텍스트 제외 버그 수정
6. `b566a28` **[개선]** SQLite 마이그레이션 완성 + 배치 스크립트 수정
7. `a6c0543` **[추가]** Board 카테고리 이름 변경 + 방문자수 위젯
8. `a2e7c2d` **[개선]** TopNav 리네임 + Board 공지사항 + HelpBtn 누락 보완
9. `b31ae01` **[수정]** board/page.tsx — Link import 복원 (린터 오류)
10. `77f0777` **[추가]** Board 게시판 — SQLite + Reddit UI

---

### 세션 작업 상세 (현재 세션, 커밋 전)

| 변경 | 파일 | 내용 |
|------|------|------|
| 신규 | `frontend/src/lib/featureLabels.ts` | 13개 ML 피처 → UPPERCASE 라벨 + 한국어 설명 매핑 (`spy_vol_trend_5d` → `SPY 5D VOL TREND`), 미매핑 키 fallback 포매터 |
| 신규 | `frontend/src/components/FeatureInfoBtn.tsx` | 클릭 토글 팝오버 (`?` 버튼). ESC/외부클릭 닫기, `role="tooltip"`, 모바일 fixed center / 데스크톱 absolute inline |
| 수정 | `frontend/app/forecast/page.tsx` | `Drivers` 컴포넌트 — `{d.feature}` raw 출력 → `formatFeatureLabel` 매핑 + `FeatureInfoBtn` 삽입 |
| 수정 | `frontend/src/components/HelpBtn.tsx` | 모달 폭 `max-w-sm` → `max-w-4xl`, 본문 폰트 `text-[13px]` → `text-sm`, `Box` `text-xs` → `text-sm` + 모바일 wrap·데스크톱 nowrap 분기 |
| 신규 | `.omc/wiki/frontend-verify-harness.md` | tsc → build → Playwright → dev 서버 4단계 검증 하네스 규칙 |
| 갱신 | `.omc/wiki/index.md` | 27 pages, frontend-verify-harness 항목 추가 |
| 이동 | `docs/notes/2026-04-{03,04,05,15}-daily-notes-us-stock.md` → `docs/notes/daily/` | 4개 파일 격리. 백로그·메모·evolution/research 디렉토리와 분리 |
| 갱신 | `~/.claude/skills/daily-note-us-stock/SKILL.md` | REPO 경로 정정 (`education` → `synology`), 출력 디렉토리 `docs/notes/daily/`로 변경 |

---

### GHA 배포 현황

| 결과 | 워크플로 | SHA | 시각 (UTC) |
|------|---------|-----|----------|
| (오늘 push 없음 — 로컬 변경만, 미커밋 상태) | — | — | — |

---

### 개선 포인트

> [!warning] 4건의 이슈/개선 (오늘 세션)
> - [발견→개선 ✅][forecast/key-drivers] ML 피처 라벨이 `spy_vol_trend_5d` 같은 snake_case raw key로 노출 → 일반 사용자 의미 파악 불가 → `featureLabels.ts` 매핑 dict + UPPERCASE 라벨 + `?` 도움말 버튼 도입
> - [발견→개선 ✅][FeatureInfoBtn] 1차 구현 시 native HTML `title` 속성 사용 → 클릭 시 동작 안 함, 모바일 미지원 → 클릭 토글 팝오버로 재작성 (state + 외부클릭 backdrop)
> - [발견→개선 ✅][HelpBtn] 모달 `max-w-sm` 좁아서 한국어 긴 문장 강제 줄바꿈 → `max-w-4xl` + 본문 폰트 `text-sm` + `Box` 데스크톱 nowrap → 한 줄 가독성 확보
> - [발견→개선 ✅][mobile] 데스크톱 인라인 팝오버가 모바일에서 화면 밖 overflow → `sm:` 분기로 모바일 fixed center, 데스크톱 absolute inline 분리. Box도 모바일 wrap 허용

> [!question] 결정 필요 사항
> - [ ] Playwright 정식 도입 여부 — 인터랙티브 컴포넌트(클릭 토글, 모달, 드롭다운) 누적 중. wiki 하네스에 임시 대안 명시했으나 자동화 권장
> - [ ] `FeatureInfoBtn` description 다국어 — i18n(`useT`/`useLang`)이 forecast/page.tsx에 추가됨. 현재는 한국어 고정. lang별 desc 매핑으로 확장 필요 시점
> - [ ] `daily-note-us-stock` 스킬의 REPO 경로가 `workspace/education/us-stock` (오답)이었던 원인 — 초기 생성 시점의 잘못된 경로? 다른 us-stock 인스턴스 존재 여부 확인

---

### 세션 2 작업 상세 (디렉토리 구조 정리)

#### 1. 디렉토리 혼동 분석

`docs/research/` vs `.claude/agents/research/` 두 경로의 역할이 다름을 분석.

| 경로 | 역할 |
|------|------|
| `docs/research/` | 에이전트가 생성·저장하는 **데이터 디렉토리** (분석 결과, 리포트 등) |
| `.claude/agents/research/` | 에이전트 **정의 파일** (프롬프트, 역할 명세) |

`docs/notes/research/` 내 `claude-terminal-03.md` 기존 분석도 참조하여 결론 확정.

---

#### 2. docs/research → docs/research-agent-data 이름 변경

경로 의미를 명확히 하기 위해 `docs/research/` → `docs/research-agent-data/` 로 변경.

```bash
git mv docs/research docs/research-agent-data
```

변경에 따른 에이전트 정의 파일 내 경로 참조 일괄 수정:

| 파일 | 수정 건수 |
|------|----------|
| `.claude/agents/research/research-lead.md` | 4개 경로 참조 |
| `.claude/agents/research/paper-researcher.md` | 3개 경로 참조 |
| `.claude/agents/research/factor-discoverer.md` | 1개 경로 참조 |
| `.claude/agents/research/market-researcher.md` | 1개 경로 참조 |

---

#### 3. docs/agents → .claude/agents 통합

에이전트 관련 파일을 `.claude/agents/` 하위로 일원화.

| 이전 경로 | 이후 경로 |
|-----------|-----------|
| `docs/agents/_archive/` | `.claude/agents/_archive/` |
| `docs/agents/PERFORMANCE-GUIDE.md` | `.claude/agents/guides/` |
| `docs/agents/daily-performance-prompts.md` | `.claude/agents/guides/` |
| `docs/agents/daily-evolution-prompts.md` | `.claude/agents/guides/` |
| `docs/agents/SETUP.md` | `.claude/agents/guides/` |

이후 `docs/agents/` 폴더 완전 제거.

---

#### 4. .claude/agents/guides → .claude/agents/daily 이름 변경

가이드 문서 디렉토리 명칭을 실제 용도에 맞게 변경.

```bash
git mv .claude/agents/guides .claude/agents/daily
```

---

#### 5. Antigravity IDE 설정 변경

파일 탐색기 정렬 방식을 확장자(종류)별 정렬로 변경.

- 대상: `~/Library/Application Support/Antigravity/User/settings.json`
- 추가 설정: `"explorer.sortOrder": "type"`
- 효과: 파일 탐색기에서 파일을 종류별로 그룹화하여 표시

> [!tip] 세션 2 정리 원칙
> - **에이전트 데이터** (`docs/research-agent-data/`) vs **에이전트 정의** (`.claude/agents/research/`) 명확히 분리
> - 에이전트 관련 모든 정의·가이드·아카이브는 `.claude/agents/` 하위로 일원화
> - 디렉토리명은 실제 용도를 직접 반영할 것 (research → research-agent-data, guides → daily)

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

<!-- BACKLOG-END -->

---

## 리서치 메모

- 오늘 도출된 패턴: **인터랙티브 UI 변경은 컴파일 통과 ≠ 동작 보장.** native `title` 속성처럼 컴파일러가 의미 차이를 알지 못하는 케이스가 흔함. 향후 `useState` 토글이나 이벤트 핸들러를 추가하는 PR은 Playwright/수동 클릭 체크 필수.
- 모바일 우선(Mobile-First) Tailwind 분기(`sm:` 접두사)가 모달·팝오버·툴팁에 일관되게 누락되어 있음. 신규 인터랙티브 컴포넌트 작성 시 기본 → `sm:` 오버라이드 패턴을 컴포넌트 템플릿에 포함 권장.

---

## 오늘의 계획

- [x] KEY DRIVERS 피처 라벨 사용자 친화화
- [x] HelpBtn 모달 확장 + Box 가독성 개선
- [x] 모바일 반응형 대응
- [x] 프론트엔드 검증 하네스 wiki 정리
- [x] daily 노트 디렉토리 분리 + 스킬 경로 정정
- [ ] Playwright 도입 여부 결정
- [ ] 변경분 커밋 (KEY DRIVERS / FeatureInfoBtn / HelpBtn / wiki / 노트 이동)

## 메모

- 현 세션 미커밋 변경분: 7개 파일 (3 신규 + 4 수정) + 4 노트 이동 + SKILL.md 갱신
- dev 서버는 이미 3000 포트에서 실행 중 (별도 기동 불필요, EADDRINUSE 무시)
- HTTP 200 OK 확인 (`/forecast`)

## 퇴근 전 점검

- [ ] GHA 빌드 확인 (`gh run list --limit 3`) — 미커밋 상태로 push 없음
- [ ] 데이터 갱신 여부 확인 (chore(data) 커밋 필요 시 파이프라인 실행)
- [ ] 스크린샷 갱신 필요 여부 (`take_screenshots.py`) — KEY DRIVERS UI 변경됨, notice 갤러리 갱신 후보
- [ ] edu.frindle.synology.me 헬스체크
- [ ] 오늘 변경분 커밋·푸시 (사용자 승인 후)
