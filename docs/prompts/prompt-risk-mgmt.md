# Part 6 — 리스크 알림 시스템 (RiskAlertSystem) 프롬프트 모음

> "매수는 기술, 매도는 예술, 리스크 관리는 생존" — 이 Part는 내 돈을 지키는 골키퍼를 만든다.

기존 시스템은 "뭘 살까"만 알려주고, "언제 팔까 / 얼마나 살까 / 위험이 얼마인가"는 답하지 못한다.
RiskAlertSystem은 market_regime(체제) + market_gate(신호) + verdict(판정)를 읽어서
**포지션 사이징, stop-loss, VaR, 집중도**를 자동 판단하고, 대시보드 + 텔레그램으로 알려주는 방어 레이어다.

### 기존 시스템과의 연결

```
market_regime.py ─── regime (risk_on/neutral/risk_off/crisis)
                     adaptive_params (stop_loss, max_drawdown_warning)
                         │
market_gate.py ──── gate (GO/CAUTION/STOP), 섹터 점수, volume-price divergence
                         │
run_integrated_analysis.py ── verdict (GO/CAUTION/STOP) + action (BUY/SMALL BUY/WATCH/HOLD)
                         │
                    ┌────▼────┐
                    │ Part 6  │  ← 여기서 만든다
                    │ Risk    │
                    │ Alert   │
                    │ System  │
                    └────┬────┘
                         │
              output/risk_alerts.json → 대시보드 + 텔레그램
```

### Regime Adaptive Params (참조)

| Regime | Stop-Loss | MDD Warning | 포지션 배수 |
|--------|-----------|-------------|-------------|
| risk_on | -10% | -12% | 1.0x (풀 배팅) |
| neutral | -8% | -10% | 0.8x |
| risk_off | -5% | -7% | 0.5x (반만) |
| crisis | -3% | -5% | 0.3x (최소) |

### 6개 Regime 센서 (현재 가중치)

| 센서 | 가중치 | 데이터 |
|------|--------|--------|
| VIX | 25% | ^VIX 변동성 |
| Trend | 22% | SPY vs SMA50/SMA200 |
| Breadth | 18% | 섹터 ETF 200MA 위 비율 |
| Credit | 15% | HY OAS or HYG/IEF |
| Yield Curve | 12% | 10Y-2Y 스프레드 |
| Put/Call | 8% | CBOE PCR 역발상 |

---

## 6-1 실습 — 클래스 골격 + Regime 연동

### 프롬프트 #1 — RiskAlertSystem 골격 (regime-aware)

```
포트폴리오 리스크를 모니터링하는 RiskAlertSystem 클래스를 만들어 줘.

파일 경로: src/us_market/risk_alert.py

핵심 설계 원칙:
- 하드코딩 임계값 금지 — 모든 stop-loss/MDD 임계값은 market_regime의 adaptive_params에서 동적으로 가져온다
- verdict(GO/CAUTION/STOP)를 읽어서 포지션 사이징에 반영한다

요구사항:
- 클래스명: RiskAlertSystem
- __init__(self, data_dir='.'):
  * self.data_dir = Path(data_dir)
  * OUTPUT_DIR: Path(__file__).resolve().parent.parent.parent / "output"
    (index_predictor.py와 동일 패턴)
  * output_file: OUTPUT_DIR / "risk_alerts.json"
  * self.regime_config = self._load_regime_config()
  * self.verdict_data = self._load_verdict()
  * logging 사용 (logger = logging.getLogger(__name__))

- REGIME_RISK_MULTIPLIER 클래스 변수 (포지션 사이징용):
  * risk_on: 1.0  (풀 배팅 가능)
  * neutral: 0.8
  * risk_off: 0.5  (반만)
  * crisis: 0.3  (최소한만)

- SECTOR_MAP 클래스 변수: 11개 SPDR 섹터 ETF 매핑
  (XLK=Technology, XLF=Financials, XLV=Healthcare, XLE=Energy,
   XLI=Industrials, XLY=Consumer Discretionary, XLP=Consumer Staples,
   XLU=Utilities, XLRE=Real Estate, XLB=Materials, XLC=Communication)

- _load_regime_config() 메서드:
  * output/regime_config.json 읽기
  * adaptive_params의 stop_loss를 문자열("-8%")에서 float(-0.08)로 파싱
  * 파일 없으면 기본값: regime="neutral", stop_loss=-0.08, max_drawdown_warning=-0.10

- _load_verdict() 메서드:
  * output/reports/latest_report.json 읽기
  * verdict (GO/CAUTION/STOP)와 market_timing 추출
  * 파일 없으면 기본값: verdict="CAUTION"

- _load_index_prediction() 메서드:
  * output/index_prediction.json 읽기 (Part 5)
  * 파일 없으면 빈 dict

- 모든 _load 메서드: 파일 없으면 기본값 유지, 에러 안 남 (로그만)
```

