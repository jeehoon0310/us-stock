# Improvement Cycle Memory (Reflexion)

> 매주 토요일 07:00 launchd 자동 실행 누적 학습 로그.
> 신규 항목은 파일 하단에 append.

---

## 2026-04-25
- **P0**: picks 생성 파이프라인 복구 — 15일 정체 해소, daily Action 추천 복구 기대
- **P1 연기**: 13F + Volume 팩터 복구 — P0 안정화 후 가중치 재배분 검토
- **P2 연기**: PCR 센서 추가 — P0/P1 완료 후 체제 신뢰도 +10%p 개선 시도
- **학습**: "파이프라인이 매일 실행된다 ≠ 데이터가 매일 갱신된다" — daily_run_*.log mtime이 아니라 picks row count + content hash로 헬스체크해야 사일런트 실패를 잡을 수 있음. SQLite OperationalError와 sys.path 누락이 동시 발생 시 Phase 2/3 출력이 통째로 사라지는 패턴 확인.
