#!/usr/bin/env bash
# US Stock 주간 개선 사이클 실행 스크립트
# 매주 토요일 07:00 launchd(com.us-stock.improve)에 의해 자동 실행.
# 4개 검증 에이전트를 병렬로 실행하고, improvement-lead가 결과를 통합한다.
set -euo pipefail

REPO="/Users/frindle/workspace/synology/us-stock"
DATE=$(date +%Y-%m-%d)
OUTPUT="$REPO/docs/improvement"
LOG="$REPO/logs/improvement_${DATE}.log"

mkdir -p "$OUTPUT" "$REPO/logs"
cd "$REPO"

# .env 로드 (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
[[ -f .env ]] && set -a && source .env && set +a

# 시스템 수면 방지
/usr/bin/caffeinate -i -w $$ &

# ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

notify() {
  osascript -e "display notification \"$1\" with title \"US Stock 개선\" subtitle \"${2:-}\" sound name \"${3:-Default}\"" 2>/dev/null || true
}

telegram_notify() {
  local text="$1"
  [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]] && return 0
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" \
    -d "parse_mode=HTML" > /dev/null 2>&1 || true
}

# 에이전트 파일에서 frontmatter를 제거하고 시스템 프롬프트만 추출
extract_sp() {
  awk 'BEGIN{n=0} /^---$/{n++; if(n==2){p=1; next}} p{print}' "$1"
}

on_error() {
  local code=$?
  notify "개선 사이클 실패 (exit ${code})" "오류 ❌" "Basso"
  telegram_notify "❌ US Stock 주간 개선 사이클 실패 (exit ${code}) — ${DATE}"
  exit "$code"
}
trap on_error ERR

# ─── 시작 ────────────────────────────────────────────────────────────────────

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === 주간 개선 사이클 시작 ==="

  notify "주간 개선 사이클 시작" "${DATE}" "Ping"
  telegram_notify "🔍 US Stock 주간 개선 사이클 시작 — ${DATE}"

  # 네트워크 확인
  if ! curl -s --max-time 5 https://www.google.com -o /dev/null; then
    echo "[$(date '+%H:%M:%S')] 네트워크 없음 — 중단"
    telegram_notify "🔌 US Stock 개선 사이클 — 네트워크 없음으로 중단 (${DATE})"
    exit 1
  fi

  # ─── Step 1: 4개 검증 에이전트 병렬 실행 ──────────────────────────────────
  echo "[$(date '+%H:%M:%S')] Step 1: 4개 검증 에이전트 병렬 실행 시작..."

  SYSTEM_CHECK="$OUTPUT/${DATE}_system_check.md"
  MODEL_CHECK="$OUTPUT/${DATE}_model_check.md"
  TRENDS="$OUTPUT/${DATE}_trends.md"
  STRATEGY_CHECK="$OUTPUT/${DATE}_strategy_check.md"

  # system-validator
  (
    echo "[$(date '+%H:%M:%S')] [system-validator] 시작"
    claude \
      --system-prompt "$(extract_sp "$REPO/.claude/agents/improvement/system-validator.md")" \
      --model claude-sonnet-4-6 \
      --print \
      "날짜: ${DATE}. 시스템 검증을 수행하고 결과를 마크다운 형식으로만 출력해줘." \
      > "$SYSTEM_CHECK" 2>&1
    echo "[$(date '+%H:%M:%S')] [system-validator] 완료 → $SYSTEM_CHECK"
  ) &
  PID_SYSTEM=$!

  # model-validator
  (
    echo "[$(date '+%H:%M:%S')] [model-validator] 시작"
    claude \
      --system-prompt "$(extract_sp "$REPO/.claude/agents/improvement/model-validator.md")" \
      --model claude-sonnet-4-6 \
      --print \
      "날짜: ${DATE}. 모델 성능 검증을 수행하고 결과를 마크다운 형식으로만 출력해줘." \
      > "$MODEL_CHECK" 2>&1
    echo "[$(date '+%H:%M:%S')] [model-validator] 완료 → $MODEL_CHECK"
  ) &
  PID_MODEL=$!

  # trend-researcher (WebSearch 사용 → opus 모델)
  (
    echo "[$(date '+%H:%M:%S')] [trend-researcher] 시작 (WebSearch 3회)"
    claude \
      --system-prompt "$(extract_sp "$REPO/.claude/agents/improvement/trend-researcher.md")" \
      --model claude-opus-4-7 \
      --print \
      "날짜: ${DATE}. 최신 퀀트 트렌드를 WebSearch로 연구하고 3개 구체 후보를 마크다운으로만 출력해줘." \
      > "$TRENDS" 2>&1
    echo "[$(date '+%H:%M:%S')] [trend-researcher] 완료 → $TRENDS"
  ) &
  PID_TREND=$!

  # strategy-validator
  (
    echo "[$(date '+%H:%M:%S')] [strategy-validator] 시작"
    claude \
      --system-prompt "$(extract_sp "$REPO/.claude/agents/improvement/strategy-validator.md")" \
      --model claude-sonnet-4-6 \
      --print \
      "날짜: ${DATE}. 전략 유효성을 검증하고 결과를 마크다운 형식으로만 출력해줘." \
      > "$STRATEGY_CHECK" 2>&1
    echo "[$(date '+%H:%M:%S')] [strategy-validator] 완료 → $STRATEGY_CHECK"
  ) &
  PID_STRATEGY=$!

  # 모든 워커 완료 대기
  wait $PID_SYSTEM $PID_MODEL $PID_TREND $PID_STRATEGY
  echo "[$(date '+%H:%M:%S')] Step 1 완료 — 4개 검증 완료"

  # ─── Step 2: 파일 존재 확인 ────────────────────────────────────────────────
  for f in "$SYSTEM_CHECK" "$MODEL_CHECK" "$TRENDS" "$STRATEGY_CHECK"; do
    if [[ ! -s "$f" ]]; then
      echo "[$(date '+%H:%M:%S')] 경고: $f 이 비어있음"
      echo "# 검증 실패\n\n에이전트 실행 중 오류 발생" > "$f"
    fi
  done

  # ─── Step 3: improvement-lead 통합 분석 ────────────────────────────────────
  echo "[$(date '+%H:%M:%S')] Step 2: improvement-lead 통합 분석 시작..."

  SYSTEM_CONTENT=$(cat "$SYSTEM_CHECK")
  MODEL_CONTENT=$(cat "$MODEL_CHECK")
  TREND_CONTENT=$(cat "$TRENDS")
  STRATEGY_CONTENT=$(cat "$STRATEGY_CHECK")

  LEAD_PROMPT="날짜: ${DATE}.