### 프롬프트 #2 — 종목 로드 (실제 데이터 구조)

```
RiskAlertSystem에 load_picks() 메서드를 추가해 줘.

중요 — 실제 CSV 구조를 반영해야 한다:
- CSV에 entry_price, sector 컬럼이 없다. 별도로 구해야 한다.
- 실제 컬럼: ticker, company_name, composite_score, grade, grade_label,
  strategy, setup, technical_score, fundamental_score, analyst_score,
  rs_score, volume_score, 13f_score, rs_vs_spy

요구사항:
1. CSV 로드 우선순위:
   ① output/picks/smart_money_picks_YYYYMMDD.csv (glob → 최신 날짜)
   ② output/smart_money_picks_v2.csv
   ③ 둘 다 없으면 빈 리스트 + warning

2. 상위 20개 행 사용: df.head(20) (screener 기본 출력 기준)

3. entry_price 확보:
   - performance.json에 해당 ticker의 buy_price가 있으면 사용
   - 없으면 yfinance로 최신 종가 fetch (curl_cffi 세션 사용)
   - 에러 시 0.0 (나중에 stop-loss 체크에서 스킵됨)

4. sector 확보:
   - yf.Ticker(ticker).info.get("sector", "Unknown") (캐싱: dict에 저장)
   - 에러 시 "Unknown"

5. 각 행을 dict로 반환:
   ticker, company_name, grade, strategy, setup, composite_score,
   entry_price, sector, current_price

6. 에러 시 빈 리스트 반환
```

---

## 6-2 실습 — Drawdown + Trailing Stop

### 프롬프트 #3 — Drawdown 계산 (trailing 추가)

```
RiskAlertSystem에 calculate_drawdowns(picks, period='3mo') 메서드를 추가해 줘.

기존 drawdown에 trailing stop 개념을 추가한다.
- Fixed stop: 진입가(entry_price) 대비 하락률 → 원금을 보호
- Trailing stop: 매수 이후 최고가(peak) 대비 하락률 → 수익을 보호

요구사항:
- picks 리스트에서 ticker 추출, yfinance로 3개월 Close 가격 다운로드
- 각 ticker별 계산:
  * current_price: 최신 종가
  * peak_price: 기간 내 최고가 (cummax)
  * from_entry_pct: (current / entry_price - 1) * 100 (진입가 대비)
  * from_peak_pct: (current / peak_price - 1) * 100 (최고가 대비)
  * max_dd: 기간 내 최대 낙폭 (cummax 대비 최저점)
  * from_peak_days: 최고가 이후 경과 일수
- 모든 값 float 변환 후 round(2)
- entry_price가 0이면 from_entry_pct는 None
- picks가 비어있으면 빈 dict 반환

교육 포인트를 docstring에 포함:
"trailing stop은 가격이 오를수록 같이 올라가서 수익을 보호한다.
 예: 100에 매수 → 120까지 상승 → trailing stop -5%면 114에서 매도.
 fixed stop은 진입가 100 기준 -8%면 92에서 매도."
```

### 프롬프트 #4 — Stop-Loss 체크 (regime-adaptive + dual stop)

