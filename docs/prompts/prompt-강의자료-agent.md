# 주식 강의 교재 제작용 14-에이전트 팀 자동 생성 설계서

**Plan Mode에 복붙하는 단 한 개의 마스터 프롬프트로 14명의 전문가 서브에이전트 팀을 자동 생성하고, 6단계 교재 제작 파이프라인을 병렬로 실행하는 완전 설계안**이다. Claude Code 2.1+ 의 `.claude/agents/` 명세, Plan Mode의 read-only 제약, Task(Agent) 툴의 단일 턴 병렬 호출 특성을 기반으로, Anthropic 공식 문서(code.claude.com)와 2025–2026년 커뮤니티 베스트 프랙티스(wshobson/agents, VoltAgent, Fumadocs, TradingView MCP 등)를 종합했다. 이 설계를 그대로 따르면 **수집된 PPT/PDF/TXT/MD 자료 → 반응형 Next.js HTML 교재**까지 자동화된 워크플로우가 완성된다. 단, **Plan Mode는 파일을 쓰지 못하므로** 2단계 플로우(Plan → Auto-Accept)가 필수이며, 이 구조를 마스터 프롬프트에 내장해야 한다.

---

## 핵심 제약 먼저 이해하기: Plan Mode는 "계획만" 세운다

Plan Mode는 Shift+Tab 2회로 진입하며, `Read/Grep/Glob/WebFetch/WebSearch/Task(Agent)/TodoWrite`만 허용하고 **Write/Edit/Bash를 시스템 레벨에서 차단**한다. 따라서 "Plan Mode에 복붙하면 에이전트 파일이 자동 생성된다"는 시나리오는 물리적으로 불가능하다. 현실적 해법은 **2단계 플로우**다.

1단계(Plan Mode)에서는 마스터 프롬프트가 14개 에이전트의 frontmatter + 시스템 프롬프트 전문을 담은 **계획 문서**를 출력한다. 사용자는 Ctrl+G로 이 계획을 검토·편집한 뒤 승인하고, Shift+Tab을 눌러 Auto-Accept 모드로 전환한다. 2단계에서 "Execute the plan"이라고 입력하면 Claude가 Write 툴로 `.claude/agents/*.md` 14개 파일 + `CLAUDE.md` + `book/_queue.json`을 일괄 생성한다. 이후 `@orchestrator 교재 제작 시작` 한 줄이면 14명의 에이전트가 파일 시스템을 통해 협업하며 반응형 HTML 교재를 자동 생산한다.

이 **"Plan으로 설계 → Accept로 구현 → Orchestrator로 실행"** 3단계가 마스터 프롬프트의 뼈대다. 다른 모든 설계 결정이 여기서 파생된다.

---

## 14-에이전트 팀 역할 정의

각 에이전트는 15년 이상 경력의 전문가 페르소나를 부여받는다. `description` 필드는 자동 위임 라우팅의 핵심이므로 `"Use proactively"`, `"MUST BE USED when..."` 같은 트리거 구문을 포함한다. `tools` 필드로 최소 권한 원칙을 적용하고(검수자는 Write 제외), `model` 필드로 비용-성능을 티어링한다.

