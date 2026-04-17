# Part 6 — 7종 알림 시스템 (SQLite 기반)

> "매수는 기술, 매도는 예술, 리스크 관리는 생존" — 이 Part는 내 돈을 지키는 골키퍼를 만든다.

기존 시스템은 "뭘 살까"만 알려줬다. "언제 팔까 / 얼마나 살까 / 위험이 얼마인가"는 답하지 못했다.  
RiskAlertSystem은 Part 1~5를 모두 연결해 **7종 알림**을 자동 판단하고 SQLite에 저장한다.

**이 파일은 SQLite 기반 현재 시스템용 프롬프트다.**  
JSON 파일 기반 구버전: `prompt-risk-mgmt.md` 참조.

---

## 기존 시스템 연결

```
market_regime.py ─── regime (risk_on/neutral/risk_off/crisis)
                     adaptive_params (stop_loss, max_drawdown_warning)
                         │
market_gate.py ──── gate (GO/CAUTION/STOP), 섹터 점수
                         │
run_integrated_analysis.py ── verdict (GO/CAUTION/STOP)
                         │
ai_summary_generator.py ─── data_ai_summaries (SQLite)  ←── Part 4 연동
index_predictor.py ──────── data_index_prediction (SQLite) ←── Part 5 연동
                         │
                    ┌────▼────┐
                    │ Part 6  │  ← 여기서 만든다
                    │ Risk    │
                    │ Alert   │
                    │ System  │
                    └────┬────┘
                         │
              output/data.db
              ├── data_risk_alerts   (날짜별 이력)
              └── data_risk_snapshot (id=1 최신 스냅샷)
                         │
              /api/data/risk → 대시보드
```

## Regime Adaptive Params

| Regime | Stop-Loss | MDD Warning | 포지션 배수 |
|--------|-----------|-------------|-------------|
| risk_on  | -10% | -12% | 1.0x (풀 배팅) |
| neutral  | -8%  | -10% | 0.8x |
| risk_off | -5%  | -7%  | 0.5x (반만) |
| crisis   | -3%  | -5%  | 0.3x (최소) |

## SQLite 데이터 소스 (읽기 전용)

| 테이블 | 키 | 주요 필드 | 연결 |
|--------|----|-----------|------|
| `data_regime_snapshot` | id=1 | `regime`, `adaptive_params` | Part 2 |
| `data_daily_reports` | date | `verdict`, `market_timing` | Phase 3 |
| `data_ai_summaries` | ticker | `recommendation`, `confidence` | Part 4 |
| `data_index_prediction` | id=1 | `spy_direction`, `spy_probability` | Part 5 |

---

## 6-1 실습 — 클래스 골격 + SQLite 로드

### 프롬프트 #1 — RiskAlertSystem 골격 (SQLite-aware)

