# Research Team Reflexion Memory

장기 패턴 학습 기록. 성공/실패 모두 기록, 동일 실수 반복 금지.

---

## 2026-04-16

### 점검 결과 요약
- 승인: Analyst Estimate Revision Momentum (P0), Short-Term Reversal (P1), Earnings Quality/Accruals (P2)
- 기각: 없음 (3개 모두 기준 통과, 단 Accruals는 2003년 이후 약화 모니터링 필요)

### 구조적 버그 발견 (CRITICAL)
- **Volume 팩터 15%가 전 종목 50점 고정** — 데드웨이트. 실질 가중치 손실 25% (Volume 15% + 13F 10%)
- **13F 팩터 10%도 전 종목 50점 고정** — 동일 문제
- 실효 팩터는 4개 (Technical 33.3%, Fundamental 26.7%, Analyst 20.0%, RS 20.0%)
- 원인 추정: smart_money_screener_v2.py에서 Volume/13F 데이터 미수집 시 default=50 fallback 작동 중
- 조치 필요: model-team에 Volume 실계산 로직 및 13F 실데이터 파이프라인 복구 지시

### 팩터 상관관계 경보
- **Fundamental vs RS: -0.830** — 임계치 0.7 초과
- 해석: 고RS 종목(모멘텀 강한 성장주)은 현재 PE/ROE 기준 Fundamental 낮음 → 자연스러운 역상관이나 가중치 충돌 발생
- 권고: Fundamental 가중치 20% → 15%, 해방된 5%는 신규 Accruals 팩터로 배정

### Alpha Decay 현황 (2026-04-10 ~ 2026-04-16)
- 상위 10개 티커 평균 5일 수익률: +3.18% — OK 상태
- 강한 종목: AVGO +11.78%, AMD +9.08%, FDS +8.07%
- 위험 종목: LITE -7.84% (주의 필요), HUBB -1.45%, GLW -0.90%
- LITE는 RS=100점이나 Fundamental=60 저조 → 고RS 고모멘텀 종목의 하락 리스크 재확인

### 학습
- Volume=50 고정 상태가 지속되면 팩터 다양성 실질 저하 → 조기 발견 중요
- 고RS 종목 선발 시 Fundamental 하단 필터(최소 60점 이상) 유지 필요 — LITE 사례 교훈
- Accruals 팩터는 2003년 이후 alpha 약화 문서화됨. 구현 시 2010년 이후 샘플 out-of-sample 검증 필수
