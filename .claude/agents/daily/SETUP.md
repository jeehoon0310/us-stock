# US Stock 에이전트 팀 — 설치 가이드

> **현재 상태 (2026-04-16 기준):** `.claude/agents/`에 22개 2세대 에이전트가 설치된 상태다. 이 가이드는 참고용이며 신규 설치 시 사용한다.

## 에이전트 세대 구분

| 세대 | 위치 | 에이전트 수 | 상태 |
|------|------|------------|------|
| 1세대 | `docs/agents/_archive/` | 7개 | 보관(archived) — `education/us-stock` 경로 참조, 현재 프로젝트와 비호환 |
| 2세대 | `.claude/agents/` | 22개 | 운영 중 — ML 파이프라인 + GBM 팀 포함 |

## 2세대 에이전트 목록

`.claude/agents/`에 설치된 22개 에이전트:

| 팀 | 에이전트 | 역할 |
|----|---------|------|
| **Performance** | `perf-lead` | 21-에이전트 생태계 최상위 오케스트레이터 |
| | `perf-verifier` | A/B 검증 + 회귀 방지 |
| | `signal-optimizer` | 시그널/팩터 최적화 구현 |
| | `critic-reviewer` | Bull/Bear 양면 비판 리뷰어 |
| | `backtest-engineer` | 백테스트 엔지니어 |
| **Research** | `research-lead` | 일일 GBM 리서치 오케스트레이터 |
| | `paper-researcher` | arXiv/SSRN 논문 스캔 |
| | `market-researcher` | 웹 리서치 전담 |
| | `factor-discoverer` | 신규 팩터 발굴 |
| **Model** | `model-lead` | LightGBM/XGBoost/CatBoost 모델 선정 |
| | `gbm-trainer` | GBM 학습 전담 |
| | `gbm-code-reviewer` | ML 파이프라인 코드 품질 리뷰 |
| | `walk-forward-validator` | 시계열 walk-forward 검증 |
| **Equity** | `equity-lead` | 종목 팩터 오케스트레이터 |
| | `equity-factor-builder` | Technical/Fundamental/Analyst 팩터 생성 |
| | `equity-flow-analyst` | 기관 자금흐름 팩터 |
| **Macro** | `macro-lead` | 거시 피처 엔지니어링 총괄 |
| | `macro-feature-engineer` | FRED/VIX 피처 변환 |
| | `regime-ml-classifier` | GBM 4-class 체제 분류기 |
| **MLOps** | `mlops-lead` | GBM 파이프라인 아키텍처 결정 |
| | `ml-pipeline-architect` | train/predict 파이프라인 구현 |
| | `service-evolver` | 서비스 일일 진화 메타 에이전트 |

## 실행 방법

```bash
cd /Users/frindle/workspace/synology/us-stock
claude
```

Claude Code에서 특정 에이전트 호출:

```
@perf-lead 오늘 성능 개선 사이클 실행해줘.
@research-lead 신규 팩터 리서치해줘.
@service-evolver 오늘 개선 항목 파악해줘.
```

## 사용 가능한 프롬프트

`docs/agents/daily-evolution-prompts.md` 및 `docs/agents/daily-performance-prompts.md` 참고.

## 디렉토리 구조

```
us-stock/
├── .claude/
│   ├── agents/                    # 2세대 에이전트 22개 (팀별 서브폴더)
│   │   ├── performance/           # 성능 개선팀 (5개)
│   │   │   ├── perf-lead.md
│   │   │   ├── perf-verifier.md
│   │   │   ├── signal-optimizer.md
│   │   │   ├── critic-reviewer.md
│   │   │   └── backtest-engineer.md
│   │   ├── research/              # 리서치팀 (4개)
│   │   │   ├── research-lead.md
│   │   │   ├── paper-researcher.md
│   │   │   ├── market-researcher.md
│   │   │   └── factor-discoverer.md
│   │   ├── model/                 # 모델팀 (4개)
│   │   │   ├── model-lead.md
│   │   │   ├── gbm-trainer.md
│   │   │   ├── gbm-code-reviewer.md
│   │   │   └── walk-forward-validator.md
│   │   ├── equity/                # 이쿼티팀 (3개)
│   │   │   ├── equity-lead.md
│   │   │   ├── equity-factor-builder.md
│   │   │   └── equity-flow-analyst.md
│   │   ├── macro/                 # 매크로팀 (3개)
│   │   │   ├── macro-lead.md
│   │   │   ├── macro-feature-engineer.md
│   │   │   └── regime-ml-classifier.md
│   │   └── mlops/                 # MLOps팀 (3개)
│   │       ├── mlops-lead.md
│   │       ├── ml-pipeline-architect.md
│   │       └── service-evolver.md
│   └── settings.local.json
├── docs/agents/
│   ├── _archive/          # 1세대 에이전트 7개 (보관)
│   ├── daily-evolution-prompts.md
│   ├── daily-performance-prompts.md
│   ├── PERFORMANCE-GUIDE.md
│   └── SETUP.md           # 이 파일
├── CLAUDE.md
└── (프로젝트 파일들...)
```

> **주의:** Claude Code 공식 문서에 `.claude/agents/` 하위 폴더 지원 여부가 명시되어 있지 않다. 이 구조가 작동하지 않으면 `/agents` 명령에서 에이전트가 보이지 않는다. 그 경우 팀별 폴더에서 flat 구조로 되돌리면 된다:
> ```bash
> cd .claude/agents && find . -name "*.md" -mindepth 2 -exec mv {} . \; && find . -mindepth 1 -type d -empty -delete
> ```
