# US Stock 일일 진화 사이클 — Claude Code Plan 모드 프롬프트

## 사용법

```bash
# Claude Code에서 Plan 모드로 실행
cd /Users/frindle/workspace/education/us-stock
claude  # Claude Code 실행 후 아래 프롬프트 입력
```

---

## 프롬프트 1: 일일 건강 점검 + 진화 (기본)

```
@lead 일일 진화 사이클을 실행해줘.

Phase 1 — 건강 점검:
1. @qa 에게 파이프라인 실행 및 건강 점검을 위임해. 
   - run_full_pipeline.py 실행
   - data_quality_report.py로 품질 점검
   - Level 1~3 검증 수행
   - .docs/daily/YYYY-MM-DD_health_check.md 작성

Phase 2 — 이슈 분석:
2. Phase 1 리포트에서 이슈를 추출하고 분류해 (Critical/Improvement/Enhancement).
3. docs/notes/backlog.md 업데이트.

Phase 3 — 개선 실행:
4. 이슈 유형에 따라 적절한 에이전트에 위임:
   - 데이터 이슈 → @data-engineer
   - 분석 로직 이슈 → @quant-analyst
   - AI 품질 이슈 → @ai-strategist
   - 대시보드 이슈 → @dashboard-dev
   - 구조적 이슈 → @architect
5. 하루 최대 3개 개선에 집중.

Phase 4 — 검증 + 기록:
6. @qa 에게 변경사항 검증 위임.
7. .docs/daily/YYYY-MM-DD_evolution_log.md 작성.

워크플로우 패턴: 파이프라인(순차)
실행 방식: 자동 판단 (Team 또는 tmux)
```

---

## 프롬프트 2: 퀀트 분석 집중

```
@lead 퀀트 분석 집중 사이클을 실행해줘.

1. @quant-analyst 에게 다음을 수행하도록 위임:
   - 어제 시장 체제 판정 vs 실제 시장 움직임(SPY 등락) 비교 분석
   - 5개 센서 각각의 신호 정확도 평가
   - Top 10 종목의 팩터별 점수 분포 분석
   - 개선 제안 (새 팩터, 가중치 조정, 파라미터 튜닝)
   - .docs/quant/YYYY-MM-DD_analysis.md 작성

2. 개선 제안 중 구현 가능한 것이 있으면:
   - @quant-analyst 가 코드 변경 실행
   - @qa 가 변경사항 검증
   - 파이프라인 재실행으로 효과 확인

패턴: Hub-and-Spoke (lead 중심)
```

---

## 프롬프트 3: AI 분석 품질 개선

```
@lead AI 분석 품질 개선 사이클을 실행해줘.

1. @ai-strategist 에게 다음을 수행하도록 위임:
   - output/ai_summaries.json 전수 리뷰
   - JSON 파싱 성공률, bear_cases 충족률, 할루시네이션 탐지
   - 프롬프트 개선 제안 (_build_prompt 최적화)
   - 프로바이더별 품질 비교 (가능하면 2개 프로바이더로 같은 종목 분석)
   - .docs/ai/YYYY-MM-DD_quality_report.md 작성

2. 프롬프트 개선이 있으면:
   - @ai-strategist 가 _build_prompt() 수정
   - 1~2개 종목으로 A/B 테스트
   - @qa 가 결과 비교 검증

패턴: 파이프라인 (분석 → 개선 → 검증)
```

---

## 프롬프트 4: 데이터 파이프라인 강화

```
@lead 데이터 파이프라인 강화 사이클을 실행해줘.

1. @data-engineer 에게 다음을 수행하도록 위임:
   - 전체 수집기 상태 점검 (API 응답, 차단 여부, 결측치)
   - 수집 실패 패턴 분석 (어떤 종목이, 어떤 이유로, 얼마나 자주)
   - 개선 구현 (retry 강화, 새 fallback, 병렬화 등)
   - .docs/daily/YYYY-MM-DD_data_report.md 작성

2. 변경사항이 있으면:
   - @qa 가 Level 1~2 검증
   - 파이프라인 재실행으로 개선 효과 확인

패턴: 단일 에이전트 집중 → QA 검증
```

