# 운영 매뉴얼 (OPERATIONS.md)

> **이 문서는 "매일 이 서비스를 돌리는 사람"을 위한 runbook입니다.**
> "뭐야 이 시스템?"은 [README.md](./README.md), "대시보드 어떻게 봐?"는 [DASHBOARD-EASY-GUIDE.md](./DASHBOARD-EASY-GUIDE.md).
> 여기는 **언제 무엇을 확인하고, 무엇이 깨지면 어떻게 고치는가** 한 권입니다.

---

## 0. 한눈에 보는 운영 카드 (Quick Reference)

| 항목 | 값 |
|------|----|
| 매일 1줄 명령 | `source .venv/bin/activate && python scripts/run_integrated_analysis.py` |
| 레거시 파이프라인 | `python scripts/run_full_pipeline.py` (AI 분석 + GBM 포함 9단계) |
| 일일 스케줄러 | `python scripts/run_daily_scheduler.py` (1회) / `--status` (상태) / `--install-cron` (자동화) |
| 대시보드 | `cd frontend && npm run dev` → http://localhost:3000 |
| 긴급 롤백 | `git checkout -- <file>` (사이클별 롤백 명령은 `docs/evolution/YYYY-MM-DD_cycle*.md` 각 문서 하단) |
| API 키 | `.env` (FRED / GOOGLE / OPENAI / PERPLEXITY / FINNHUB) |
| 진화 에이전트 호출 | `@service-evolver 오늘의 evolution cycle 실행해줘` |

### 핵심 경로 8개
```
data/               ← CSV 입력 (시장 데이터)
output/             ← JSON 결과물 (regime/final_top10/index_prediction/latest_report)
output/picks/             ← 날짜별 스크리닝 (smart_money_picks_YYYYMMDD.csv)
output/reports/     ← 일일 종합 리포트 (daily_report_YYYYMMDD.json + latest_report.json)
logs/               ← 실행 로그 (daily_run_YYYYMMDD.log)
src/ml/                 ← GBM 피처/모델/검증 (Part 5)
docs/notes/       ← memory.md + backlog.md
docs/notes/daily/ ← 일일 개발 노트 + 사이클 로그
output/data.db    ← 분석 데이터 (11개 테이블, Mac 생성 → rsync)
/data/board.db    ← 게시판 데이터 (Synology에만 존재, 쓰기 가능)
.archive/legacy-dashboard/ ← 정적 대시보드 (레거시, 숨김 처리)
frontend/         ← Next.js 대시보드 (현재)
```

### 운영 원칙 (4줄)
1. **매일 1회 파이프라인 실행** → 결과 눈으로 확인 (리뷰 없이 믿지 말 것)
2. **매일 1건만 개선** → service-evolver 자가 진화 사이클 (Small-batch 원칙)
3. **의심되면 롤백** → git + 사이클 로그 = 항상 되돌릴 수 있음
4. **외부 근거 없으면 변경 금지** → regime 가중치/5센서 핵심은 논문 인용 필수

---

## 1. 일일 운영 체크리스트 (Daily Cadence)

### Morning (뉴욕 장 마감 후, 한국 시간 오전 06:00~09:00)

체크박스 6개 — 하루 5분이면 충분합니다.

- [ ] **통합 분석 실행**: `python scripts/run_integrated_analysis.py` (또는 cron 자동 실행 확인)
- [ ] **Verdict 확인**: `output/reports/latest_report.json` 의 `verdict` 필드 (GO / CAUTION / STOP)
- [ ] **체제 변경 여부**: `output/regime_result.json` 의 `regime` 필드가 전일과 다른지
  - `neutral → risk_off` 같은 전환은 주목 (적응형 파라미터 바뀜)
- [ ] **Action 분포**: `output/reports/latest_report.json` 의 `summary.action_distribution` — BUY 종목 수 확인
- [ ] **예측 확인**: `output/index_prediction.json` 의 SPY/QQQ direction + confidence
  - confidence `high` 인데 direction 이 전일과 뒤집히면 주의