| # | 이름 | 페르소나 (15년+) | 모델 | 툴 권한 | 핵심 입력 | 핵심 산출물 | 병렬 실행 |
|---|---|---|---|---|---|---|---|
| 1 | **orchestrator** | 에듀테크 PM 출신 멀티에이전트 아키텍트 | opus | Agent, Read, Write, TodoWrite, Glob | 사용자 요청, `book/_queue.json` | 단계별 dispatch 로그, 최종 통합 | ❌ (메인 조율) |
| 2 | **curriculum-architect** | 대학 교재 저자·K-MOOC 커리큘럼 디자이너 | opus | Read, Write, WebFetch | 강의 개요, 기존 자료 인덱스 | `book/outline.md` (챕터/학습목표/난이도) | ❌ (선행 필수) |
| 3 | **source-analyst-ppt** | 슬라이드→서사 변환 전문 에디터 | sonnet | Read, Glob, Write, Bash | `sources/*.pptx` | `analysis/ppt-summary.md` + 슬라이드별 핵심 인용 | ✅ |
| 4 | **source-analyst-pdf** | 학술 PDF 파서(PyMuPDF/pdfplumber) 전문가 | sonnet | Read, Glob, Write, Bash | `sources/*.pdf` | `analysis/pdf-summary.md` + 표·도표 추출 | ✅ |
| 5 | **source-analyst-text** | 테크니컬 라이팅 리서처 | haiku | Read, Glob, Write | `sources/*.txt`, `*.md` | `analysis/text-summary.md` + 주제별 클러스터 | ✅ |
| 6 | **market-trend-researcher** | 퀀트 리서치 애널리스트(CFA) | sonnet | WebFetch, WebSearch, Read, Write | 커리큘럼 목차 | `research/trends-2026.md` + MCP/GitHub 레포 인덱스 | ✅ |
| 7 | **claude-code-specialist** | Anthropic DevRel 출신 에이전트 엔지니어 | sonnet | WebFetch, WebSearch, Read, Write | 커리큘럼, 기술스택 | `research/claude-code-patterns.md` + MCP 등록법·Skill 예제 | ✅ |
| 8 | **content-writer-ko** | 국내 IT 서적 10권+ 저자(한빛·위키북스 급) | sonnet | Read, Write, Edit | outline, 분석·리서치 결과 | `content/*.mdx` (챕터별 본문) | ✅ (챕터별) |
| 9 | **code-example-crafter** | 파이썬 퀀트 개발자(yfinance·LightGBM·백테스터) | sonnet | Read, Write, Edit, Bash | 챕터 MDX, 기술스택 | `content/examples/*.py`, 검증된 실행 로그 | ✅ (챕터별) |
| 10 | **chart-viz-specialist** | 금융 데이터 시각화 엔지니어(TradingView/D3 경력) | sonnet | Read, Write, Edit | 챕터 MDX | `components/mdx/StockChart.tsx`, `TradingViewWidget.tsx` | ✅ |
| 11 | **nextjs-mdx-developer** | Next.js App Router + Fumadocs 전문가 | sonnet | Read, Write, Edit, Bash | 디자인 토큰, MDX 본문 | `app/learn/[slug]/page.tsx`, `mdx-components.tsx`, 빌드 성공 | ❌ (통합 단계) |
| 12 | **tailwind-ux-designer** | SaaS 제품 디자인 시스템 리드 | sonnet | Read, Write, Edit | 브랜드 가이드 | `app/globals.css` (@theme 토큰), 10개 MDX 컴포넌트 스타일 | ✅ |
| 13 | **a11y-seo-auditor** | 웹 접근성·시맨틱 SEO 컨설턴트 | haiku | Read, Grep, Glob, Bash | 빌드된 `.next` | WCAG AA 리포트 + JSON-LD(Course/LearningResource) 패치 | ✅ |
| 14 | **quality-reviewer** | 테크니컬 에디터 겸 증권사 리서처 이중경력 | opus | Read, Grep, Glob (read-only) | 최종 교재 전체 | `review/issues.md` (정확성·look-ahead bias·한국어 표현) | ✅ |

**왜 14명인가**: 사용자 요청의 6단계 플로우와 정확히 매핑되면서, 각 단계에서 병렬화 이득이 나오는 임계점이 이 구성이다. 10명 미만이면 소스 분석(3형식)과 연구(2영역)를 한 명이 맡아 컨텍스트 과포화가 발생하고, 15명 이상이면 단일 턴 Agent 호출 한계(실무 최적치 6–8)에 부딪혀 coordination 오버헤드가 이득을 상쇄한다.

