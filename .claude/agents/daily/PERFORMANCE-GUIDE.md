# US Stock 성능 개선 팀 — 실행 가이드

6-에이전트 성능 개선 팀을 실제로 운영하는 방법.

**전제**: 에이전트 파일은 `.claude/agents/` 에 이미 설치됨. 실행 프롬프트는 `docs/us-stocks-agent/daily-performance-prompts.md` 참조.

---

## 1. 사전 준비 체크리스트

### 1.1 필수 환경 확인

```bash
cd /Users/frindle/workspace/education/us-stock

# Python 가상환경
source .venv/bin/activate
python --version  # 3.13.x 필수

# 6개 에이전트 파일 존재
ls .claude/agents/
# 출력: backtest-engineer.md critic-reviewer.md market-researcher.md
#       perf-lead.md perf-verifier.md signal-optimizer.md

# 지원 디렉토리
ls -la .docs/
# 출력: performance/ research/

# 시드 파일
cat output/backtest_metrics.json | head -3
```

### 1.2 API 키 확인

`.env` 파일에 필수:

```bash
grep -E "^(PERPLEXITY_API_KEY|FRED_API_KEY|GOOGLE_API_KEY)" .env
```

없으면 `.env.example` 복사 후 키 입력.

### 1.3 데이터 준비

```bash
# 최근 가격 데이터 확인
ls -la data/us_daily_prices.csv
# 수정 시각이 1영업일 이내여야 함

# 스크리닝 히스토리 (최소 30일 권장)
ls result/smart_money_picks_*.csv | wc -l
# 30 이하면 기준선 측정 신뢰성 부족
```

**샘플 부족 시**: 먼저 파이프라인을 30일간 돌려 `result/` 쌓기. 첫 주는 기준선 관측만 가능.

### 1.4 Claude Code 에이전트 인식

```bash
claude  # 프로젝트 루트에서 실행
```

Claude Code 열리면:

```
/agents
```

6개가 표시되어야 함:
```
backtest-engineer, critic-reviewer, market-researcher,
perf-lead, perf-verifier, signal-optimizer
```

**안 보이면**: `.claude/agents/` 경로와 YAML frontmatter `name:` 필드 확인.

---

## 2. 최초 실행 (Dry Run)

첫 실행은 반드시 **드라이런** 으로 기준선만 측정.

### 2.1 실행 명령

Claude Code에서:

```
@perf-lead 드라이런 모드로 Phase 1~2만 실행해줘.

Phase 1 (MEASURE):
  @backtest-engineer 가 다음을 수행:
  1. analyzers/backtest_engine.py 를 최소 구현으로 생성
  2. result/smart_money_picks_*.csv 를 날짜별로 로드
  3. forward return 계산 (1D/5D/20D)
  4. Sharpe/Alpha/MDD/Win-rate 산출
  5. output/backtest_metrics.json 업데이트

Phase 2 (RESEARCH):
  @market-researcher 가 Perplexity로 3개 후보 수집

Phase 3~7 스킵. 기록만 남기고 종료.
```

### 2.2 소요 시간 & 비용

- Phase 1: 2~5분 (backtest_engine.py 작성 + 계산)
- Phase 2: 30초~2분 (Perplexity 3 쿼리)
- **총**: 3~7분
- **비용**: Perplexity ~$0.02, Gemini $0 (미호출)

### 2.3 검증 포인트

```bash
# 백테스트 엔진 생성됨
ls analyzers/backtest_engine.py

# 기준선 지표 기록됨
cat output/backtest_metrics.json | grep -E "sharpe|alpha|win_rate"

# 리포트 작성됨
ls .docs/performance/*.md
ls .docs/research/*.md
```

### 2.4 실패 시

**백테스트 엔진 생성 실패**:
- `result/` 디렉토리 비어있음 → 파이프라인 먼저 돌리기
- `data/us_daily_prices.csv` 없음 → `python run_full_pipeline.py` 실행

**Perplexity 호출 실패**:
- API 키 확인 (`.env`)
- 429 rate limit → 1시간 후 재시도
- 크레딧 소진 → 대시보드 확인

---

## 3. 일일 루틴 (정상 운영)

기준선이 측정된 후 매일 실행.

### 3.1 기본 명령 (월~금 아침)

```
@perf-lead 일일 성능 개선 사이클을 실행해줘.

KPI: Sharpe, Alpha vs SPY, Win Rate, MDD
제약: 하루 변경 1~2개, 오버피팅 경계
```

### 3.2 실행 흐름 (30~40분)

```
[00:00] perf-lead 사이클 시작
[00:01] Phase 1+2 병렬:
        ├─ backtest-engineer (5분) → baseline 업데이트
        └─ market-researcher (3분) → 후보 3개
[00:05] Phase 3: perf-lead 진단 (2분)
        → impact/effort 매트릭스, 1~2개 선정
[00:07] Phase 4: signal-optimizer (10분)
        → 코드 변경 + git diff
[00:17] Phase 5: critic-reviewer (5분)
        → Bull/Bear 디베이트
        → 승인/수정/기각
[00:22] Phase 6: perf-verifier (10~15분)
        → 회귀 테스트 + A/B 백테스트
        → PASS/FAIL
[00:37] Phase 7: perf-lead 반성 (2분)
        → memory.md 업데이트
[00:40] 사이클 종료
```