```
RiskAlertSystem에 check_stop_losses(picks, drawdowns) 메서드를 추가해 줘.

핵심 변경: 하드코딩 -8% 제거 → regime adaptive params 사용.
두 가지 stop을 동시에 체크한다.

요구사항:
1. fixed_threshold: self.regime_config의 adaptive_params.stop_loss
   (regime별: risk_on=-10%, neutral=-8%, risk_off=-5%, crisis=-3%)

2. trailing_threshold: fixed_threshold의 절반
   (예: neutral이면 fixed=-8%, trailing=-4%)
   근거: trailing은 이미 수익 구간이므로 더 타이트하게 보호

3. 각 종목에 대해 drawdowns에서 from_entry_pct, from_peak_pct 참조:
   - from_entry_pct ≤ fixed_threshold → fixed stop BREACHED
   - from_peak_pct ≤ trailing_threshold → trailing stop BREACHED
   - 임계값의 2% 이내이면 → WARNING (예: threshold=-8%, 현재=-6.5%)
   - 그 외 → OK

4. 반환 리스트의 각 항목:
   ticker, company_name, entry_price, peak_price, current_price,
   from_entry_pct, from_peak_pct,
   fixed_threshold, trailing_threshold,
   fixed_status ("OK" | "WARNING" | "BREACHED"),
   trailing_status ("OK" | "WARNING" | "BREACHED"),
   regime, alert_level (가장 심각한 상태)

5. entry_price가 0인 종목은 스킵

6. 에러 시 빈 리스트 반환
```

---

## 6-3 실습 — VaR + 리스크 예산

### 프롬프트 #5 — VaR/CVaR 계산 (regime 보정)

```
RiskAlertSystem에 calculate_portfolio_var(tickers, confidence=0.95,
horizon_days=5, portfolio_value=100000) 메서드를 추가해 줘.

요구사항:
1. yfinance로 6개월 Close 가격 다운로드
2. 동일 비중 포트폴리오 수익률 합성: returns.mean(axis=1)
3. horizon_days > 1이면 rolling(horizon_days).sum()
4. Historical VaR: np.percentile(horizon_returns, (1 - confidence) * 100)
5. CVaR: VaR 이하 수익률의 평균
6. Student-t VaR (scipy 있을 때만, ImportError 시 스킵):
   - scipy.stats.t.fit()으로 자유도 추정
   - t.ppf(1 - confidence, df) * scale + loc

7. Regime 보정 (신규):
   - REGIME_VAR_MULTIPLIER: risk_on=0.8, neutral=1.0, risk_off=1.2, crisis=1.5
   - regime_adjusted_var = var_pct * multiplier
   - 근거: 위기 시 과거 VaR은 위험을 과소평가한다 (변동성 확장 중)

8. 리스크 예산 사용률 계산:
   - risk_budget_usage_pct = abs(regime_adjusted_var * portfolio_value / 100) / portfolio_value * 100

9. 반환: var_pct, var_dollar, cvar_pct, cvar_dollar, t_var_dollar,
   regime_adjusted_var_pct, regime_adjusted_var_dollar,
   risk_budget_usage_pct, confidence, horizon_days, degrees_of_freedom, regime
```

### 프롬프트 #6 — 리스크 예산 체크 (신규)

```
RiskAlertSystem에 check_risk_budget(picks, portfolio_value=100000) 메서드를 추가해 줘.

리스크 예산 = 포트폴리오 전체의 위험 한도. 개별 종목이 아무리 좋아도, 포트폴리오 전체
위험이 한도를 넘으면 추가 매수를 중단해야 한다.

요구사항:
1. RISK_BUDGET 클래스 변수:
   * max_portfolio_var_pct: 5.0   (5일 VaR이 포트폴리오의 5% 초과 금지)
   * max_single_position_pct: 15.0  (한 종목 15% 초과 금지)
   * max_sector_pct: 40.0  (한 섹터 40% 초과 금지)
   * max_correlation_exposure: 3  (고상관 쌍 3개 초과 종목 경고)

2. 체크 로직:
   ① calculate_portfolio_var() 호출 → risk_budget_usage_pct 확인
   ② 포지션 사이즈별 단일 종목 비중 확인 (position_sizes가 있으면)
   ③ 섹터별 비중 합산 → max_sector_pct 초과 확인

3. 반환:
   budget_status: "OK" | "WARNING" | "EXCEEDED"
   reasons: ["VaR 6.2% > 한도 5.0%", "Technology 섹터 45% > 한도 40%", ...]
   details: { var_usage_pct, max_position_pct, max_sector_pct, ... }

4. 판정 기준:
   - EXCEEDED: VaR 한도 초과 또는 단일 종목 20% 초과
   - WARNING: VaR 한도의 80% 초과 또는 섹터 한도 초과
   - OK: 모든 항목 한도 이내
```

---

## 6-4 실습 — 포지션 사이징

### 프롬프트 #7 — 포지션 사이즈 계산 (신규)