```
포트폴리오 리스크를 모니터링하는 RiskAlertSystem 클래스를 만들어 줘.

파일 경로: src/us_market/risk_alert.py

핵심 설계 원칙:
- 하드코딩 임계값 금지 — stop-loss/MDD는 market_regime adaptive_params에서 동적으로 가져온다
- JSON 파일 직접 읽기 금지 — SQLite data.db를 primary 소스로 사용
- JSON은 fallback 전용 (SQLite 접근 실패 시만)

요구사항:
- 클래스명: RiskAlertSystem
- __init__(self, data_dir='.'):
  * self.data_dir = Path(data_dir)
  * OUTPUT_DIR: Path(__file__).resolve().parent.parent.parent / "output"
  * DB_PATH: OUTPUT_DIR / "data.db"
  * output_file: OUTPUT_DIR / "risk_alerts.json"
  * self.regime_config = self._load_regime_config()
  * self.verdict_data = self._load_verdict()
  * self.ai_summaries = self._load_ai_summaries()
  * self.index_prediction = self._load_index_prediction()
  * logging 사용 (logger = logging.getLogger(__name__))

- REGIME_RISK_MULTIPLIER 클래스 변수 (포지션 사이징용):
  * risk_on: 1.0, neutral: 0.8, risk_off: 0.5, crisis: 0.3

- REGIME_VAR_MULTIPLIER 클래스 변수 (VaR 보정용):
  * risk_on: 0.8, neutral: 1.0, risk_off: 1.2, crisis: 1.5

- RISK_BUDGET 클래스 변수:
  * max_portfolio_var_pct: 5.0
  * max_single_position_pct: 15.0
  * max_sector_pct: 35.0   ← 35% 주의 (40%는 실전에서 절대 트리거 안 됨)
  * max_correlation_exposure: 3

- GRADE_MULTIPLIER 클래스 변수:
  * A: 1.2, B: 1.0, C: 0.7, D: 0.4, E: 0.0, F: 0.0

- SECTOR_MAP 클래스 변수: 11개 SPDR 섹터 ETF 매핑
  (XLK=Technology, XLF=Financials, XLV=Healthcare, XLE=Energy,
   XLI=Industrials, XLY=Consumer Discretionary, XLP=Consumer Staples,
   XLU=Utilities, XLRE=Real Estate, XLB=Materials, XLC=Communication)

- _get_db_connection() 메서드:
  * import sqlite3
  * sqlite3.connect(str(self.DB_PATH), check_same_thread=False)
  * conn.row_factory = sqlite3.Row
  * 파일 없으면 None 반환 (에러 안 남)

- _load_regime_config() 메서드 (SQLite-first):
  ① conn = self._get_db_connection()
  ② conn이 있으면: SELECT data_json FROM data_regime_snapshot WHERE id=1
     → json.loads(row["data_json"])
     → adaptive_params의 stop_loss 문자열("-8%") → float(-0.08) 파싱
  ③ conn 없거나 row 없으면: output/regime_config.json fallback
  ④ 그것도 없으면: 기본값 {regime: "neutral", stop_loss: -0.08, max_drawdown_warning: -0.10}
  * 에러 시 기본값 유지, 로그만

- _load_verdict() 메서드 (SQLite-first):
  ① SELECT verdict, data_json FROM data_daily_reports ORDER BY date DESC LIMIT 1
  ② market_timing 키 추출
  ③ fallback: output/reports/latest_report.json
  ④ 기본값: verdict="CAUTION"

- _load_ai_summaries() 메서드 (SQLite 전용):
  ① SELECT ticker, recommendation, confidence, data_json FROM data_ai_summaries
  ② {ticker: json.loads(data_json)} dict로 반환
  ③ 실패 시 빈 dict (Part 4 미실행 시 정상)

- _load_index_prediction() 메서드 (SQLite 전용):
  ① SELECT data_json FROM data_index_prediction WHERE id=1
  ② json.loads(row["data_json"]) 반환
  ③ 실패 시 빈 dict (Part 5 미실행 시 정상)
```

---

## 6-2 실습 — 종목 로드

### 프롬프트 #2 — 종목 로드 (CSV + SQLite 보완)

```
RiskAlertSystem에 load_picks() 메서드를 추가해 줘.

CSV에 entry_price, sector 컬럼이 없다. SQLite와 yfinance로 보완해야 한다.
실제 CSV 컬럼: ticker, company_name, composite_score, grade, grade_label,
  strategy, setup, technical_score, fundamental_score, analyst_score,
  rs_score, volume_score, 13f_score, rs_vs_spy

요구사항:
1. CSV 로드 우선순위:
   ① output/picks/smart_money_picks_YYYYMMDD.csv (glob → 최신 날짜)
   ② output/smart_money_picks_v2.csv
   ③ 둘 다 없으면 빈 리스트 + warning

2. 상위 20개 행: df.head(20)

3. sector 확보 (순서대로):
   ① self.ai_summaries[ticker].get("sector") 있으면 사용
      (Part 4 ai_summaries에 sector 정보 포함된 경우)
   ② 없으면 yf.Ticker(ticker).info.get("sector", "Unknown")
      (curl_cffi 세션: Session(impersonate="chrome") 사용)
   ③ 에러 시 "Unknown"

4. entry_price 확보:
   - yfinance 최신 종가 fetch (curl_cffi 세션)
   - 에러 시 0.0

5. 반환 리스트의 각 항목:
   ticker, company_name, grade, strategy, setup, composite_score,
   entry_price, sector, current_price (= entry_price와 동일로 초기화)

6. 에러 시 빈 리스트 반환
```