### 3.3 산출물 확인

매 사이클 종료 후 6개 파일 생성:

```bash
DATE=$(date +%Y-%m-%d)
ls .docs/performance/${DATE}_*
# ${DATE}_backtest.md
# ${DATE}_changes.md
# ${DATE}_cycle_log.md
# ${DATE}_review.md
# ${DATE}_verify.md
ls .docs/research/${DATE}_insights.md
```

**메모리 append 확인**:

```bash
tail -20 .docs/performance/memory.md
```

### 3.4 FAIL 시 대응

perf-verifier가 FAIL 판정하면:

```bash
# 자동 롤백 권고 확인
cat .docs/performance/${DATE}_verify.md | grep -A 5 "롤백"

# 수동 롤백 실행
cd /Users/frindle/workspace/education/us-stock
git checkout -- analyzers/
git status  # clean 확인

# 회귀 테스트 재확인
python tests/test_indicators.py
```

실패 원인이 memory.md에 자동 기록되어 다음 사이클에서 회피됨.

---

## 4. 실전 예제 세션

### 4.1 Case A: 첫 주 기준선 측정

**월요일** (최초 실행):

```
@perf-lead 드라이런 모드로 Phase 1~2만 실행해줘.
```

결과: Sharpe 1.12, Alpha 2.3%, Win-rate 54% (예시)

**화~금** (매일 반복):

```
@perf-lead 일일 성능 개선 사이클을 실행해줘.
목표: 첫 주는 기준선 관측 위주, 큰 변경 금지
```

**일요일**:

```
@perf-lead 주간 성과 리뷰를 실행해줘. 집계 기간: 지난 7일
```

### 4.2 Case B: 특정 센서 집중 개선

VIX 센서가 최근 체제 전환을 놓치고 있다고 판단:

```
@perf-lead VIX 센서 집중 개선 사이클을 실행해줘.

대상: market_regime.py 의 VIX 센서 (현재 가중치 30%, 경계값 16/22/30)

워크플로우:
1. @backtest-engineer VIX 센서 단독 기여도 측정 (marginal contribution)
2. @market-researcher "post-COVID VIX regime shift" 논문 5개 심화 리서치
3. @signal-optimizer 3~5개 변경안 제시, 1개만 선정
4. @critic-reviewer 선정안 Bull/Bear 리뷰
5. @perf-verifier 검증 + 롤백 준비

특별 체크: crisis 체제 샘플에서 false positive 여부
```

### 4.3 Case C: 리서치만 실행 (야근 없는 날)

시간 없을 때 리서치만 축적:

```
@market-researcher 오늘 타겟 리서치를 수행해줘.

타겟 영역: 모멘텀 팩터
출력: Perplexity Sonar Pro 3개 쿼리 + 후보 3개
비용 제약: $0.05 이하
```

다음 날 전체 사이클에서 이 인사이트 활용.

### 4.4 Case D: 긴급 롤백

대시보드 확인 중 Top 10이 전부 테크 섹터 발견:

```
@perf-verifier 긴급 롤백을 수행해줘.

증상: Top 10에 동일 섹터(Technology) 8개 몰림

절차:
1. 최근 3커밋 git log 확인
2. 문제 시점 이전 커밋 식별
3. 영향받은 파일만 선별 롤백
4. 회귀 테스트 전체 실행
5. run_full_pipeline.py 재실행 확인
6. .docs/performance/hotfix.md 작성
```

---

## 5. 트러블슈팅

### 5.1 에이전트가 인식 안 됨

```bash
# frontmatter name 필드 확인
head -2 .claude/agents/perf-lead.md
# 출력: ---
#       name: perf-lead

# Claude Code 재시작
exit
claude
/agents
```

### 5.2 Perplexity 비용 초과

`market-researcher` 에 호출 제한 추가:

```
@market-researcher 오늘은 Perplexity 1쿼리만 실행해줘.
우선순위: 어제 기각된 후보 B 재검토
```

### 5.3 backtest-engineer 가 NaN 반환

샘플 부족 가능성:

```bash
# 거래일 수 확인
ls result/smart_money_picks_*.csv | wc -l
# 60 미만이면 통계 신뢰성 경고

# 가격 데이터 범위 확인
python -c "import pandas as pd; df = pd.read_csv('data/us_daily_prices.csv'); print(df['Date'].min(), df['Date'].max())"
```

**대응**: 60일 쌓일 때까지 CONDITIONAL 판정만 받고 변경 최소화.

### 5.4 critic-reviewer 가 매번 REJECT

개선 의지가 너무 강해 critic이 과도하게 보수적일 수 있음:

