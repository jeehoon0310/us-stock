이제 충분한 데이터가 수집되었습니다. 최종 리포트를 작성합니다.

---

# 2026-04-25 시스템 검증

## 종합 상태: 🟡 주의

---

## 파이프라인 실행 이력

- **최근 실행:** 2026-04-24 06:35 (목요일)
- **실행 시간:** 34분 49초 (06:35:10 → 07:09:59)
- **최근 7일 실행 횟수:** 5회 (04/20·21·22·23·24) — 평일 4회 + 일요일 1회
- **오늘(04/25 금) 실행:** 미실행 (아직 미완료 또는 누락 가능)
- **에러:** OperationalError('unable to open database file') — TER, GLW, MRK, CVNA, ALL 외 다수 (총 53건), SQLite risk_alert 쓰기 실패 (`No module named 'src'`)

---

## 출력 파일 최신성

| 파일 | 최신 날짜 | 상태 |
|------|---------|------|
| data.db | 2026-04-24 07:09 | 🟢 정상 (1일 전) |
| latest_report.json | 2026-04-24 07:09 | 🟢 정상 (1일 전) |
| final_top10_report.json | 2026-04-24 07:09 | 🟢 정상 (1일 전) |
| regime_result.json | 2026-04-12 14:33 | 🟡 주의 (13일 전 미갱신) |
| smart_money_picks_*.csv (최신) | 2026-04-12 | 🟡 주의 (13일 전 미갱신) |

> **regime_result.json 내용:** regime=neutral, weighted_score=0.81, confidence=40.0% (04/12 기준)

---

## 데이터 품질

- **품질 리포트:** 실행 결과 없음 (출력 0줄 — data_quality_report.py 실행 이상 가능성)
- **문제 파일:** 측정 불가

---

## 패키지 상태

- **업데이트 필요:** 0개
- yfinance, pandas, numpy, lightgbm, anthropic, google 계열 모두 최신 상태 ✅

---

## API 비용 (최근 실행)

- **ai_summaries.json metadata:** 비어있음 (비용 추적 데이터 없음)
- Gemini / OpenAI / Perplexity: 측정 불가
- **합계:** N/A

---

## 디스크 사용

| 디렉토리 | 사용량 |
|---------|--------|
| output/ | 16 MB |
| data/ | 13 MB |
| logs/ | 4.8 MB |

100MB 초과 파일: 없음 ✅

---

## 이슈 목록

| 번호 | 심각도 | 이슈 | 권고 |
|------|--------|------|------|
| 1 | 🟡 Warning | **SQLite OperationalError** — TER·GLW·MRK·CVNA·ALL 외 다수 종목에서 'unable to open database file' (총 53건, 04/24 실행 중 발생) | `output/data.db` 경로 및 파일 잠금 상태 점검. 동시 쓰기 충돌 가능성 확인 |
| 2 | 🟡 Warning | **regime_result.json 13일 미갱신** — 2026-04-12 이후 파이프라인이 5회 실행됐음에도 갱신 없음 | `market_regime.py` 호출 여부 확인. 파이프라인 Phase 1 실행 경로 점검 |
| 3 | 🟡 Warning | **smart_money_picks CSV 13일 미갱신** — 최신 파일이 20260412.csv. Phase 2 (스크리닝) 결과가 picks/에 저장되지 않는 중 | `run_screening.py` 또는 Phase 2 save 경로 확인 |
| 4 | 🟡 Warning | **실행 시간 34분 49초** — 30분 초과 기준 초과 | Phase 2 스크리닝(503종목) 병렬화 또는 증분 처리 고려 |
| 5 | 🟡 Warning | **SQLite risk_alert 쓰기 실패** — `No module named 'src'` (sys.path 문제) | `run_full_pipeline.py` 실행 컨텍스트에서 sys.path에 src/ 미포함. import 경로 수정 필요 |
| 6 | 🔵 Info | **data_quality_report.py 출력 없음** — 실행 완료 후 결과 0줄 | 스크립트 내 출력 구조 변경 여부 확인 |
| 7 | 🔵 Info | **API 비용 추적 데이터 없음** — ai_summaries.json metadata 비어있음 | APIUsageTracker 결과가 metadata에 저장되지 않는 중, 추적 코드 점검 |
| 8 | 🔵 Info | **mpva_launchd.err.log** — www.mpva.go.kr DNS 해석 실패 (새벽 시간대, 이후 06:07에 정상 복구됨) | 외부 서비스 일시 불안정, US Stock 파이프라인과 무관 |
| 9 | 🔵 Info | **overnight_news.err.log** — CNBC·Reuters RSS fetch 실패 (04:57 새벽 네트워크 일시 이슈) | 외부 RSS 서버 접근 불가, 이후 정상. 재시도 로직 동작 확인됨 |
| 10 | 🔵 Info | **오늘(04/25 금) 파이프라인 미실행** — 현재 시각까지 daily_run_20260425.log 없음 | 07:00 launchd 스케줄 확인. 금요일 장 마감 후 생성 예정이면 정상 |