---

## 6-3 실습 — Drawdown + Stop-Loss

### 프롬프트 #3 — Drawdown 계산 (fixed + trailing)

```
RiskAlertSystem에 calculate_drawdowns(picks, period='3mo') 메서드를 추가해 줘.

두 가지 낙폭을 동시에 추적한다:
- Fixed drawdown: 진입가 기준 → 원금 보호
- Trailing drawdown: 최고가 기준 → 수익 보호

교육 포인트 (docstring에 포함):
"trailing stop은 가격이 오를수록 같이 올라가서 수익을 보호한다.
 예: 100에 매수 → 130까지 상승 → trailing -5% 설정 시 123.5에서 매도.
 fixed stop은 진입가 100 기준 -8%면 92에서 매도 (수익 구간에서도 92 기준)."

요구사항:
- picks 리스트에서 ticker 추출, yfinance로 period='3mo' Close 다운로드
- 각 ticker별:
  * current_price: 최신 종가 (iloc[-1])
  * peak_price: 기간 내 최고가 (.max() 또는 cummax 기준)
  * from_entry_pct: (current / entry_price - 1) * 100  (진입가 대비)
  * from_peak_pct: (current / peak_price - 1) * 100  (최고가 대비)
  * max_dd: 기간 내 최대 낙폭 (rolling max 대비 최저)
  * from_peak_days: 최고가 달성 이후 경과 일수
- 모든 float → round(2)
- entry_price == 0이면 from_entry_pct = None
- picks 비어있으면 빈 dict 반환, 에러 시 빈 dict 반환
```

### 프롬프트 #4 — Stop-Loss 체크 (regime-adaptive dual stop)

```
RiskAlertSystem에 check_stop_losses(picks, drawdowns) 메서드를 추가해 줘.

하드코딩 -8% 제거 → regime adaptive_params에서 동적으로 읽는다.
fixed stop + trailing stop을 동시에 체크한다.

요구사항:
1. fixed_threshold: self.regime_config["adaptive_params"]["stop_loss"]
   (risk_on=-10%, neutral=-8%, risk_off=-5%, crisis=-3%)

2. trailing_threshold: fixed_threshold / 2
   (neutral이면 fixed=-8% → trailing=-4%)
   이유: trailing은 수익 구간 보호라 더 타이트하게 관리

3. 각 종목:
   - from_entry_pct ≤ fixed_threshold → fixed stop BREACHED
   - from_peak_pct ≤ trailing_threshold → trailing stop BREACHED
   - 임계값의 2%p 이내 → WARNING
     (예: fixed=-8%, 현재=-6.5% → |-6.5 - (-8)| = 1.5 < 2 → WARNING)
   - 그 외 → OK

4. alert_level: 두 stop 중 더 심각한 상태 (BREACHED > WARNING > OK)

5. 반환 리스트 각 항목:
   ticker, company_name, entry_price, peak_price, current_price,
   from_entry_pct, from_peak_pct,
   fixed_threshold, trailing_threshold,
   fixed_status, trailing_status, alert_level, regime

6. entry_price == 0인 종목 스킵
7. 에러 시 빈 리스트
```

---

## 6-4 실습 — VaR + 리스크 예산