4개 검증 에이전트의 결과가 아래에 있습니다. 이것을 통합하여:
1. 상위 3개 개선 항목(P0/P1/P2)을 선정하고
2. docs/improvement/${DATE}_improvement_report.md를 생성하고
3. 텔레그램 알림을 발송해줘.

---
## 시스템 검증 결과
${SYSTEM_CONTENT}

---
## 모델 검증 결과
${MODEL_CONTENT}

---
## 트렌드 연구 결과
${TREND_CONTENT}

---
## 전략 검증 결과
${STRATEGY_CONTENT}"

  claude \
    --system-prompt "$(extract_sp "$REPO/.claude/agents/improvement/improvement-lead.md")" \
    --model claude-opus-4-7 \
    --print \
    "$LEAD_PROMPT" \
    > "$OUTPUT/${DATE}_lead_output.md" 2>&1

  echo "[$(date '+%H:%M:%S')] Step 2 완료 — 통합 분석 완료"

  # ─── Step 4: 완료 알림 ─────────────────────────────────────────────────────
  REPORT="$OUTPUT/${DATE}_improvement_report.md"
  if [[ -f "$REPORT" ]]; then
    REPORT_SIZE=$(wc -l < "$REPORT")
    echo "[$(date '+%H:%M:%S')] 리포트 생성 완료: $REPORT (${REPORT_SIZE}줄)"
  else
    echo "[$(date '+%H:%M:%S')] 경고: 리포트 파일이 생성되지 않음 — lead_output.md 확인 필요"
    # lead_output을 리포트로 대체
    cp "$OUTPUT/${DATE}_lead_output.md" "$REPORT" 2>/dev/null || true
  fi

  notify "주간 개선 사이클 완료" "$(date +%H:%M) ✅" "Glass"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === 주간 개선 사이클 완료 ==="

} 2>&1 | tee "$LOG"