- [ ] **로그 확인**: `logs/daily_run_YYYYMMDD.log` 에러 없는지 (grep ERROR)
- [ ] **스케줄러 상태** (cron 설정 시): `python scripts/run_daily_scheduler.py --status`

### Afternoon (선택, 1일 1회)

- [ ] **Evolution Cycle 실행**: `@service-evolver 오늘의 evolution cycle 실행해줘`
- [ ] `docs/evolution/2026-MM-DD_cycle*.md` 생성 확인 (7-Phase 로그)
- [ ] 변경된 파일 1~3개가 이해되는 범위인지 (수정 100줄 이하가 정상)

### Evening (종료 전, 2분)

- [ ] `output/reports/daily_report_YYYYMMDD.json` 파일 생성 확인 (오늘 날짜)
- [ ] `output/picks/smart_money_picks_YYYYMMDD.csv` 파일 생성 확인 (오늘 날짜)
- [ ] `output/prediction_history.json` 누적 개수가 어제 +1 인지
- [ ] (주 1회) 대시보드 스크린샷 — `http://localhost:8889` (TradingView 링크 동작 확인)

### 체크 실패 시 → 바로 섹션 6 (장애 대응 플레이북)

---

## 2. 주간/월간 운영 리듬 (Weekly / Monthly Cadence)

| 주기 | 작업 | 근거 / 명령어 |
|------|------|---------------|
| **주 1회 (월)** | IndexPredictor 수동 재학습 | `python src/us_market/index_predictor.py` (7일 경과 시 자동이지만 수동 권장) |
| **주 1회** | `backlog.md` P0 리뷰 + 다음 사이클 선정 | service-evolver Phase 4 |
| **주 1회** | API 비용 누적 점검 (Gemini/GPT/Perplexity) | 콘솔 로그 집계 |
| **월 1회** | 주가 데이터 full refresh | `python src/collectors/fetch_sp500_prices.py` (503종목 × 1년) |
| **월 1회** | walk-forward 재검증 (PBO/DSR) | `python -m src.ml.validation.walk_forward` |
| **월 1회** | `memory.md` Do's/Don'ts 정리 (중복 제거, Open Questions 폐쇄) | 수동 편집 |
| **월 1회** | `.env` API 키 만료일 점검 (FRED 제외) | provider dashboard |
| **분기 1회** | GBM full retrain (503 × 3년 데이터 확보 여부 점검) | scale-up gate (섹션 10) |
| **분기 1회** | 완료된 backlog Completed 섹션 archive 이동 | backlog.md 위생 |

---

## 3. 시스템 헬스 체크 (Daily Health Checks)

아침 파이프라인 실행 후 **30초 안에** 확인 가능한 항목.

| 항목 | 확인 방법 | OK 기준 | NOK 시 |
|------|-----------|---------|--------|
| 데이터 신선도 | `tail -1 data/us_daily_prices.csv` | 마지막 날짜 = 직전 거래일 | `fetch_sp500_prices.py` 재실행 |
| API 키 유효성 | 콘솔 401/403 에러 없음 | (콘솔) | `.env` 재발급 |
| 디스크 용량 | `du -sh output/ output/picks/ src/ml/` | 각 <500MB | 오래된 `predictor_model_*.joblib` 정리 |
| 모델 정확도 | `cat output/prediction_history.json \| jq '.[-5:][].model_accuracy'` | 5일 평균 ≥ 0.50 | 재학습 (섹션 4) |
| regime 정합성 | `regime_result.json` 5 센서 vs `regime_config.json` label | 모순 없음 | market_regime 디버깅 |
| 파일 누적 | `ls output/picks/*.csv \| wc -l` | 월별 ~22개 | 없으면 파이프라인 실패 이력 |

**월 1회**: `python src/pipeline/data_quality_report.py` 로 CSV 100점 채점.

---

## 4. 드리프트 & 성능 저하 감지 (Drift Monitoring)