### 프롬프트 #5 — VaR/CVaR (regime 보정)

```
RiskAlertSystem에 calculate_portfolio_var(tickers, confidence=0.95,
horizon_days=5, portfolio_value=100000) 메서드를 추가해 줘.

요구사항:
1. yfinance로 6개월 Close 다운로드, 일별 수익률 계산
2. 동일 비중 포트폴리오 수익률: returns.mean(axis=1)
3. horizon_days > 1이면 rolling(horizon_days).sum()
4. Historical VaR: np.percentile(horizon_returns, (1 - confidence) * 100)
5. CVaR: VaR 이하 수익률 평균
6. Student-t VaR (scipy 있을 때만, ImportError 시 스킵):
   - scipy.stats.t.fit()로 자유도 추정
   - t.ppf(1 - confidence, df) * scale + loc
7. Regime 보정:
   - self.regime_config["regime"]으로 REGIME_VAR_MULTIPLIER 조회
   - regime_adjusted_var = var_pct * multiplier
   - 이유: 위기 시 과거 VaR은 현재 변동성을 과소평가한다
8. 리스크 예산 사용률:
   - risk_budget_usage_pct = abs(regime_adjusted_var_pct)
9. 반환: var_pct, var_dollar, cvar_pct, cvar_dollar, t_var_dollar(없으면 None),
   regime_adjusted_var_pct, regime_adjusted_var_dollar,
   risk_budget_usage_pct, confidence, horizon_days, regime
```

---

## 6-5 실습 — 섹터 집중도 + 상관관계

### 프롬프트 #6 — 섹터 집중도 + 상관관계 (35% 임계값)

```
RiskAlertSystem에 analyze_concentration_risk(picks) 메서드를 추가해 줘.

임계값: 섹터 35% (달걀을 한 바구니에 넣지 말 것)

요구사항:
1. 섹터 집중도:
   - picks의 sector 필드로 집계 ("Unknown" 제외)
   - 종목수 / 전체 × 100 = 섹터 비중
   - 35% 초과 시 경고 (← 구버전 40%에서 조정. 40%는 실전에서 절대 트리거되지 않음)

2. 상관관계:
   - yfinance 3개월 Close 수익률 → corr() 행렬
   - 기본 임계값: 0.80 초과 쌍 추출
   - crisis 체제이면 0.70으로 강화
     (위기 시 섹터간 상관관계 수렴 → 더 엄격하게)
   - i < j 범위만 (중복 방지)

3. Correlation Exposure (신규):
   - ticker별 고상관 쌍 수 카운트
   - 3쌍 이상이면 "과다 상관 노출" 경고
   - 예: NVDA가 AMD, AAPL, MSFT와 모두 0.82+ → NVDA 노출도 = 3

4. 반환:
   sector_concentration: {"Technology": {"count": 5, "pct": 25.0}, ...}
   concentration_warnings: ["Technology 45% > 한도 35%", ...]
   high_correlation_pairs: [{"pair": ["AAPL", "MSFT"], "corr": 0.87}, ...]
   correlation_exposure: {"NVDA": 3}  (2쌍 이상만)
   correlation_threshold: 0.80 또는 0.70 (crisis)

5. 종목 2개 미만이면 상관관계 스킵
```

---

## 6-6 실습 — 7종 알림 생성 (Part 4+5 SQLite 연동)

### 프롬프트 #7 — 7종 알림 생성