```
@perf-lead memory.md 에서 critic-reviewer 기각 사유 패턴을 분석해줘.
- 최근 7일 REJECT 케이스
- 공통 우려 사항
- 기각 기준이 너무 엄격한지 재평가
```

### 5.5 회귀 테스트 실패

```bash
# 변경 파일 확인
git diff --name-only

# tests/ 수정 여부 (있으면 안 됨)
git diff tests/

# 롤백
git checkout -- analyzers/

# 단계별 디버깅
python tests/test_price_fetcher.py
python tests/test_indicators.py
python -m analyzers.market_regime
```

---

## 6. 고급 사용법

### 6.1 병렬 사이클 (독립 영역)

서로 다른 센서/팩터를 동시 실험 (주의: 회귀 충돌 위험):

```
@perf-lead 독립 병렬 사이클을 실행해줘.

트랙 A: VIX 센서 개선 (market_regime.py)
트랙 B: Volume 팩터 개선 (smart_money_screener_v2.py)

제약: 두 트랙이 서로 다른 파일만 수정
A/B 백테스트 각각 수행 후 독립적으로 PASS/FAIL 판정
```

### 6.2 장기 메모리 활용

```
@perf-lead .docs/performance/memory.md 의 Do's 패턴 중
지난 30일 반복 적용 가능한 것을 찾아 오늘 사이클에 반영해줘.
```

### 6.3 리서치 우선 (구현 없이 지식 축적)

```
@market-researcher 이번 주 타겟 5일 리서치 계획:
월: 체제 감지 최신 논문
화: 모멘텀 팩터 진화
수: AI 분석 프롬프트 엔지니어링
목: 섹터 로테이션 전략
금: 오픈소스 벤치마크 (Qlib, TradingAgents 업데이트)

각 날짜별 .docs/research/ 파일 생성
구현은 하지 않음
```

---

## 7. FAQ

**Q1. 에이전트 호출 순서를 바꿀 수 있나?**
A. `perf-lead` 가 Supervisor이므로 Phase 순서는 고정. 개별 에이전트 직접 호출은 가능.

**Q2. `signal-optimizer` 없이 내가 직접 코드를 수정하면?**
A. 가능하지만 `critic-reviewer` → `perf-verifier` 거쳐야 memory.md에 기록됨. 그냥 수정하면 팀 학습 사이클이 끊김.

**Q3. 하루 사이클을 건너뛰어도 되나?**
A. 괜찮음. `perf-lead` 는 지난 사이클 결과만 참조. 단, 7일 누락 시 기준선 재측정 권장.

**Q4. Perplexity 대신 GPT/Gemini 사용 가능?**
A. `market-researcher.md` 의 "API 키" 부분 수정 가능. 단, 웹 grounded 기능은 Perplexity Sonar가 우수.

**Q5. 기존 7개 에이전트 팀과 동시 사용 가능?**
A. 가능. 성능 개선 팀은 `perf-*` 접두사로 충돌 없음. `@lead` (일반) vs `@perf-lead` (성능) 구분.

**Q6. `.docs/performance/memory.md` 를 직접 수정해도 되나?**
A. 권장하지 않음. 직접 수정 시 Reflexion 일관성 깨짐. 오류 수정만 허용.

**Q7. 백테스트 기간을 60일에서 90/120일로 늘리려면?**
A. `@perf-lead lookback 기간을 90일로 변경하고 재측정해줘` 명령 가능.

---

## 8. 주간 루틴 템플릿

`docs/us-stocks-agent/daily-performance-prompts.md` 의 프롬프트 기준:

| 요일 | 시간 | 프롬프트 | 예상 소요 |
|------|------|---------|----------|
| 월 | 09:00 | #1 일일 사이클 | 40분 |
| 화 | 09:00 | #6 센서 집중 (VIX) | 50분 |
| 수 | 09:00 | #6 팩터 집중 (Technical) | 50분 |
| 목 | 09:00 | #3 리서치만 | 10분 |
| 금 | 09:00 | #1 일일 사이클 | 40분 |
| 토 | — | #2 백테스트 재실행 | 10분 |
| 일 | — | #5 주간 리뷰 | 20분 |

**주간 총 비용 목표**: Perplexity $0.30 + Gemini $0.30 = $0.60

---

## 9. 성공 지표 (1개월)

| 지표 | 1주차 | 2주차 | 4주차 |
|------|-------|-------|-------|
| 기준선 Sharpe | 측정 | +0.05 | +0.15 |
| Alpha vs SPY | 측정 | 유지 | +0.5%p |
| Win-rate | 측정 | +1%p | +3%p |
| 사이클 완료율 | 5/7 | 6/7 | 6/7 |
| 회귀 발생 | 0건 | 0건 | 0건 |
| API 비용/주 | $0.60 | $0.60 | $0.50 (학습 효과) |

**1개월 후**: memory.md 에 최소 15개 Do's + 10개 Don'ts 축적되어 의사결정 속도 2배 향상 기대.