```
RiskAlertSystem에 calculate_position_sizes(picks, portfolio_value=100000) 메서드를 추가해 줘.

포지션 사이징 = "얼마나 살 것인가". 가장 과소평가되는 리스크 관리 도구.
좋은 종목이라도 과도한 배팅은 포트폴리오를 망가뜨린다.

3단계 조정:
① Grade 조정: 종목 품질에 따라 비중 차등
② Regime 조정: 시장 체제에 따라 전체 노출도 축소/확대
③ Verdict 오버라이드: STOP이면 모든 포지션 0%

요구사항:
1. 기본 배분: 균등 비중 (예: 10종목이면 10%씩)

2. Grade 조정 배수:
   * A: 1.2x (Strong Accumulation → 비중 확대)
   * B: 1.0x (기본)
   * C: 0.7x (Neutral → 축소)
   * D: 0.4x (Distribution → 최소)
   * E/F: 0.0x (Capitulation → 매수 안 함)

3. Regime 조정: REGIME_RISK_MULTIPLIER[현재 regime] 곱하기
   * risk_on × 1.0, neutral × 0.8, risk_off × 0.5, crisis × 0.3

4. Verdict 오버라이드:
   * STOP → 모든 포지션 0% (전액 현금)
   * CAUTION → 총 투자 비중 50% 상한 (나머지 현금)
   * GO → 제한 없음

5. 정규화: 합계가 100%를 초과하지 않도록 비례 축소

6. 반환 리스트의 각 항목:
   ticker, company_name, grade,
   base_pct (균등 비중),
   grade_multiplier,
   regime_multiplier,
   verdict_cap (적용된 상한),
   final_pct (최종 비중),
   dollar_amount (portfolio_value * final_pct / 100)

7. 마지막에 cash_pct (100 - 투자 비중 합계), cash_dollar 추가

예시 (neutral 체제, CAUTION 판정, 5종목):
| Ticker | Grade | 균등 | Grade조정 | Regime조정 | Verdict상한 | 최종 |
|--------|-------|------|-----------|-----------|------------|------|
| AAPL   | A     | 20%  | 24%       | 19.2%     | 50% cap    | 16%  |
| MSFT   | B     | 20%  | 20%       | 16.0%     | 50% cap    | 13%  |
| TSLA   | C     | 20%  | 14%       | 11.2%     | 50% cap    | 9%   |
| XOM    | D     | 20%  | 8%        | 6.4%      | 50% cap    | 5%   |
| GME    | E     | 20%  | 0%        | 0%        | 50% cap    | 0%   |
| CASH   |       |      |           |           |            | 57%  |
```

---

## 6-5 실습 — 집중도 + 상관관계

### 프롬프트 #8 — 집중도 + 상관관계 분석 (강화)

```
RiskAlertSystem에 analyze_concentration_risk(picks) 메서드를 추가해 줘.

요구사항:
1. 섹터 집중도:
   - picks의 sector 필드로 집계 (sector가 "Unknown"이면 제외)
   - 종목 수 / 전체 × 100 = 섹터 비중
   - 40% 초과 시 경고 목록에 추가

2. 상관관계:
   - yfinance 3개월 Close 수익률 → corr() 행렬
   - 기본 임계값: 0.80 초과 쌍 추출
   - crisis 체제이면 임계값을 0.70으로 강화 (위기 시 상관관계 수렴하므로)
   - i < j 범위에서만 (중복 방지)

3. Correlation Exposure (신규):
   - 각 ticker별 고상관 쌍 수 카운트
   - 3쌍 이상이면 "과다 상관 노출" 경고
   - 예: AAPL이 MSFT, GOOGL, META와 모두 0.85+ → AAPL 상관 노출도 = 3

4. 반환:
   sector_concentration: {"Technology": {"count": 5, "pct": 25.0}, ...}
   concentration_warnings: ["Technology 45% > 한도 40%", ...]
   high_correlation_pairs: [{"pair": ["AAPL", "MSFT"], "corr": 0.87}, ...]
   correlation_exposure: {"AAPL": 3, ...}  (2쌍 이상인 것만)
   correlation_threshold: 0.80 (또는 0.70 if crisis)

5. 종목 2개 미만이면 상관관계 스킵
```

---

## 6-6 실습 — 알림 생성 + 출력