```
RiskAlertSystem에 generate_alerts(portfolio_value=100000) 메서드를 추가해 줘.

이 메서드가 Part 1~5를 모두 연결하는 메인 진입점이다.
SQLite에서 로드한 ai_summaries(Part 4)와 index_prediction(Part 5)을 활용한다.

7종 알림 정의:
| # | 타입               | 레벨     | 조건                                              | 데이터 소스            |
|---|-------------------|----------|---------------------------------------------------|----------------------|
| 1 | drawdown_critical | CRITICAL | from_entry_pct ≤ -20%                             | calculate_drawdowns  |
| 2 | stop_loss         | CRITICAL | fixed 또는 trailing stop BREACHED                  | check_stop_losses    |
| 3 | drawdown_warning  | WARNING  | -20% < from_entry_pct ≤ -10%                      | calculate_drawdowns  |
| 4 | concentration     | WARNING  | 섹터 비중 ≥ 35%                                    | analyze_concentration|
| 5 | var               | WARNING  | risk_budget_usage_pct ≥ 5.0                       | calculate_portfolio_var|
| 6 | ai_sell           | WARNING  | self.ai_summaries[ticker]["recommendation"]=="SELL"| data_ai_summaries(SQLite)|
| 7 | prediction        | WARNING  | spy_direction=="bearish" AND spy_probability ≥ 0.60| data_index_prediction(SQLite)|

에스컬레이션 규칙:
- ai_sell 알림이 있는 종목에 동시에 drawdown_warning 존재 → CRITICAL 상향
- prediction_warning 활성 + regime이 crisis 또는 risk_off → CRITICAL 상향
- prediction_warning 활성 → fixed_threshold를 ×0.75로 타이트하게 적용
  (예: neutral -8% → -6.0%. 하락 예측 시 더 빨리 손절)

순서대로 호출:
① picks = self.load_picks()
② drawdowns = self.calculate_drawdowns(picks)
③ stop_status = self.check_stop_losses(picks, drawdowns)
④ var_result = self.calculate_portfolio_var([p["ticker"] for p in picks],
                                             portfolio_value=portfolio_value)
⑤ position_sizes = self.calculate_position_sizes(picks, portfolio_value)
⑥ concentration = self.analyze_concentration_risk(picks)

알림 생성 후 severity 정렬: CRITICAL > WARNING > INFO

각 알림 형식:
{
  "level": "CRITICAL" | "WARNING" | "INFO",
  "type": "drawdown_critical" | "stop_loss" | "drawdown_warning" |
           "concentration" | "var" | "ai_sell" | "prediction",
  "ticker": "AAPL" 또는 "PORTFOLIO",
  "message": "사람이 읽을 수 있는 설명",
  "value": 현재 값 (float),
  "threshold": 기준값 (float),
  "action": "SELL" | "REDUCE" | "HOLD" | "MONITOR",
  "timestamp": ISO 8601
}

ai_sell 알림 예시:
{
  "level": "WARNING",
  "type": "ai_sell",
  "ticker": "TSLA",
  "message": "AI 분석: TSLA SELL 추천 (신뢰도 78%)",
  "value": 78.0,
  "threshold": 0.0,
  "action": "REDUCE"
}

prediction 알림 예시:
{
  "level": "WARNING",
  "type": "prediction",
  "ticker": "PORTFOLIO",
  "message": "SPY 하락 예측 (확신도 67.0%) — stop-loss 1.5% 타이트 적용",
  "value": 67.0,
  "threshold": 60.0,
  "action": "MONITOR"
}

market_context 섹션 반드시 포함:
{
  "regime": "risk_off",
  "verdict": "CAUTION",
  "index_prediction": {"spy_direction": "bearish", "spy_probability": 0.67},
  "ai_sell_count": 2
}

에러 시 빈 alerts 리스트 반환 (크래시 금지)
```

---

## 6-7 실습 — SQLite 저장 + 파이프라인 통합

### 프롬프트 #8 — SQLite 저장 + JSON 레거시 복사