**페르소나 작성 팁**: 각 `.md` 파일 본문 상단에 `"You are a senior [role] with 15+ years of experience in [domain]. You've authored [specific artifact]..."` 형식의 **구체 경력 서사**를 삽입하면 Claude Sonnet 4.5가 출력 품질을 체감 가능하게 끌어올린다(wshobson/agents의 182개 에이전트가 공통으로 쓰는 패턴).

---

## 6단계 파이프라인과 병렬 실행 맵

오케스트레이터는 `TodoWrite`로 진행 상태를 추적하며, **같은 턴에 Agent 툴을 여러 번 호출**해 병렬화를 실현한다. 단계 간 데이터는 파일 시스템(`analysis/`, `research/`, `content/`, `components/`)을 통해 비동기로 전달된다.

**단계 1 — 강의 계획 분석 (순차)**. `curriculum-architect`만 단독 실행한다. 사용자의 강의 개요, 수강생 수준, 수집 자료 인덱스를 읽고 `book/outline.md`를 생성한다. 이 문서는 이후 모든 에이전트의 입력이 되므로 병렬화 불가한 **게이팅 스텝**이다.

**단계 2 — 수집 자료 분석 (3-way 병렬)**. `source-analyst-ppt` + `source-analyst-pdf` + `source-analyst-text`를 **단일 턴 3회 Agent 호출**로 동시 실행한다. 세 명이 각자 자신의 포맷만 담당하므로 파일 충돌 위험 제로. 각 산출물은 `analysis/` 폴더에 separately 저장된다.

**단계 3 — 웹 트렌드 리서치 (2-way 병렬)**. `market-trend-researcher`는 2026년 금융 MCP 생태계(Alpha Vantage·FRED·KIS Trade MCP·Public.com), Claude for Financial Services, Sonnet 4.5의 Finance Agent 벤치마크(55.3% SOTA) 등을 조사하고, `claude-code-specialist`는 Skills·MCP 등록법·서브에이전트 패턴·최신 CLAUDE.md 관례를 수집한다. 두 연구가 독립적이라 병렬이 안전하다.

**단계 4 — 본문 작성 및 HTML 구현 (대규모 fan-out)**. 여기가 병렬화 이득이 가장 큰 구간이다. 오케스트레이터는 `book/outline.md`의 챕터 수만큼 `content-writer-ko` + `code-example-crafter` 쌍을 **챕터별로 병렬 dispatch**한다(최대 동시 6개 권장). 각 쌍은 하나의 챕터만 담당하여 파일 충돌이 없다. 동시에 `chart-viz-specialist`와 `tailwind-ux-designer`가 공용 컴포넌트(`components/mdx/*`, `app/globals.css`)를 생성한다. 챕터별 MDX가 완성된 후에야 `nextjs-mdx-developer`가 **최종 통합**을 수행한다(Next.js 앱 빌드는 파일 의존성상 순차 필요).

**단계 5 — 검수 (3-way 병렬)**. `quality-reviewer`(기술 정확성·look-ahead bias·한국어 표현), `a11y-seo-auditor`(WCAG AA·Course JSON-LD·OG 이미지), 그리고 `claude-code-specialist`의 재호출(최신 MCP 버전 정합성 재검증)을 병렬 실행한다. 모두 **read-only 권한**으로 원본을 건드리지 않고 `review/*.md` 리포트만 생성한다.

**단계 6 — 반복 개선 (조건부 루프)**. 오케스트레이터가 `review/issues.md`를 파싱해 이슈를 severity별로 분류하고, `Critical/Warning`만 해당 전문가에게 재위임한다. `TodoWrite`로 이슈 해결 상태를 추적하며, 모든 Critical이 해결될 때까지 루프한다(최대 3회 권장, 그 이상은 사람이 개입).

