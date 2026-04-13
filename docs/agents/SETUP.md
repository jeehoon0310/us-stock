# US Stock 에이전트 팀 — 설치 가이드

## 1단계: 파일 복사

```bash
# 에이전트 팀 파일을 us-stock 프로젝트에 복사
cp -r .claude/ /Users/frindle/workspace/education/us-stock/.claude/
cp -r .docs/ /Users/frindle/workspace/education/us-stock/.docs/
cp CLAUDE.md /Users/frindle/workspace/education/us-stock/CLAUDE.md
```

## 2단계: 기존 CLAUDE.md 병합 (필요 시)

프로젝트에 이미 CLAUDE.md가 있다면 내용을 병합한다.

## 3단계: 에이전트 팀 확인

```bash
cd /Users/frindle/workspace/education/us-stock
ls .claude/agents/
# 출력: architect.md  ai-strategist.md  dashboard-dev.md  data-engineer.md  lead.md  qa.md  quant-analyst.md
```

## 4단계: Claude Code 실행

```bash
cd /Users/frindle/workspace/education/us-stock
claude
```

## 5단계: 일일 진화 사이클 시작

Claude Code에서 다음 프롬프트를 입력:

```
@lead 일일 진화 사이클을 실행해줘.
```

또는 특정 영역에 집중:

```
@lead 퀀트 분석 집중 사이클을 실행해줘.
```

## 사용 가능한 프롬프트

`.docs/daily-evolution-prompts.md` 파일에 8가지 프롬프트가 정의되어 있다:

| # | 프롬프트 | 용도 |
|---|---------|------|
| 1 | 일일 진화 | 기본 점검 + 개선 (매일) |
| 2 | 퀀트 집중 | 분석 로직 개선 |
| 3 | AI 품질 | 프롬프트 튜닝 |
| 4 | 데이터 강화 | 수집 안정성 |
| 5 | 대시보드 진화 | UX 개선 |
| 6 | 아키텍처 리뷰 | 구조 점검 |
| 7 | 신규 기능 | 피처 개발 |
| 8 | 긴급 대응 | Hotfix |

## 디렉토리 구조 (설치 후)

```
us-stock/
├── .claude/
│   ├── agents/
│   │   ├── lead.md            # 프로젝트 리드
│   │   ├── quant-analyst.md   # 퀀트 분석가
│   │   ├── data-engineer.md   # 데이터 엔지니어
│   │   ├── ai-strategist.md   # AI 전략가
│   │   ├── dashboard-dev.md   # 대시보드 개발자
│   │   ├── qa.md              # QA 엔지니어
│   │   └── architect.md       # 시스템 아키텍트
│   └── settings.local.json    # 권한 설정
├── .docs/
│   ├── daily/                 # 일일 점검/진화 기록
│   ├── quant/                 # 퀀트 분석 노트
│   ├── ai/                    # AI 품질 리포트
│   ├── architecture/          # ADR, 구조 리뷰
│   ├── backlog/
│   │   └── evolution_backlog.md  # 진화 백로그
│   └── daily-evolution-prompts.md  # 실행 프롬프트 모음
├── CLAUDE.md                  # Claude Code 설정
└── (기존 프로젝트 파일들...)
```
