# 2026-04-25 주간 개선 사이클 리포트

## 종합 대시보드

| 영역 | 상태 | 핵심 이슈 |
|------|------|---------|
| 🔧 시스템 | 🟡 Warning | SQLite OperationalError 53건 + sys.path 오류로 risk_alert 쓰기 실패, 실행 시간 34분 |
| 🤖 모델 | 🔴 Critical | picks 파일 15일 미갱신, final_top10_report top_stocks 0개, GBM 미학습 (rule-based 전용) |
| 📡 트렌드 | 3개 발굴 | PCR 센서(≤2h, B), IVOL 팩터(≤2h, A), Alpha Decay Monitor(≤4h, C) |
| 📊 전략 | 🟡 약화 | Grade A 비율 0%(3회 연속), 13F 전종목 고정값 50, picks 13일 공백 |

---

## 이번 주 개선 항목

### 🔴 P0: picks 생성 파이프라인 복구 — 이번 주 즉시 실행

**출처**: system-validator + model-validator + strategy-validator (3개 워커 일치)

**근거** (정량):
- 최신 picks CSV: `smart_money_picks_20260412.csv` (오늘 -13일)
- `final_top10_report.json.top_stocks`: **0개** (빈 배열)
- 04/20·21·22·23·24 평일 5회 파이프라인 실행에도 picks/ 디렉토리 갱신 없음
- `regime_result.json` 또한 04/12 이후 미갱신 — Phase 1·2 전체 사일런트 실패 가능성
- 로그 증거: `OperationalError('unable to open database file')` 53건 + `No module named 'src'` (risk_alert)

**위임**: `@system-lead`

**예상 효과**:
- picks 생성 정상화 → daily 의사결정 데이터 복구 (현재 Action 추천 무효 상태)
- SQLite 경로/권한 정합성 확보 → 53건 에러 0건
- sys.path 수정 → risk_alert SQLite 정상 기록

**위임 프롬프트**:
```
@system-lead — 2026-04-25 P0 긴급 진단 작업

[증상 요약]
1. output/picks/ 최신 파일이 smart_money_picks_20260412.csv (15일 전).
   매일 launchd가 06:35에 실행되고 daily_run_*.log는 매일 생성되나
   picks 파일과 regime_result.json은 04/12 이후 미갱신.
2. logs/daily_run_20260424.log에서 'OperationalError: unable to open database file' 53건 + 'No module named src' (risk_alert SQLite 쓰기 실패) 확인.
3. final_top10_report.json.top_stocks 빈 배열 — 다운스트림 출력도 이미 무효.

[조사 대상 파일]
- scripts/run_full_pipeline.py — Phase 2 (스크리닝) save 경로
- scripts/run_screening.py — output/picks/ 저장 로직
- src/analyzers/smart_money_screener_v2.py — DataFrame.to_csv 호출부
- src/analyzers/market_regime.py — regime_result.json save
- output/data.db 경로/권한 (write 가능 여부)

[작업 요청]
1. 위 5개 파일 trace로 'picks 저장이 실제로 호출되는지' 정적 검증
2. logs/daily_run_20260424.log 에러 컨텍스트 추출 — SQLite 에러 발생 라인의 호출 스택 식별
3. sys.path 누락 원인 파악 (run_full_pipeline.py 실행 컨텍스트에서 src/ 미포함)
4. P0 수정안 제안 후 system-optimizer에 구현 위임 (직접 수정 가능 시 즉시)
5. 수정 후 scripts/run_integrated_analysis.py 1회 수동 재실행하여 picks 갱신 확인

[검증 기준]
- output/picks/smart_money_picks_20260425.csv 생성됨
- final_top10_report.json.top_stocks 길이 ≥ 10
- logs/daily_run_20260425.log 에 OperationalError 0건
- regime_result.json mtime = 오늘
```

---

### 🟡 P1: 13F + Volume 팩터 살리기 — 다음 주 검토

**출처**: model-validator + strategy-validator

**근거** (정량):
- 13F Holdings (가중치 10%): **전종목 고정값 50** — 팩터 기여도 사실상 0
- Volume (가중치 15%): 2026-04-22 사이클에서 stdev 10.78로 일부 개선됐으나 기본값 50 잔존
- composite_score 분산 3.6점 (66.6~70.2) → Grade A 0개 → BUY 추천 0개
- **죽은 가중치 25%**가 변별력 저하의 직접 원인

**위임**: `@signal-optimizer` (rule-based 팩터 코드)

**예상 효과**:
- 13F 정상화 시 점수 분산 +3~5점 (composite_score range 확장)
- Grade A 1~3개 회복 → daily BUY 추천 재활성화
- Volume 정상화 시 거래량 비정상 종목 식별력 +0.05 IC