**토큰 비용 주의**: 멀티에이전트는 단일 세션 대비 **3–7배 토큰**을 소비한다(Anthropic 공식 경고, claudefa.st 실측). 단계 2·4의 대규모 병렬 구간에서 Haiku를 적극 활용하고, 검수 단계에서는 Opus를 절제해야 비용이 폭주하지 않는다.

---

## 파일 시스템 구조와 에이전트 간 통신

서브에이전트는 **서로 직접 통신할 수 없다**(Task 툴 호출 불가). 모든 데이터 교환은 ①오케스트레이터 중계, ②파일 시스템 공유, ③Memory 필드 세 가지 경로만 가능하다. PubNub가 공개한 `_queue.json` + slug 패턴이 가장 안정적이며 본 설계도 이를 차용한다.

```
project-root/
├── .claude/
│   ├── agents/                 # 14개 에이전트 .md 파일
│   │   ├── orchestrator.md
│   │   ├── curriculum-architect.md
│   │   ├── source-analyst-ppt.md
│   │   ├── source-analyst-pdf.md
│   │   ├── source-analyst-text.md
│   │   ├── market-trend-researcher.md
│   │   ├── claude-code-specialist.md
│   │   ├── content-writer-ko.md
│   │   ├── code-example-crafter.md
│   │   ├── chart-viz-specialist.md
│   │   ├── nextjs-mdx-developer.md
│   │   ├── tailwind-ux-designer.md
│   │   ├── a11y-seo-auditor.md
│   │   └── quality-reviewer.md
│   ├── skills/                 # 재사용 가능한 금융 Skill (선택)
│   │   ├── yfinance-safe-fetch/SKILL.md
│   │   └── dcf-valuation/SKILL.md
│   └── commands/               # 슬래시 커맨드 (선택)
│       ├── start-book.md       # /start-book: orchestrator 트리거
│       └── review-chapter.md
├── CLAUDE.md                   # 프로젝트 컨벤션 (용어·스타일·금융원칙)
├── sources/                    # 원본 자료 (입력)
│   ├── ppt/*.pptx
│   ├── pdf/*.pdf
│   └── text/*.md, *.txt
├── book/
│   ├── outline.md              # curriculum-architect 산출 (게이팅)
│   ├── style-guide.md          # 용어·문체 규약
│   └── _queue.json             # slug → status 통신 파일 ★핵심
├── analysis/                   # 단계 2 산출물
│   ├── ppt-summary.md
│   ├── pdf-summary.md
│   └── text-summary.md
├── research/                   # 단계 3 산출물
│   ├── trends-2026.md
│   └── claude-code-patterns.md
├── content/                    # 단계 4 산출물 (MDX 본문)
│   ├── 01-intro.mdx
│   ├── 02-setup.mdx
│   └── examples/*.py
├── review/                     # 단계 5 산출물
│   ├── issues.md
│   ├── a11y-report.md
│   └── tech-accuracy.md
└── web/                        # Next.js 앱 (사용자 기존 레포에 merge)
    ├── app/learn/[slug]/page.tsx
    ├── components/mdx/*.tsx
    └── app/globals.css
```

**`book/_queue.json`의 스키마**는 `{ "chapter-01-intro": "done", "chapter-02-setup": "writing", ... }` 형태로 각 에이전트가 자신의 작업 시작/완료 시점에 상태를 기록한다. 오케스트레이터는 이 파일을 폴링하여 다음 단계 dispatch 타이밍을 결정한다. `isolation: worktree` frontmatter 플래그를 사용하면 각 에이전트가 임시 git worktree에서 작업해 동시 쓰기 충돌을 원천 차단할 수 있다.

**CLAUDE.md는 모든 서브에이전트에 자동 주입**된다. 여기에는 용어 통일("서브에이전트" not "sub-agent"), 코드 예제 언어 태그 규칙, 한국어 문체 가이드(경어체 통일, 외래어 표기), 금융 면책 문구 삽입 의무 같은 immutable rule을 20–80줄로 압축해 넣는다. 상세 스타일 가이드는 `@book/style-guide.md` 참조 링크로 분리한다.