### 프롬프트 #9 — generate_alerts() 오케스트레이터

```
RiskAlertSystem에 generate_alerts(portfolio_value=100000) 메서드를 추가해 줘.

이 메서드가 모든 분석을 조율하는 메인 진입점이다.
모든 개별 분석 결과를 모아서 3단계 알림(CRITICAL/WARNING/INFO)으로 분류한다.

요구사항:
1. 순서대로 호출:
   ① picks = self.load_picks()
   ② drawdowns = self.calculate_drawdowns(picks)
   ③ stop_status = self.check_stop_losses(picks, drawdowns)
   ④ var_result = self.calculate_portfolio_var([p["ticker"] for p in picks],
                                                portfolio_value=portfolio_value)
   ⑤ position_sizes = self.calculate_position_sizes(picks, portfolio_value)
   ⑥ concentration = self.analyze_concentration_risk(picks)
   ⑦ budget = self.check_risk_budget(picks, portfolio_value)

2. 알림 분류:
   CRITICAL (즉시 행동 필요):
   - stop-loss BREACHED인 종목
   - 리스크 예산 EXCEEDED
   - verdict가 STOP인데 보유 종목이 있으면

   WARNING (주의 관찰):
   - stop-loss WARNING인 종목 (임계값 근접)
   - 리스크 예산 WARNING
   - 섹터 집중도 초과
   - 고상관 노출 3쌍 이상 종목

   INFO (참고 사항):
   - 현재 regime + verdict 상태
   - 포지션 사이즈 권고
   - VaR 수치 요약

3. 각 알림 형식:
   level: "CRITICAL" | "WARNING" | "INFO"
   category: "stop_loss" | "risk_budget" | "concentration" | "correlation" | "regime" | "position"
   ticker: 해당 종목 (포트폴리오 레벨이면 "PORTFOLIO")
   message: 사람이 읽을 수 있는 설명
   value: 현재 값
   threshold: 기준값
   action: 권고 행동 ("SELL", "REDUCE", "HOLD", "MONITOR")
   timestamp: ISO 8601

4. 출력 JSON 구조 (output/risk_alerts.json):
   {
     "generated_at": "2026-04-16 07:30:00",
     "regime": "neutral",
     "verdict": "CAUTION",
     "portfolio_summary": {
       "total_value": 100000,
       "invested_pct": 43.0,
       "cash_pct": 57.0,
       "total_var_dollar": 3200,
       "risk_budget_status": "OK"
     },
     "alerts": [...],
     "position_sizes": [...],
     "stop_loss_status": [...],
     "drawdowns": {...},
     "concentration": {...}
   }

5. frontend/public/data/risk_alerts.json 으로도 복사 (대시보드 연동)

6. 로그에 요약 출력:
   "리스크 알림: CRITICAL 2건, WARNING 3건, INFO 5건"
```

### 프롬프트 #10 — 텔레그램 메시지 포맷 (신규)

```
RiskAlertSystem에 format_telegram_message() 메서드를 추가해 줘.

generate_alerts() 결과를 텔레그램으로 보내기 좋은 간결한 텍스트로 변환한다.
(실제 전송은 호출자가 처리 — 여기서는 포맷만)

요구사항:
1. 헤더:
   "[RISK ALERT] YYYY-MM-DD"
   "Regime: {regime} | Verdict: {verdict}"
   빈 줄

2. CRITICAL 섹션 (있을 때만):
   "CRITICAL ({n}건):"
   "- {ticker}: {from_entry_pct}% (stop: {threshold}%) -> {action}"
   ...

3. WARNING 섹션 (있을 때만):
   "WARNING ({n}건):"
   "- {message}"
   ...

4. 포지션 요약 (한 줄):
   "포지션: {ticker1} {pct}% | {ticker2} {pct}% | ... | 현금 {cash_pct}%"

5. VaR 한 줄:
   "VaR(5일): ${var_dollar:,.0f} ({budget_status})"

6. 알림이 하나도 없으면:
   "All Clear — 리스크 항목 없음"

7. 최대 길이: 텔레그램 메시지 4096자 제한 준수
   - 초과 시 CRITICAL + WARNING만 남기고 나머지 생략
   - 마지막에 "(상세: risk_alerts.json 참조)" 추가

8. 반환: str (포맷된 메시지 전문)
```

---

## 6-7 실습 — 파이프라인 통합