**위임 프롬프트**:
```
@signal-optimizer — P1 작업: 죽은 팩터 25% 복구

[현황]
- src/analyzers/smart_money_screener_v2.py 의 _calculate_composite_score()에서
  13F (10%), Volume (15%) 두 팩터가 모두 데이터 결측 시 기본값 50으로 fallback 중.
- 결과: 503종목 모두 동일 점수 → 가중치 25%가 무력화.

[분석 요청]
1. data/us_volume_analysis.csv 최신 mtime + null 비율 측정
2. 13F 데이터 소스 확인 — 현재 어떤 fetcher가 13F를 수집하는지 식별
   (look-ahead bias 필터 filing_date <= yesterday가 너무 공격적이지 않은지 검토)
3. fallback을 50(중립) → null 처리 + cross-sectional rank로 변경 시 효과 시뮬레이션

[구현 옵션]
A. 13F 데이터 소스 미연동 시 → 가중치 0으로 임시 변경, Technical 25→30 / RS 15→20 재배분
B. SEC EDGAR 무료 API 연동 (P2로 분리, 별도 작업)
C. fallback 값을 cross-sectional median으로 대체 (rank 영향 0이지만 점수 보존)

[검증 기준]
- composite_score 분산 ≥ 8점 (현재 3.6)
- Grade A 종목 ≥ 1개 출현
- 변경 전/후 5D forward return 차이 측정 (look-ahead 없는 backtest)
```

---

### 🔵 P2: PCR 센서 추가 (체제 감지 6번째 센서) — 월간 검토

**출처**: trend-researcher (후보 B, 우선순위 1위)

**근거** (정량):
- 현재 체제 신뢰도 40% (Breadth risk_off vs Trend/YieldCurve risk_on 충돌)
- 5개 센서가 모두 "표면 가격 신호" — 옵션 시장 비대칭 헤지 비용은 미반영
- CBOE Equity PCR(`^CPCE`) yfinance 무료, 5일 EMA + 20일 z-score
- 학술 근거: 2018-12, 2022-01 변곡점에서 lead 5~15 거래일

**위임**: `@signal-optimizer` (P0/P1 완료 후)

**예상 효과**:
- 체제 전환 감지 정확도 +3~7%p (특히 강세장 후반 risk_off 조기 감지)
- 신뢰도 40% → 50%+ 회복 (직교 정보원 추가)
- 가중치 재배분: VIX 30→27, Trend 25→23, Breadth 18→16, Credit 15→14, YieldCurve 12→10, **PCR 10**

**위임 프롬프트**:
```
@signal-optimizer — P2 작업: market_regime.py에 PCR 센서 추가

[참조]
- docs/improvement/2026-04-25_trends.md 후보 B 전체 코드 스켈레톤 포함
- ^CPCE yfinance 데이터 검증 먼저 수행 (실패 시 CBOE CSV fallback 필요)

[구현 단계]
1. ^CPCE 6mo 다운로드 검증 (curl_cffi session 재사용)
2. _compute_pcr_signal() 메서드 추가 — z-score 0(risk_on) ~ 3(crisis) 매핑
3. 가중치 6분할 재정규화
4. 백테스트: 2018-12, 2020-03, 2022-01 변곡점 lead 일수 측정

[검증 기준]
- regime_result.json에 'pcr' 키 존재 + ema5/z20 메타 포함
- 가중치 합 = 1.0 (정규화 검증)
- look-ahead 방지: pcr.iloc[:-1] 슬라이싱 의무
- 체제 신뢰도 측정값이 5%p 이상 변동
```

---

## 검증별 요약

### 🔧 시스템 검증
- 평일 5회 실행되나 SQLite OperationalError 53건 + risk_alert sys.path 실패
- 실행 시간 34분 (30분 임계 초과) → Phase 2 503종목 병렬화 후보
- 패키지·디스크는 정상, ai_summaries.json metadata 비용 추적 누락

### 🤖 모델 검증
- picks 15일 정체 + GBM 미학습 = 데이터 가치 사실상 0
- 체제 신뢰도 40%, Breadth(risk_off) vs Trend/YieldCurve(risk_on) 신호 충돌
- volume_score / 13f_score 둘 다 기본값 50 — 25% 가중치 사망

### 📡 트렌드 연구
- 우선순위 B(PCR) > A(IVOL) > C(Alpha Decay Monitor)
- B/A 모두 ≤2h 구현, yfinance만으로 충분
- IVOL은 50년 학술 검증, PCR은 즉시 효과 + 직교성 명확

### 📊 전략 검증
- 체제·verdict·action 매핑은 정합 (CAUTION + B → WATCH 적절)
- Grade A 0% (3회 연속), 1D win rate 37% (단기 노이즈 민감)
- picks CSV에 sector 컬럼 누락 → 섹터 집중도 모니터링 불가

---

## Reflexion
- **이번 주 학습**: "파이프라인이 매일 실행된다 ≠ 데이터가 매일 갱신된다" — daily_run_*.log는 매일 생성되지만 Phase 2/3 출력이 13일 미갱신인 사일런트 실패가 발생. 헬스체크는 mtime이 아니라 row count·내용 변화로 검증해야 함.
- **다음 주 포커스**: P0 복구 후 picks/regime_result에 대한 무결성 게이트 추가 (mtime + content hash + non-empty 검증). 죽은 팩터(13F·Volume) 25%를 살려 Grade A를 재활성화.
