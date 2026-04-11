# US Stock Daily 성능 개선 사이클 — 실행 프롬프트

6-에이전트 성능 개선 팀의 일일/개별 실행 프롬프트 모음.

**팀 구성**: `perf-lead` (supervisor) + `backtest-engineer` + `market-researcher` + `signal-optimizer` + `critic-reviewer` + `perf-verifier`

**KPI**: Sharpe, Alpha vs SPY, Win Rate, Max Drawdown
**제약**: 하루 변경 1~2개, 오버피팅 경계, Perplexity $0.05/일

---

## 프롬프트 0: 최초 드라이런 (첫 실행용)

백테스트 엔진이 없는 초기 상태용. Phase 1~2만 실행하여 기준선 측정.

```
@perf-lead 드라이런 모드로 Phase 1~2만 실행해줘.

Phase 1 (MEASURE):
  @backtest-engineer 가 다음을 수행:
  1. analyzers/backtest_engine.py 를 최소 구현으로 생성
     - BacktestEngine 클래스 (load_historical_picks, compute_forward_returns, compute_metrics)
     - result/smart_money_picks_*.csv 를 날짜별로 로드
     - data/us_daily_prices.csv 에서 forward return 계산 (1D/5D/20D)
     - SPY 대비 alpha, Sharpe, MDD, Win-rate 산출
  2. output/backtest_metrics.json 생성 (시드 포함)
  3. 기준선 지표를 .docs/performance/YYYY-MM-DD_backtest.md 에 기록

Phase 2 (RESEARCH):
  @market-researcher 가 다음을 수행:
  1. Perplexity Sonar Pro 로 3개 쿼리 실행:
     - 2026 신규 팩터 트렌드
     - 시장 체제 감지 논문
     - TradingAgents/Qlib 벤치마크
  2. 후보 3개 (팩터/시그널/파라미터) 정제
  3. .docs/research/YYYY-MM-DD_insights.md 기록

Phase 3~7 스킵. 기록만 남기고 종료.
```

---

## 프롬프트 1: 일일 전체 사이클 (정기 실행)

```
@perf-lead 일일 성능 개선 사이클을 실행해줘.

목표: Sharpe/Alpha/Win-rate 중 최소 1개 지표 개선
제약: 하루 변경 1~2개, 오버피팅 경계

워크플로우:
  Phase 1-2 (병렬): 
    @backtest-engineer 어제 Top 10 forward return 측정, 누적 지표 업데이트
    @market-researcher Perplexity로 최신 트렌드 3건 + 후보 3개

  Phase 3 (진단):
    impact/effort 매트릭스로 후보 평가, 1~2개 P0/P1 선정

  Phase 4 (구현):
    @signal-optimizer 선정된 변경 구현, 예상 효과 정량화

  Phase 5 (비판):
    @critic-reviewer Bull/Bear 양면 리뷰, 승인/수정/기각 권고

  Phase 6 (검증):
    @perf-verifier 회귀 테스트 + A/B 백테스트, PASS/FAIL 판정
    FAIL 시 git checkout 롤백

  Phase 7 (반성):
    .docs/performance/memory.md 에 학습 내용 append

산출물:
  - .docs/performance/YYYY-MM-DD_cycle_log.md (전체 로그)
  - .docs/performance/YYYY-MM-DD_backtest.md
  - .docs/research/YYYY-MM-DD_insights.md
  - .docs/performance/YYYY-MM-DD_changes.md
  - .docs/performance/YYYY-MM-DD_review.md
  - .docs/performance/YYYY-MM-DD_verify.md
  - .docs/performance/memory.md (append)
```

---

## 프롬프트 2: 백테스트만 재실행

기존 변경 없이 현재 지표 재측정.

```
@backtest-engineer 최근 60 거래일 백테스트를 재실행하고 
현재 baseline metrics 을 output/backtest_metrics.json 에 업데이트해줘.

추가로:
- 체제별 성과 분리 (risk_on/neutral/risk_off/crisis)
- 섹터별 Win-rate 분해
- 약점 Top 3 식별

.docs/performance/YYYY-MM-DD_backtest.md 에 리포트 작성.
```

---

## 프롬프트 3: 리서치만 집중

새 팩터 후보 발굴에 집중.

```
@market-researcher 오늘 타겟 리서치를 수행해줘.

타겟 영역: [체제 감지 / 모멘텀 팩터 / 센티멘트 / AI 분석 품질]
(위에서 하나 선택)

출력:
- Perplexity Sonar Pro 3개 쿼리 실행
- 3개 후보 정제 (근거 링크 + 임팩트 + 난이도)
- .docs/research/YYYY-MM-DD_insights.md 기록

비용 제약: $0.05 이하
중복 검증: .docs/performance/memory.md 확인하여 과거 기각 후보 재제안 금지
```

---