---

## 마스터 프롬프트의 6대 구성 요소

실제 Plan Mode에 복붙하는 프롬프트는 다음 6개 섹션을 반드시 포함해야 팀이 한 번에 올바르게 생성된다. 이는 wshobson/agents·VoltAgent·Harness(meta-skill)의 공통 패턴을 추출한 것이다.

**① 메타 롤 선언**. `"당신은 시니어 멀티에이전트 아키텍트이며, 이 프로젝트의 1회성 '팀 창설자' 역할을 수행합니다. 14개의 .md 파일을 .claude/agents/ 디렉토리에 생성하고, 각 파일은 아래 정의된 공통 구조를 엄격히 따릅니다."` Claude가 "에이전트를 만드는 에이전트" 모드로 전환하는 핵심 구문이다.

**② 프로젝트 컨텍스트 주입**. 사용자의 기술스택(Python 3.13, yfinance+curl_cffi, LightGBM/XGBoost/CatBoost, FRED, Finnhub, Next.js App Router + Tailwind v4), 강의 대상(초보자), 결과물 형태(반응형 HTML on Next.js), 수집 자료 경로(`sources/`)를 6–10줄로 압축한다. 이 정보는 각 에이전트의 시스템 프롬프트에 자동 반영되어야 한다.

**③ 14개 에이전트 명세표**. 위 테이블(이름·페르소나·모델·툴·입출력)을 그대로 프롬프트에 포함한다. Claude는 이 표를 읽고 각 행을 하나의 `.md` 파일로 확장한다. **반드시 frontmatter 필수 필드 목록을 명시**: `name`, `description`(자동위임 트리거 포함), `tools`(최소권한), `model`, `color`.

**④ 공통 시스템 프롬프트 템플릿**. 모든 14개 에이전트 본문이 공유하는 섹션 구조를 강제한다: `## Role` (1문장) → `## When Invoked` (1-2-3 체크리스트) → `## Workflow` (단계별) → `## Input Contract` (어떤 파일을 읽는지) → `## Output Contract` (어떤 파일을 쓰는지, JSON/MD 스키마) → `## Communication Protocol` (_queue.json 갱신 규칙) → `## Definition of Done`. VoltAgent의 100+ 에이전트가 이 구조로 통일되어 있어 유지보수성이 극대화된다.

**⑤ 오케스트레이터 특별 지시**. orchestrator.md는 `tools: Agent, Read, Write, TodoWrite, Glob`을 가지며, 본문에 위의 **6단계 파이프라인 상세 표**를 포함한다. 각 단계에서 어떤 에이전트를 호출하는지, 단일 턴에 몇 개를 병렬로 dispatch하는지, 어떤 파일이 생성되어야 다음 단계로 진행하는지를 명시한다. 또 `"두 에이전트가 동일 파일을 편집하지 않도록 보장"`, `"Haiku 우선 사용으로 비용 절감"`, `"각 dispatch에 Scope/Context/Success Criteria/Output Format 4요소 포함"` 같은 anti-pattern 방지 규칙을 넣는다.

**⑥ 부속 파일 생성 지시와 완료 조건**. 14개 에이전트 외에 `CLAUDE.md`(프로젝트 루트), `book/outline.md` 초안 스켈레톤, `book/_queue.json` 빈 파일, `.claude/commands/start-book.md` 슬래시 커맨드를 함께 생성하도록 명시한다. 완료 조건으로 `"14개 .md 파일이 .claude/agents/에 존재, CLAUDE.md 프로젝트 루트 생성, _queue.json 초기화, 사용자에게 '@orchestrator 교재 제작 시작' 안내 메시지 출력"`을 명시해 Claude가 중단 시점을 명확히 알게 한다.