```
generate_alerts() 메서드 내부에 SQLite 저장 로직을 추가해 줘.

저장 순서 (primary → secondary):
1. SQLite primary 저장:
   from src.db import data_store as db
   conn = sqlite3.connect(str(self.DB_PATH))
   today = datetime.now().strftime("%Y-%m-%d")
   db.upsert_risk_alert(conn, date=today, data=result, update_snapshot=True)
   conn.close()
   - update_snapshot=True → data_risk_snapshot(id=1)도 동시 갱신
   - 오늘 날짜가 primary (backfill이 아닌 live run)

2. JSON 레거시 복사 (secondary, 기존 시스템 호환):
   - output/risk_alerts.json 저장
   - frontend/public/data/risk_alerts.json 복사
     (프론트엔드가 /api/data/risk SQLite 라우트로 이미 마이그레이션됐지만
      레거시 정적 경로도 유지)

3. 로그 출력:
   "리스크 알림: CRITICAL {n}건, WARNING {n}건, INFO {n}건"
   "SQLite data_risk_alerts 저장 완료 ({today})"

4. SQLite 저장 실패 시 JSON만으로 진행 (graceful degradation)
   logger.warning("SQLite 저장 실패, JSON fallback: {e}")

반환: result dict (저장 성공/실패와 무관하게 항상 반환)
```

### 프롬프트 #9 — 파이프라인 통합 (Phase 4)

```
scripts/run_integrated_analysis.py에 Phase 4: Risk Alert를 추가해 줘.

기존 구조:
  Phase 0: 데이터 수집
  Phase 1: 시장 타이밍 (regime + gate + ML → verdict)
  Phase 2: 종목 선정 (smart money screening)
  Phase 3: 리포트 생성

추가할 것:
  Phase 4: 리스크 알림

요구사항:
1. Phase 3 완료 후 실행:
   from us_market.risk_alert import RiskAlertSystem
   risk = RiskAlertSystem(data_dir=str(Path(__file__).parent.parent))
   risk_result = risk.generate_alerts(portfolio_value=args.portfolio_value)

2. --portfolio-value CLI 인자 추가:
   parser.add_argument("--portfolio-value", type=float, default=100000,
                        help="포트폴리오 총 가치 (기본: $100,000)")

3. risk_result 요약을 daily_report JSON에 포함:
   report["risk_alerts_summary"] = {
     "critical_count": len([a for a in alerts if a["level"]=="CRITICAL"]),
     "warning_count": len([a for a in alerts if a["level"]=="WARNING"]),
     "info_count": len([a for a in alerts if a["level"]=="INFO"]),
     "risk_budget_status": risk_result.get("portfolio_summary", {}).get("risk_budget_status", "N/A"),
     "invested_pct": risk_result.get("portfolio_summary", {}).get("invested_pct", 0),
     "cash_pct": risk_result.get("portfolio_summary", {}).get("cash_pct", 100)
   }

4. 콘솔 출력에 Phase 4 요약 추가:
   ━━━ Phase 4: Risk Alert ━━━
   Regime: {regime} | Verdict: {verdict}
   CRITICAL: {n}건 | WARNING: {n}건
   투자 비중: {invested_pct}% | 현금: {cash_pct}%
   VaR(5일): ${var_dollar:,.0f} ({budget_status})

5. 텔레그램 메시지 생성 (전송은 별도):
   msg = risk.format_telegram_message()
   # 실제 전송이 필요하면 여기서 봇 API 호출
```

---

## 6-8 실습 — 단위 테스트

### 프롬프트 #10 — 단위 테스트

