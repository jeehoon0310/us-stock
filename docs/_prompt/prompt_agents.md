이건 내가 방금 만든 파일들의 적용 방법이니 바로 상세하게 안내할게요.

---

## Step 1: 파일 다운로드

방금 만든 `us-stock-agents` 폴더를 다운로드하세요. 12개 파일이 포함되어 있습니다.

---

## Step 2: 프로젝트에 복사

터미널에서 다음을 실행합니다.

```bash
cd /Users/frindle/workspace/education/us-stock

# 기존 CLAUDE.md 백업 (이미 있다면)
cp CLAUDE.md CLAUDE.md.bak 2>/dev/null

# 다운로드한 파일 복사
# (다운로드 경로는 실제 위치에 맞게 수정)
cp -r ~/Downloads/us-stock-agents/.claude/ ./.claude/
cp -r ~/Downloads/us-stock-agents/.docs/ ./.docs/
cp ~/Downloads/us-stock-agents/CLAUDE.md ./CLAUDE.md
```

---

## Step 3: 기존 CLAUDE.md 병합

프로젝트에 이미 `CLAUDE.md`가 있었다면, 기존 내용과 새 내용을 병합해야 합니다.

```bash
# 기존 파일 확인
cat CLAUDE.md.bak

# 에디터로 병합 (기존 내용을 새 CLAUDE.md 하단에 추가)
# 또는 Claude Code에서:
# "CLAUDE.md.bak의 내용을 현재 CLAUDE.md에 병합해줘"
```

---

## Step 4: 설치 확인

```bash
# 디렉토리 구조 확인
tree -a .claude/ .docs/ --dirsfirst

# 예상 출력:
# .claude/
# ├── agents/
# │   ├── ai-strategist.md
# │   ├── architect.md
# │   ├── dashboard-dev.md
# │   ├── data-engineer.md
# │   ├── lead.md
# │   ├── qa.md
# │   └── quant-analyst.md
# └── settings.local.json
# .docs/
# ├── ai/
# ├── architecture/
# ├── backlog/
# │   └── evolution_backlog.md
# ├── daily/
# ├── quant/
# └── daily-evolution-prompts.md
```

`tree`가 없으면:

```bash
ls -la .claude/agents/
ls -la .docs/
```

---

## Step 5: settings.local.json 커스터마이징

현재 `settings.local.json`에는 기본 권한만 설정되어 있습니다. 프로젝트 실제 환경에 맞게 조정하세요.

```bash
cat .claude/settings.local.json
```

MCP 서버를 추가하고 싶다면 (예: Figma, Playwright 등):

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright"]
    }
  }
}
```

> context7 MCP는 quant-analyst와 architect가 라이브러리 문서를 참조할 때 사용합니다. 없어도 기본 동작에는 문제 없습니다.

---

## Step 6: Claude Code 실행 + 에이전트 확인

```bash
cd /Users/frindle/workspace/education/us-stock
claude
```

Claude Code가 열리면, 에이전트가 인식되는지 확인합니다:

```
/agents
```

7개 에이전트가 목록에 표시되어야 합니다:

```
lead, quant-analyst, data-engineer, ai-strategist, dashboard-dev, qa, architect
```

---

## Step 7: 첫 실행 — 일일 진화 사이클

### 방법 A: lead에게 전체 위임 (추천)

```
@lead 일일 진화 사이클을 실행해줘.

Phase 1 — 건강 점검:
@qa 에게 파이프라인 실행 및 건강 점검을 위임해.

Phase 2 — 이슈 분석:
Phase 1 리포트에서 이슈를 추출하고 분류해.

Phase 3 — 개선 실행:
이슈 유형에 따라 적절한 에이전트에 위임해. 하루 최대 3개 개선에 집중.

Phase 4 — 검증 + 기록:
@qa 에게 변경사항 검증 위임하고 .docs/daily/에 기록 남겨.
```

### 방법 B: 개별 에이전트 직접 호출

특정 영역만 작업하고 싶을 때:

```
@quant-analyst 어제 시장 체제 판정 결과를 분석하고, 
5개 센서 신호가 실제 시장과 일치하는지 검증해줘.
```

```
@data-engineer 파이프라인을 실행하고 데이터 품질 리포트를 작성해줘.
```

```
@qa run_full_pipeline.py를 실행하고 Level 1~3 검증을 수행해줘.
```

---

## Step 8: Plan 모드에서 사용하기

Claude Code에서 Plan 모드로 진입한 뒤:

```
# Plan 모드 진입
/plan

# 또는 shift+tab으로 Plan 모드 토글
```

Plan 모드에서 lead에게 작업을 요청하면, lead가 작업을 Phase로 분해하고 계획을 먼저 보여줍니다. 승인 후 실행됩니다.

```
@lead 새 기능을 개발해줘: 
포트폴리오 백테스트 모듈을 추가해서, 
Top 10 종목을 동일비중으로 매수했을 때의 수익률을 시뮬레이션하는 기능
```

lead가 다음과 같은 계획을 제안할 겁니다:

```
Phase 1: 요건 분석 (lead + architect)
Phase 2: 백테스트 엔진 구현 (quant-analyst)
Phase 3: 파이프라인 통합 (data-engineer)
Phase 4: 대시보드 시각화 (dashboard-dev)
Phase 5: 테스트 (qa)
```

---

## 주간 루틴 제안

`.docs/daily-evolution-prompts.md`에 8가지 프롬프트가 있습니다. 추천 주간 루틴:

| 요일 | 프롬프트 | 중점 |
|------|---------|------|
| **월** | `@lead 일일 진화 사이클` | 주간 시작, 전체 점검 |
| **화** | `@lead 퀀트 분석 집중` | 센서/팩터 정확도 개선 |
| **수** | `@lead AI 분석 품질 개선` | 프롬프트 튜닝, 할루시네이션 체크 |
| **목** | `@lead 데이터 파이프라인 강화` | 수집 안정성, 새 소스 |
| **금** | `@lead 아키텍처 리뷰` | 기술부채 정리, ADR |
| **토** | `@lead 대시보드 진화` | 새 차트/섹션 추가 |
| **일** | `@lead 신규 기능 개발: [...]` | 새 피처 |

---

## 주의사항

**에이전트 동시 실행 수 제한**: 에이전트를 너무 많이 동시에 띄우면 컨텍스트 오버헤드가 커집니다. lead가 자동 판단하지만, 동시 3개 이하를 권장합니다.

**`.docs/` 디렉토리 축적**: 매일 진화 로그가 `.docs/daily/`에 쌓입니다. 주기적으로 정리하거나, 월별 서브폴더로 아카이브하세요.

**settings.local.json 권한**: 현재 `Bash(rm -rf *)`, `Bash(sudo *)` 등은 deny 목록에 있습니다. 프로젝트에 맞게 allow/deny를 조정하세요.

**`.gitignore` 확인**: `.docs/daily/`의 일일 리포트를 git에 포함할지 결정하세요. 포함하면 진화 히스토리가 남고, 제외하면 저장소가 깔끔합니다.