## 프롬프트 4: 핫픽스 (긴급 롤백)

변경 후 프로덕션 장애 시.

```
@perf-verifier 긴급 롤백을 수행해줘.

증상: [구체적 증상 — 예: "Top 10에 동일 섹터 8개 몰림"]

절차:
1. 최근 git log 확인 (최근 3커밋)
2. 문제 시점 이전 커밋 식별
3. 영향받은 파일만 선별 롤백
4. 회귀 테스트 (tests/*.py) 전체 실행
5. run_full_pipeline.py 재실행 확인
6. .docs/performance/YYYY-MM-DD_hotfix.md 작성
```

---

## 프롬프트 5: 주간 성과 리뷰 (일요일)

지난 7일 성과 종합.

```
@perf-lead 주간 성과 리뷰를 실행해줘.

집계 기간: 지난 7일 (월~일)

분석:
1. 지난 7일 사이클 로그 통합 (.docs/performance/*.md)
2. 시도 vs 성공 카운트 (PASS/CONDITIONAL/FAIL 비율)
3. 누적 Sharpe 변화 추이
4. market-researcher 후보 채택률
5. critic-reviewer 기각 사유 패턴
6. memory.md Do's/Don'ts 업데이트

산출물: .docs/performance/YYYY-WW_weekly.md
```

---

## 프롬프트 6: 특정 센서 집중 개선

하나의 센서/팩터만 깊게 파기.

```
@perf-lead [센서명] 집중 개선 사이클을 실행해줘.

대상: [VIX 센서 / Trend 센서 / Breadth 센서 / Credit 센서 / Yield Curve 센서]
(또는 Technical 팩터 / Fundamental 팩터 / Analyst 팩터 / RS 팩터 / Volume 팩터 / 13F 팩터)

워크플로우:
1. @backtest-engineer 해당 센서/팩터의 기여도 분리 측정
2. @market-researcher 해당 영역 논문 5개 심화 리서치
3. @signal-optimizer 3~5개 변경안 제시 (1개만 선정)
4. @critic-reviewer 선정안 Bull/Bear 리뷰
5. @perf-verifier 검증 + 롤백 준비

특별 체크: 해당 센서/팩터 단독 기여도(marginal contribution) 측정
```

---

## 프롬프트 7: 신규 센서/팩터 추가

리서치 결과 기반 신규 기능 추가.

```
@perf-lead 새 센서/팩터를 추가해줘: [구체적 설명]

예시:
- "풋/콜 비율 센서를 market_regime.py 에 추가해줘"
- "12M-1M 가격 모멘텀 팩터를 smart_money_screener_v2.py Technical 에 추가"
- "FRED 2Y-10Y 스프레드 센서 추가"

절차:
Phase 1: @market-researcher 관련 논문 재검토, 구현 상세 확정
Phase 2: @signal-optimizer 기존 팩터와 상관관계 먼저 측정
Phase 3: 상관관계 < 0.7 이면 구현, 아니면 기각
Phase 4: @critic-reviewer 필수 리뷰 (신규 팩터는 Bear 경계 최고)
Phase 5: @perf-verifier 30일 샘플 밖 검증 필수
```

---

## 주간 루틴 제안

| 요일 | 프롬프트 | 중점 |
|------|---------|------|
| 월 | #1 일일 사이클 | 주간 시작, 기준선 재측정 |
| 화 | #6 센서 집중 (VIX) | 체제 감지 민감도 |
| 수 | #6 팩터 집중 (Technical) | 모멘텀/RS 개선 |
| 목 | #3 리서치만 | 주간 논문 스캔 |
| 금 | #1 일일 사이클 | 주간 마무리 |
| 토 | #2 백테스트 재실행 | 샘플 밖 검증 |
| 일 | #5 주간 리뷰 | 7일 종합 + memory.md 정리 |

---

## API 비용 상한

| 프로바이더 | 일일 상한 | 주요 용도 |
|-----------|---------|----------|
| Perplexity Sonar Pro | $0.05 | market-researcher |
| Gemini Flash | $0.05 | (기존 ai_summary_generator 유지) |
| **일일 총합** | **$0.10** | |

초과 시 `perf-lead` 가 자동 사이클 중단 + 알림.

---

## 첫 사이클 체크리스트

최초 실행 전 확인:

- [ ] .claude/agents/ 에 6개 에이전트 파일 존재
- [ ] .env 에 PERPLEXITY_API_KEY 설정됨
- [ ] .docs/performance/, .docs/research/ 디렉토리 존재
- [ ] output/backtest_metrics.json 시드 파일 존재
- [ ] result/ 디렉토리에 최소 30일치 smart_money_picks_*.csv
- [ ] data/us_daily_prices.csv 최신
- [ ] Claude Code에서 /agents 명령으로 6개 에이전트 인식 확인