추가로 Plan Mode 특유의 **이탈 방지 구문** `"remain in plan mode — do not write any files during this planning phase"`을 프롬프트 끝에 넣으면 GitHub Issue #21292에서 보고된 Claude가 Plan Mode를 무시하고 파일을 쓰는 버그를 예방한다.

---

## 즉시 쓸 수 있는 마스터 프롬프트 골격

아래는 위 6개 요소를 300줄 내로 압축한 실전 템플릿이다. 그대로 Plan Mode에 붙여넣으면 계획이 산출되고, Auto-Accept 전환 후 "execute the plan"이라고 하면 파일 14개 + CLAUDE.md + queue.json이 생성된다.

```markdown
# 미션: Claude Code 주식분석 강의 교재 제작 팀 (14 에이전트) 설계

당신은 시니어 멀티에이전트 아키텍트입니다. 지금부터 
.claude/agents/ 에 14개의 전문가 서브에이전트 파일과 
프로젝트 CLAUDE.md, book/outline.md 스켈레톤, 
book/_queue.json 빈 큐, .claude/commands/start-book.md 
슬래시 커맨드를 설계합니다. 

⚠️ Plan Mode 규칙: 이 단계에서는 파일을 쓰지 말고, 모든 
파일의 전체 내용(frontmatter + 시스템 프롬프트)을 Plan 
문서에 담아 반환하세요. Auto-Accept로 전환 후 "execute 
the plan"을 받으면 그때 Write 하십시오.

## 프로젝트 컨텍스트
- 강의: "Claude Code를 이용한 주식 분석" (초보자 대상)
- 기술스택: Python 3.13 / yfinance+curl_cffi / LightGBM·
  XGBoost·CatBoost / FRED·Finnhub / Next.js 15 App Router 
  + Tailwind v4 + MDX + Shiki
- 원본자료: sources/{ppt,pdf,text}/ 에 수집됨
- 결과물: web/ 디렉토리 반응형 HTML (Next.js 프로젝트)
- 언어: 한국어 본문, 코드 주석 한국어 병기
- 필수 면책: 매 챕터 말미 "교육 목적, 투자 조언 아님" 삽입

## 공통 파일 스펙 (14개 모두 준수)
frontmatter 필수: name, description, tools, model, color
description은 반드시 "Use proactively when..." 또는 
"MUST BE USED for..." 자동위임 트리거 포함.
tools는 최소권한 (리뷰어는 Write 제외, 분석가는 Bash만 필요 시).

본문 섹션 순서 (강제):
## Role           -- 15년+ 경력 서사 1-2문장
## When Invoked   -- 1/2/3 체크리스트
## Workflow       -- 단계별 절차
## Input Contract -- 읽어야 할 파일 경로·스키마
## Output Contract -- 쓸 파일 경로·스키마 (JSON/Markdown)
## Communication Protocol -- book/_queue.json 갱신 규칙
## Definition of Done -- 완료 판정 기준

## 14 에이전트 정의
[위 테이블의 14행을 그대로 복붙 — 이름/페르소나/모델/툴/입출력/병렬가능여부]

## orchestrator 특수 지시
tools: Agent, Read, Write, TodoWrite, Glob
모델: opus
본문에 아래 6단계 dispatch 로직 포함:

단계1: curriculum-architect (단독) → book/outline.md 생성까지 대기
단계2: [source-analyst-ppt, source-analyst-pdf, 
        source-analyst-text] 단일 턴 3-way 병렬 Agent 호출
단계3: [market-trend-researcher, claude-code-specialist] 
        2-way 병렬
단계4: outline.md의 각 챕터에 대해
        [content-writer-ko + code-example-crafter] 쌍을 
        최대 6개까지 병렬 dispatch. 
        동시에 [chart-viz-specialist, tailwind-ux-designer] 
        병렬. 
        모든 챕터 완료 후 nextjs-mdx-developer 단독 통합.
단계5: [quality-reviewer, a11y-seo-auditor, 
        claude-code-specialist(재호출)] 3-way 병렬 검수
단계6: review/issues.md 파싱 → Critical/Warning만 해당 
        전문가에 재위임. TodoWrite로 추적. 최대 3회 루프.

각 dispatch에 반드시 Scope/Context/Success/Output-Format 
4요소 전달. 서브에이전트 간 파일 충돌 금지.

## CLAUDE.md 내용 (20-80줄)
- 용어 통일: "서브에이전트"(공식 번역)
- 코드 블록 언어 태그 필수 (```python, ```bash 등)
- 한국어 문체: 경어체 통일, 외래어 최초 등장 시 원어 병기
- 금융 원칙: look-ahead bias 금지, survivorship bias 경고, 
  LLM 환각 방지 위해 MCP 소스 인용 의무
- 모든 코드 예제는 curl_cffi impersonate=chrome 세션 사용
- @book/style-guide.md, @book/outline.md 참조

## book/_queue.json 초기화
{ "chapters": {}, "stages": { "1": "pending", "2": "pending", 
  "3": "pending", "4": "pending", "5": "pending", "6": "pending" }}

## 완료 조건
- .claude/agents/ 14개 .md 파일
- CLAUDE.md 프로젝트 루트  
- book/outline.md, book/_queue.json, book/style-guide.md
- .claude/commands/start-book.md ("@orchestrator 로 시작" 안내)
- 사용자 안내 메시지: "Auto-Accept 모드에서 
  @orchestrator 교재 제작을 시작해주세요"

⚠️ remain in plan mode — do not write any files during 
this planning phase.
```