MLOps 2026 best practice는 **3종 드리프트**를 구분합니다 ([출처](https://www.evidentlyai.com/ml-in-production/model-monitoring)). 이 시스템에 맞춘 임계와 대응:

| 드리프트 종류 | 감지 지표 | 경고 임계 | 대응 |
|-----|-----|-----|-----|
| **Data drift** (입력 분포 변화) | VIX 20일 rolling mean, ERP 분위수 이동 | VIX 5일 평균 >30 **또는** ERP <2% | 체제 전환 의심 → `market_regime.py` 재계산 |
| **Prediction drift** (예측 분포 변화) | 최근 10일 SPY `direction` 카운트 | "같은 방향 10일 연속" | 모델 bias 의심 → Brier Score 측정 (backlog P0) |
| **Performance drift** (정확도 하락) | `model_accuracy` 5일 이동평균 | <0.50 **5일 지속** | 수동 재학습 `python src/us_market/index_predictor.py` |
| **Rule↔ML 상충** (Summary2-12,13) | rule STRONG_BULL ≥60 AND ML BEARISH | 즉시 | mean-reversion 경고 플래그 (backlog P1) |
| **Fold 편차 (체제 변화)** (Summary2-7) | walk-forward fold 간 정확도 ≥7.7% 편차 | 연속 2분기 | 피처 재설계 검토 (backlog P1) |
| **API 응답 품질** | Gemini JSON 파싱 실패율 | >5% / 일 | provider 전환, prompt 재조정 |

### 구체 감지 스니펫 (월 1회 돌려보기)

```bash
# Performance drift
python3 -c "
import json
h = json.load(open('output/prediction_history.json'))
acc = [e.get('model_accuracy', 0.5) for e in h[-5:]]
print(f'5일 평균 model_accuracy: {sum(acc)/len(acc):.3f}')
print('경고!' if sum(acc)/len(acc) < 0.50 else 'OK')
"
```

---

## 5. API 비용 관리 (Cost Guardrails)

### 권장 월간 예산 (개인 교육용 기준)

| Provider | 일일 상한 | 월간 상한 | 단가 |
|----------|----------|-----------|------|
| Gemini Flash | $0.05 | $1.50 | $0.10/$0.40 per 1M tokens |
| OpenAI GPT-5-mini | $0.10 | $3.00 | $0.15/$0.60 per 1M tokens |
| Perplexity Sonar | $0.30 | $9.00 | $3 per 1K requests |
| **합계** | **$0.45** | **$13.50** | — |

### Fallback 체인
```
Gemini (기본) → GPT-5-mini (429 시) → Perplexity (뉴스 강화) → AI 생략 (로컬 요약)
```

### 비용 초과 방지
- `ai_summary_generator.py --top 10` 고정 (전체 503종목 분석 금지 — 비용 50배)
- 월간 합계 확인: 현재 `APIUsageTracker`는 **실행 단위 집계만 지원**. 월별 누적 파일은 **backlog P2 후보** (추가 필요).
- 무료 쿼터 소진 → 익일 자동 복구, 그날은 AI 분석 생략 가능 (파이프라인은 계속 돌아감)

---

## 6. 장애 대응 플레이북 (Troubleshooting Runbook)

| 증상 | 원인 | 대응 |
|-----|-----|-----|
| `yfinance 429 Too Many Requests` | curl_cffi 세션 차단 | 1시간 대기 → `impersonate="chrome"` 재확인 → 심하면 VPN |
| `FRED DFII10 returns None` | FRED_API_KEY 만료/무효 | [fred.stlouisfed.org](https://fred.stlouisfed.org) 재발급 → `.env` 갱신 |
| `Gemini 429 ResourceExhausted` | 무료 쿼터 소진 | `--provider openai` 전환 or 익일 대기 |
| `ValueError: format code 'f' for str` | `confidence` (str) vs `confidence_pct` (float) 혼동 | `docs/notes/memory.md` Don'ts #1 참조 |
| `LightGBM "Label N >= M mappings"` | `rank_xendcg` label 초과 | `objective="regression"` 유지 (memory.md 사이클 로그) |
| `drawio overlap` | 다이어그램 좌표 충돌 | Python XML parser 선검사 (memory.md Do's #5) |
| `edu.frindle.synology.me/notice` 404 | Next.js에 /notice 라우트 없음 | DSM Reverse Proxy 대상을 `localhost:8080` (nginx)으로 변경 — `/pages/*.html`은 nginx가 직접 서빙 |
| SCP `tar: cannot change ownership` | `/volume1/docker/us-stock` 권한 문제 | `sudo mkdir -p /volume1/docker/us-stock && sudo chown -R jeehoon /volume1/docker/us-stock` 후 재실행 |
| `NaN in forward returns (all 100%)` | pd.Index 오얼라인 | `pd.Index(df["Date"].values, name="Date")` 패턴 |
| `scripts/run_full_pipeline.py Step 7 FAIL` | LightGBM/pyarrow 미설치 | `pip install lightgbm pyarrow` + macOS는 `brew install libomp` |
| `Step 8 IndexPredictor FAIL` | 2년치 SPY 데이터 부족 | `yfinance.download('SPY', period='2y')` 수동 테스트 |
| `final_report_generator 빈 결과` | smart_money_picks CSV 없음 | Step 4 `scripts/run_screening.py` 먼저 실행 |
| `AI 응답 JSON 파싱 실패` | LLM 자유 텍스트 반환 | `ai_response_parser.py` 검증, prompt에 "JSON만 출력" 강화 |

### 디버깅 일반 원칙

1. **스텝별 단독 실행**: 파이프라인 실패 시 해당 step 파일을 직접 `python -m ...` 실행
2. **logging 레벨**: 기본 INFO, 상세는 `PYTHONLOGLEVEL=DEBUG python ...`
3. **memory.md 먼저 검색**: 같은 증상 기록 있으면 재탕 금지
4. **실패 로그 저장**: 새 이슈는 `docs/notes/memory.md` Don'ts 에 append

---

## 7. 백업 & 롤백 (Disaster Recovery)

### 백업 정책
- **git**: 코드 + `docs/notes/*` 은 필수. `output/final_top10_report.json` 은 선택.
- **모델**: `output/predictor_model_*.joblib`, `src/ml/models/*.pkl` **백업 불필요** (재학습 가능).
- **데이터**: `data/*.csv` **백업 불필요** (pipeline 재실행으로 복원).

### 롤백 3단계

| 레벨 | 시나리오 | 명령 |
|------|----------|------|
| **1: 단일 파일** | 방금 수정한 문서 되돌리기 | `git checkout -- docs/README.md` |
| **2: 사이클 단위** | 어제 service-evolver 변경 취소 | `docs/evolution/YYYY-MM-DD_cycleN.md` 의 "롤백" 섹션 명령 실행 |
| **3: 코드 전체** | 여러 사이클 되감기 | `git log` → `git checkout <commit>` + 모델 재학습 |

### 데이터 full rebuild
```bash
# CSV 전체 재생성 (~20분)
python src/pipeline/run_pipeline.py --top-n 503 --period 1y --output-dir data

# 모델 재학습 (~10분)
python src/us_market/index_predictor.py
python -m src.ml.pipeline.train
```

### 감사 규칙
- `backlog.md` **Completed 섹션 삭제 금지** (최소 14일 유지, 이후 `backlog_archive.md` 이동)
- 사이클 로그 `YYYY-MM-DD_cycle*.md` **영구 보존** (학습 이력)

---

## 8. service-evolver 운영 (Evolution Cycle Operations)

### 호출
```
@service-evolver 오늘의 evolution cycle 실행해줘
```

### 7-Phase 개요 (자세한 내용은 README Part 6)
```
Phase 1 (10분) 현황 파악      — README/architecture/memory.md 상태 파악
Phase 2 (15분) 트렌드 리서치   — WebSearch로 24시간 내 퀀트/논문 스캔
Phase 3 (10분) Gap Analysis  — 현재 시스템 vs 트렌드 갭
Phase 4 (5분)  개선 선정       — Impact/Effort/Risk 로 오늘 1건 선정
Phase 5 (30~60분) 코드 수정   — Edit/Write 실제 구현
Phase 6 (10분) 검증            — syntax + import + unit (3-layer)
Phase 7 (5분)  문서 갱신       — memory.md + backlog.md + 사이클 로그
```

### 승인/거부 기준 (사용자 리뷰)

| 판정 | 조건 |
|------|------|
| ✅ **승인** | Impact=High AND Risk=Low AND 3-layer 검증 통과 AND 롤백 명령 명시 |
| ⚠️ **조건부** | Impact=Medium 또는 Risk=Medium → critic-reviewer 양면 검증 추가 요청 |
| ❌ **거부** | 외부 근거(논문/기사) 부재 / backlog 무관 / **5 센서 가중치 변경** / 롤백 불가 |

### Reflexion Memory 위생 (월 1회)
- Do's 중복 합치기
- Open Questions 중 해결된 것 → memory.md 하단 "Closed" 섹션 이동
- Don'ts 는 영구 보존 (재발 방지)

### 사이클 간 연속성
새 사이클 시작 전 **필독**: `memory.md` 전체 + 최근 3개 사이클 로그

---

## 9. 보안 & 시크릿 (Security & Secrets)

### 절대 규칙
1. **`.env` git 커밋 금지** — `.gitignore` 등록 확인
2. **프롬프트 문서에 평문 키 금지** — `<YOUR_KEY>` placeholder 만
3. **로그/스크린샷에 키 노출 금지** — 로그 마스킹 포맷터 권장

### 키 rotation 주기 (권장)
| API | 주기 | 비용 |
|-----|------|------|
| FRED | 필요 없음 | 무료, 만료 없음 |
| GOOGLE (Gemini) | 분기 1회 | 무료 쿼터 기반 |
| OPENAI | 분기 1회 | 유료 — 도난 시 손해 큼 |
| PERPLEXITY | 분기 1회 | 유료 |
| FINNHUB | 반기 1회 | 선택 |

### AI 결과물 민감도
- `output/ai_summaries.json` — **비민감** (공개 뉴스 기반 요약)
- `output/final_top10_report.json` — **비민감** (투자 추천 주의 문구 필요)
- `data/*.csv` — **비민감** (공개 데이터)

### 투자 판단 면책
> 이 시스템은 **교육용**입니다. 출력은 투자 자문이 아니며, 실제 매매 판단은 본인 책임입니다.

---

## 10. 스케일업 경로 (MVP → Production Gate)

현재 상태는 **MVP**. Production 승격까지 4단계.

| 단계 | 데이터 | 통과 기준 | 추정 기간 |
|------|--------|-----------|-----------|
| **MVP (현재)** | 50종목 × 1년 | GBM rank IC OOS >0.05 ✅ (PBO 0.900 FAIL) | — |
| **Beta** | 200종목 × 2년 | PBO <0.7, DSR >0.1 | 1~2개월 |
| **Production** | 503종목 × 3년 | PBO <0.5, DSR >0.3, walk-forward VERDICT=PASS | 3~6개월 |
| **Live** | 매일 자동 + 알림 | model_accuracy >0.55, 30일 연속 안정 | 운영 검증 |

### 단계 전환 gate
- `python -m src.ml.validation.walk_forward` → `VERDICT=PASS`
- `perf-verifier` 에이전트 승인 (회귀 테스트 + A/B)
- 최소 30일 paper-trading 기록 (`prediction_history.json`)

### 지금 해야 할 것 (Beta 진입 준비)
1. 주가 데이터 → 503종목 × 2년으로 확장 (`fetch_sp500_prices.py --period 2y`)
2. `us_macro.csv` 시계열 축적 (backlog P0, 매일 append)
3. Brier Score + Platt Scaling 도입 (backlog P0, Summary2-11 근거 -28% 검증)

---

## 11. 문서 맵 & 에스컬레이션

### 질문별 문서 라우팅

| 질문 | 문서 |
|------|------|
| "이 시스템 뭐야?" | [docs/README.md](./README.md) |
| "대시보드 어떻게 봐?" | [docs/DASHBOARD-EASY-GUIDE.md](./DASHBOARD-EASY-GUIDE.md) |
| "왜 이렇게 만들었어?" (프롬프트 히스토리) | [docs/prompt_전체.md](./prompt_전체.md) / [docs/prompt_v2.md](./prompt_v2.md) |
| "시스템 구조가 어떻게 생겼지?" | [docs/architecture.drawio](./architecture.drawio) |
| **"매일 뭐 해야 해?"** | **이 문서 (OPERATIONS.md) ✅** |
| "어제 뭐 바꿨지?" | [docs/notes/memory.md](../docs/notes/memory.md) + [docs/notes/daily/](../docs/notes/daily/) 최근 사이클 로그 |
| "할 일은 뭐?" | [docs/notes/backlog.md](../docs/notes/backlog.md) |

### 의사결정 매트릭스 — 누가 뭘 결정하나

| 변경 종류 | 결정자 | 검증 요구 |
|-----------|--------|-----------|
| rule 파라미터 튜닝 (gate 임계 등) | signal-optimizer | perf-verifier A/B |
| ML 피처 추가/삭제 | model-lead + gbm-trainer | walk-forward PASS |
| **regime 5센서 가중치 변경** | **사용자 직접 승인 필수** | critic-reviewer Bull/Bear + 논문 근거 |
| 새 API 추가 | 사용자 | 비용 예산 검토 |
| 문서/UX 변경 | service-evolver | grep 검증 |
| 에이전트 프롬프트 | 사용자 | 테스트 1 사이클 |

### 외부 링크 (공식)
- FRED API: https://fred.stlouisfed.org
- yfinance 이슈: https://github.com/ranaroussi/yfinance/issues
- LightGBM 문서: https://lightgbm.readthedocs.io
- Morningstar ERP (센서 근거): https://global.morningstar.com/en-nd/markets/this-simple-metric-could-predict-future-us-stock-market-returns
- MLOps Monitoring 가이드: https://www.evidentlyai.com/ml-in-production/model-monitoring

---

## 12. 용어 사전 (Glossary)

| 용어 | 의미 |
|------|------|
| regime | 시장 체제 (risk_on / neutral / risk_off / crisis) |
| gate | 매수 신호등 (GO / CAUTION / STOP) |
| verdict | regime + gate + ML 종합 판정 (GO / CAUTION / STOP) |
| action | verdict + grade 조합 행동 지침 (BUY / SMALL BUY / WATCH / HOLD) |
| strategy | 기술적 패턴 분류 (Trend / Swing / Reversal) |
| setup | 진입 패턴 분류 (Breakout / Pullback / Base) |
| ERP | Equity Risk Premium = SPY earnings yield − TIPS 10y real yield |
| Brier Score | 확률 예측 정확도 (0=완벽, 0.25=랜덤, 1=완전틀림) |
| PBO | Probability of Backtest Overfitting (López de Prado, 낮을수록 신뢰) |
| DSR | Deflated Sharpe Ratio (다중 테스트 보정 샤프) |
| IC | Information Coefficient (예측↔실현수익 상관) |
| IR | Information Ratio (IC의 일관성) |
| walk-forward | 시간 순서 지키며 과거로 미래 맞히기 검증 |
| embargo | 훈련/테스트 사이 공백 기간 (look-ahead 방지) |
| Reflexion | 성공/실패 누적 메모리 기반 자가 개선 |
| Cross-sectional | 같은 시점 여러 종목 비교 랭킹 |

---

## 유지보수 정책 (이 문서 자체)

- **service-evolver Phase 7 필수 갱신 대상** (memory.md 수준의 비중)
- Evolution cycle에서 **운영 절차가 바뀌면 이 문서 동기화**
- **월 1회 임계값 캘리브레이션**: 실제 API 비용 실측치 vs 예산, 실제 drift 발생 빈도 vs 임계

---

**마지막 업데이트**: 2026-04-17 (docs 구조 정리 반영 — docs/notes/daily/ 분리, legacy-dashboard 경로 수정)
**다음 리뷰**: 2026-05-13 (월간 캘리브레이션)