---

## 프롬프트 5: 대시보드 진화

```
@lead 대시보드 진화 사이클을 실행해줘.

1. @dashboard-dev 에게 다음을 수행하도록 위임:
   - 현재 대시보드 렌더링 검증 (JSON 로드, 섹션 표시)
   - 우선 개선 항목 1개 선정 및 구현:
     후보: 섹터 히트맵 / 체제 히스토리 / 팩터 레이더 / 종목 비교 / 날짜 선택기
   - 반응형, 접근성 확인

2. @qa 가 대시보드 검증:
   - 데이터 표시 정확성
   - 콘솔 에러 없음
   - 모바일 반응형

패턴: 단일 에이전트 집중 → QA 검증
```

---

## 프롬프트 6: 아키텍처 리뷰

```
@lead 아키텍처 리뷰를 실행해줘.

@architect 에게 다음을 수행하도록 위임:
1. 전체 모듈 구조 리뷰 (의존성 방향, 순환 참조, 책임 분리)
2. 데이터 흐름 검증 (단계 간 계약, 스키마 일치)
3. 기술부채 식별 (코드 중복, 미사용 코드, TODO 목록)
4. 성능 병목 분석 (수집 시간, AI 호출 시간)
5. 확장성 평가 (2000종목으로 확장 시 어디가 깨지는지)
6. ADR 작성 (주요 개선 건)
7. .docs/architecture/YYYY-MM-DD_review.md 작성

패턴: 단일 에이전트 (읽기 전용)
```

---

## 프롬프트 7: 신규 기능 개발 (피처)

```
@lead 새 기능을 개발해줘: [기능 설명]

예시:
- "포트폴리오 백테스트 모듈을 추가해줘"
- "텔레그램 알림 기능을 추가해줘"
- "DuckDB 기반 로컬 데이터 저장소를 구현해줘"
- "섹터 로테이션 전략 모듈을 추가해줘"

팀 구성 자동 판단:
- 기획 필요 시: lead가 요건 정의 → 관련 에이전트 배정
- 구현만 필요 시: 직접 관련 에이전트 위임
- 크로스 영역: 병렬 또는 순차 파이프라인

Phase 구조:
Phase 1: 요건 분석 + 설계 (lead + architect)
Phase 2: 구현 (관련 에이전트)
Phase 3: 테스트 (qa)
Phase 4: 통합 + 문서화 (lead)
```

---

## 프롬프트 8: 긴급 대응 (Hotfix)

```
@lead 긴급 이슈를 해결해줘: [이슈 설명]

예시:
- "yfinance가 차단되어 데이터 수집이 안 됨"
- "Gemini API가 429 에러를 반환함"
- "Top 10에 동일 섹터 종목만 나옴"
- "대시보드 JSON 로드 실패"

긴급 대응 프로토콜:
1. 이슈 재현 및 원인 분석 (관련 에이전트)
2. 임시 조치 (workaround)
3. 근본 해결
4. @qa 검증
5. .docs/daily/YYYY-MM-DD_hotfix.md 기록
```

---

## 주간 루틴 제안

| 요일 | 프롬프트 | 중점 |
|------|---------|------|
| 월 | #1 일일 진화 | 주간 시작, 전체 점검 |
| 화 | #2 퀀트 집중 | 분석 로직 개선 |
| 수 | #3 AI 품질 | 프롬프트 튜닝 |
| 목 | #4 데이터 강화 | 수집 안정성 |
| 금 | #6 아키텍처 | 주간 구조 리뷰 |
| 토 | #5 대시보드 | UX 개선 |
| 일 | #7 신규 기능 | 새 피처 개발 |