```
tests/test_risk_alert.py를 작성해 줘.

SQLite는 :memory: DB 사용, yfinance는 monkeypatch로 고정값 반환.

테스트 목록 (10개):

1. test_regime_adaptive_stop_loss:
   - regime="risk_off" → adaptive_params.stop_loss = -0.05
   - regime="crisis" → -0.03
   - regime_config을 SQLite :memory: DB에 직접 INSERT 후 _load_regime_config() 호출

2. test_trailing_threshold_half:
   - neutral 체제 → fixed_threshold=-0.08
   - trailing_threshold = fixed_threshold / 2 = -0.04

3. test_stop_loss_breached_critical:
   - entry=100, current=89 → from_entry=-11% → neutral(-8%) 초과 → BREACHED
   - alert_level == "BREACHED"

4. test_stop_loss_ok:
   - entry=100, current=95 → from_entry=-5% → neutral(-8%) 이내 → OK

5. test_concentration_threshold_35:
   - picks 15개 중 Technology 6개 = 40% → 35% 초과 → concentration_warnings 존재
   - "Technology" in concentration_warnings[0]

6. test_concentration_crisis_correlation_070:
   - regime="crisis" → correlation_threshold == 0.70
   - regime="neutral" → correlation_threshold == 0.80

7. test_ai_sell_alert_generated:
   - self.ai_summaries = {"TSLA": {"recommendation": "SELL", "confidence": 0.78}}
   - generate_alerts() → alerts에 type="ai_sell", ticker="TSLA" 존재

8. test_prediction_warning_bearish_60pct:
   - self.index_prediction = {"spy": {"direction": "bearish", "probability": 0.65}}
   - generate_alerts() → alerts에 type="prediction" 존재

9. test_escalation_ai_sell_plus_drawdown_warning:
   - TSLA: ai_sell=True + from_entry=-15% (drawdown_warning 구간)
   - → TSLA 관련 ai_sell 알림이 CRITICAL로 상향

10. test_sqlite_upsert_called:
    - monkeypatch로 db.upsert_risk_alert 교체
    - generate_alerts() 호출 후 upsert_risk_alert가 update_snapshot=True로 호출됐는지 확인

픽스처:
- 더미 picks 5개 (ticker, company_name, grade, entry_price, sector 포함)
- 더미 yfinance 응답: pd.DataFrame({"Close": [100, 105, 98, 102, 95]})
- 더미 ai_summaries: AAPL=BUY, MSFT=HOLD, TSLA=SELL
- SQLite :memory: DB에 regime_snapshot, daily_reports, ai_summaries, index_prediction 테이블 생성 후 INSERT

실행 방법: pytest tests/test_risk_alert.py -v
```

---

## 구현 체크리스트

완성된 `src/us_market/risk_alert.py` 검증:

- [ ] `_load_regime_config()` — SQLite first, JSON fallback
- [ ] `_load_verdict()` — `data_daily_reports` DESC LIMIT 1
- [ ] `_load_ai_summaries()` — `data_ai_summaries` 전체
- [ ] `_load_index_prediction()` — `data_index_prediction` id=1
- [ ] `RISK_BUDGET["max_sector_pct"]` == **35.0** (40이면 틀림)
- [ ] `check_stop_losses()` — `self.regime_config["adaptive_params"]["stop_loss"]` 사용 (하드코딩 금지)
- [ ] `generate_alerts()` — 7종 모두 생성, severity 정렬
- [ ] `ai_sell` — `self.ai_summaries` 활용 (파일 읽기 금지)
- [ ] `prediction` — `self.index_prediction` 활용 (파일 읽기 금지)
- [ ] `db.upsert_risk_alert(conn, today, result, update_snapshot=True)` 호출
- [ ] `output/risk_alerts.json` + `frontend/public/data/risk_alerts.json` 레거시 복사
- [ ] `pytest tests/test_risk_alert.py -v` 전체 PASS

## 전체 파이프라인 흐름 (Part 6 완성 후)

```
run_integrated_analysis.py
  Phase 0: 데이터 수집
  Phase 1: 시장 타이밍 → data_regime_snapshot (SQLite)
  Phase 2: 종목 선정 → smart_money_picks_YYYYMMDD.csv
  Phase 3: 리포트 → data_daily_reports (SQLite)
  Phase 4: 리스크 알림 ← 지금 만드는 것
    └── data_risk_alerts (이력)
    └── data_risk_snapshot (id=1 최신)
    └── output/risk_alerts.json (레거시)
    └── /api/data/risk → 대시보드
```