---

## 검증된 레퍼런스와 구현 세부 결정

**차트 스택 결정**: 초보자 강의임을 감안해 `TradingView Widget`을 **즉시 실제 주가를 보여주는 데모**로, `Recharts`를 **개념 설명용 SVG 차트**로, `TradingView Lightweight Charts`(45KB gzip, Apache 2.0)를 **인터랙티브 캔들 실습**으로 3단 계층을 둔다. `chart-viz-specialist`는 이 3종을 `components/mdx/`에 래핑해 제공한다. TradingView attribution은 푸터에 의무 표시한다.

**문서 프레임워크 결정**: `Fumadocs 14+` + `@next/mdx` 조합을 1순위로 한다. Vercel 팀이 공식 추천하며 App Router 네이티브이고, 사용자가 이미 Next.js를 쓰므로 러닝커브가 낮다. `nextjs-mdx-developer` 에이전트의 프롬프트에 이 선택이 하드코딩된다. 코드 하이라이팅은 `Shiki` 빌드타임 변환으로 **클라이언트 JS 0KB**를 달성한다.

**금융 MCP 권장 세트**: 교재 실습에 `@mokemokechicken/yfinance-mcp-server`(RSI/MACD 내장), `alphavantage`(progressive tool discovery), `fred-mcp-server`(80만 시계열), 한국 주식 시 `migusdn/KIS_MCP_Server`(모의투자)를 기본 등록하도록 `claude-code-specialist`가 가이드한다. `Mrbaeksang/korea-stock-analyzer-mcp`의 6대 거장 전략은 고급 챕터 보너스로 배치한다.

**초보자 함정 챕터 의무 배치**: `curriculum-architect`의 outline 생성 규칙에 **look-ahead bias, survivorship bias, overfitting, regime dependency, LLM 환각** 5대 함정을 전체 챕터의 2번째에 배치하도록 강제한다. 이는 Anthropic 공식 가이드의 "Claude는 자율 매매 도구가 아니며 human-in-the-loop 필수" 원칙과 일치하며, 국내외 경쟁 교재 대부분이 뒷부분에 배치해 초보자가 놓치는 문제를 선제 해결한다.