### 프롬프트 #11 — run_integrated_analysis.py Phase 4 추가

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
1. Phase 3 이후 실행:
   from us_market.risk_alert import RiskAlertSystem

   risk = RiskAlertSystem(data_dir=str(Path(__file__).parent.parent))
   risk_result = risk.generate_alerts(portfolio_value=args.portfolio_value)

2. --portfolio-value CLI 인자 추가:
   parser.add_argument("--portfolio-value", type=float, default=100000,
                        help="포트폴리오 총 가치 (기본: $100,000)")

3. risk_result 요약을 daily_report JSON에 추가:
   report["risk_alerts_summary"] = {
     "critical_count": ...,
     "warning_count": ...,
     "info_count": ...,
     "risk_budget_status": ...,
     "invested_pct": ...,
     "cash_pct": ...
   }

4. 콘솔 출력에 리스크 요약 추가:
   ━━━ Phase 4: Risk Alert ━━━
   Regime: neutral | Verdict: CAUTION
   CRITICAL: 2건 | WARNING: 3건
   투자 비중: 43% | 현금: 57%
   VaR(5일): $3,200 (OK)

5. 텔레그램 메시지 생성 (전송은 별도):
   msg = risk.format_telegram_message()
   # 필요 시 여기서 텔레그램 봇 API 호출 가능
```

---

## 6-8 실습 — 대시보드 + 테스트

### 프롬프트 #12 — 프론트엔드 타입 추가

```
frontend/src/lib/data.ts에 리스크 알림 관련 TypeScript 타입을 추가해 줘.

요구사항:
1. RiskAlert 인터페이스:
   interface RiskAlert {
     level: "CRITICAL" | "WARNING" | "INFO";
     category: string;
     ticker: string;
     message: string;
     value: number;
     threshold: number;
     action: string;
     timestamp: string;
   }

2. PositionSize 인터페이스:
   interface PositionSize {
     ticker: string;
     company_name: string;
     grade: string;
     base_pct: number;
     final_pct: number;
     dollar_amount: number;
   }

3. RiskAlertData 인터페이스:
   interface RiskAlertData {
     generated_at: string;
     regime: string;
     verdict: string;
     portfolio_summary: {
       total_value: number;
       invested_pct: number;
       cash_pct: number;
       total_var_dollar: number;
       risk_budget_status: string;
     };
     alerts: RiskAlert[];
     position_sizes: PositionSize[];
   }

4. riskLevelColor() 헬퍼 함수:
   CRITICAL → "text-red-500"
   WARNING → "text-amber-500"
   INFO → "text-blue-500"

5. loadRiskAlerts() 함수: /data/risk_alerts.json fetch
```

### 프롬프트 #13 — 테스트 작성

```
tests/test_risk_alert.py를 작성해 줘.

요구사항:
1. test_load_regime_config_adaptive_params:
   - regime_config.json을 임시 파일로 생성
   - stop_loss가 regime에 맞게 파싱되는지 확인
   - 예: neutral → -0.08

2. test_position_sizing_verdict_stop:
   - verdict="STOP"일 때 모든 포지션이 0%인지 확인
   - cash_pct가 100%인지 확인

3. test_position_sizing_caution_cap:
   - verdict="CAUTION"일 때 총 투자 비중이 50% 이하인지 확인

4. test_trailing_stop_breached:
   - entry=100, peak=120, current=112인 종목
   - trailing_threshold=-4%일 때 from_peak_pct=-6.67% → BREACHED

5. test_fixed_stop_warning:
   - entry=100, current=93인 종목
   - threshold=-8%일 때 from_entry_pct=-7% → WARNING (2% 이내)

6. test_risk_budget_exceeded:
   - VaR이 5% 초과할 때 budget_status="EXCEEDED"

7. test_concentration_crisis_threshold:
   - crisis 체제에서 상관관계 임계값이 0.70인지 확인

8. test_telegram_format_length:
   - 출력 문자열이 4096자 이하인지 확인

9. test_generate_alerts_output_structure:
   - generate_alerts() 결과에 필수 키(alerts, position_sizes, portfolio_summary) 존재

10. yfinance는 monkeypatch로 mock:
    - 가격 데이터: pd.DataFrame으로 고정 값 반환
    - Ticker.info: {"sector": "Technology"} 고정 반환
```