**Snyk ToxicSkills 경고 대응**: 2026년 Snyk 연구가 공개된 Claude Skill 36%에서 프롬프트 인젝션을 발견했으므로, `quality-reviewer` 에이전트의 체크리스트에 **"교재가 추천하는 모든 제3자 Skill은 SKILL.md 수동 검토 안내 포함"** 항목을 추가한다.

---

## 실행 체크리스트와 기대 효과

사용자가 이 설계를 실제 적용할 때의 순서는 다음과 같다. **① `cd`로 프로젝트 디렉토리 진입 → ② `claude` 실행 → ③ Shift+Tab 2회로 Plan Mode → ④ 위 마스터 프롬프트 복붙 → ⑤ Plan 검토(Ctrl+G) → ⑥ 승인 후 Shift+Tab으로 Auto-Accept → ⑦ "execute the plan" 입력 → ⑧ 14개 파일 생성 확인 → ⑨ `@orchestrator 교재 제작 시작` 입력 → ⑩ 6단계 파이프라인 자동 실행.**

**기대 산출**: 단일 Claude Code 세션 대비 약 4배 토큰을 사용하면서도, 벽시계 시간은 챕터 수에 거의 선형이 아닌 log 스케일로 단축된다(단계 4의 챕터별 병렬화 덕분). 12챕터 교재 기준 경험값으로 **단일 에이전트 20시간 → 멀티에이전트 4–6시간** 수준의 월클럭 단축이 가능하다(channel.tel 실측치 일반화).

**한계와 회피책**: 서브에이전트는 다른 서브에이전트를 생성할 수 없으므로 14명 이상의 확장은 오케스트레이터를 통한 중계로만 가능하다. 동시 실행 상한선은 실무상 6–8개이므로 단계 4의 병렬도를 이 범위로 제한해야 한다. Windows에서는 Shift+Tab이 v2.1.3부터 Plan Mode를 건너뛰는 이슈가 있어 `/plan` 슬래시 커맨드 또는 `Alt+M`으로 대체한다.

---

## 결론: 이 설계의 본질적 기여

이 설계의 진짜 가치는 "14명의 에이전트 목록"이 아니라, **Plan Mode의 read-only 제약을 인정하는 2단계 플로우 + 파일 시스템 큐 기반 비동기 협업 + 단일 턴 병렬 Agent 호출 + 최소권한·자동위임 frontmatter**라는 네 개의 축을 하나의 마스터 프롬프트로 묶어내는 **메타-패턴**이다. 이 패턴은 주식 교재뿐 아니라 법률·의학·과학 교재, 사내 문서화, 오픈소스 리뉴얼 등 장문 콘텐츠 생산 전반에 그대로 이식할 수 있다.

특히 한국어 기술교재 제작 맥락에서는 `content-writer-ko`(국내 저자 페르소나) + `quality-reviewer`(이중경력: 테크니컬 에디터 + 증권사 리서처)의 조합이 기존 영문 서브에이전트 템플릿이 제공하지 못하는 **한국어 문체 일관성과 국내 금융 규제 감수성**을 동시에 제공한다. KIS Trade MCP·pykrx·DART OpenAPI 같은 한국 특화 도구를 `claude-code-specialist`가 미국 주식 도구와 병기하도록 설계한 점도 시장 차별화 포인트다.

마지막으로 주의할 것은 **멀티에이전트는 모든 작업에 유리한 것이 아니다**는 점이다. 짧은 블로그 포스트나 단일 랜딩 페이지는 단일 세션이 3–7배 저렴하고 충분히 빠르다. 이 설계는 12챕터 이상·수백 페이지·다양한 자료 포맷·반응형 HTML 렌더링이라는 **복합 조건이 모두 충족될 때** 비로소 ROI가 양전환한다. 마스터 프롬프트를 쓰기 전, 본인의 교재가 이 규모에 도달하는지 한 번 더 점검하기를 권한다.