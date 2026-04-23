#!/bin/bash
# us-stock daily pipeline + deploy via SSH pipe to Synology
# Runs on Mac (launchd / weekdays 07:00 KST).
# Data delivered via SSH cat pipe (output/data.db → NAS) — no git commit, no image rebuild required.
set -euo pipefail
cd /Users/frindle/workspace/synology/us-stock

# 실행 중 시스템 수면 방지 (launchd에서 caffeinate 제거 대신 내부 실행)
/usr/bin/caffeinate -i -w $$ &

source .venv/bin/activate

# .env 로드 (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 등)
[[ -f .env ]] && set -a && source .env && set +a

# Synology NAS — SSH key auth (jeehoon@frindle.synology.me:22211)
NAS_SSH_HOST="frindle.synology.me"
NAS_SSH_PORT="${NAS_SSH_PORT:-22211}"
NAS_SSH_USER="${NAS_SSH_USER:-jeehoon}"
NAS_DATA_DB_PATH="/volume1/docker/us-stock/board/data.db"

# --- Mac 알림 헬퍼 ---
notify() {
  local msg="$1" subtitle="${2:-}" sound="${3:-Default}"
  osascript -e "display notification \"${msg}\" with title \"US Stock 📊\" subtitle \"${subtitle}\" sound name \"${sound}\"" 2>/dev/null || true
}

TELEGRAM_QUEUE="output/telegram_queue.txt"
mkdir -p output

# --- 텔레그램 알림 헬퍼 (실패 시 큐 저장) ---
telegram_notify() {
  local text="$1"
  [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]] && return 0
  local ok
  ok=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" \
    -d "parse_mode=HTML" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null || echo "false")
  if [[ "$ok" != "True" ]]; then
    # 네트워크 없음 — base64로 인코딩해서 큐에 저장
    echo "$text" | base64 >> "$TELEGRAM_QUEUE"
  fi
}

# --- 큐에 쌓인 메시지 전송 (네트워크 복구 후) ---
flush_telegram_queue() {
  [[ ! -f "$TELEGRAM_QUEUE" ]] && return 0
  [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]] && return 0
  local tmp="${TELEGRAM_QUEUE}.tmp"
  : > "$tmp"
  while IFS= read -r encoded; do
    [[ -z "$encoded" ]] && continue
    local msg
    msg=$(echo "$encoded" | base64 -d 2>/dev/null) || continue
    local ok
    ok=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${msg}" \
      -d "parse_mode=HTML" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null || echo "false")
    [[ "$ok" != "True" ]] && echo "$encoded" >> "$tmp"
  done < "$TELEGRAM_QUEUE"
  if [[ -s "$tmp" ]]; then
    mv "$tmp" "$TELEGRAM_QUEUE"
  else
    rm -f "$TELEGRAM_QUEUE" "$tmp"
  fi
}

# --- ERR 트랩: 어느 단계든 실패 시 알림 ---
on_error() {
  local exit_code=$?
  notify "오류 발생 (exit ${exit_code}) — 수동 실행 필요" "파이프라인 실패 ❌" "Basso"
  telegram_notify "❌ US Stock 파이프라인 실패 (exit ${exit_code}) — $(date '+%Y-%m-%d %H:%M KST')"
}
trap on_error ERR

# --- 늦은 실행 감지: 06:30 이후 = 맥북이 잠들어 있었음 ---
CURRENT_HOUR=$((10#$(date +%H)))
CURRENT_MIN=$((10#$(date +%M)))
if [ "$CURRENT_HOUR" -gt 6 ] || ([ "$CURRENT_HOUR" -eq 6 ] && [ "$CURRENT_MIN" -gt 50 ]); then
  notify "06:30 이후 실행됨 (현재 $(date +%H:%M)) — 맥북이 잠들어 있었을 수 있음" "늦은 실행 ⚠️" "Ping"
fi

# --- 네트워크 체크 ---
if ! ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
  notify "네트워크 없음 — 수동 실행 필요" "네트워크 오류 ❌" "Basso"
  telegram_notify "🔌 US Stock $(date '+%Y-%m-%d') — 네트워크 없음으로 분석 미실행. 수동 실행 필요"
  exit 1
fi

# --- 큐 flush (이전 실패 메시지 재전송) ---
flush_telegram_queue

LOG="logs/deploy_$(date +%Y%m%d_%H%M%S).log"
mkdir -p logs

{
  echo "[$(date)] === Starting pipeline ==="

  .venv/bin/python3 scripts/run_integrated_analysis.py
  .venv/bin/python3 scripts/regen_dashboard_data.py

  # Verify data.db was written by the pipeline
  if [ ! -f "output/data.db" ]; then
    echo "[$(date)] ERROR: output/data.db not found — SQLite write may have failed"
    exit 1
  fi

  # WAL checkpoint: flush WAL journal into main DB before rsync
  # (prevents rsync from copying an incomplete state)
  echo "[$(date)] === SQLite WAL checkpoint ==="
  .venv/bin/python3 -c "
import sqlite3
conn = sqlite3.connect('output/data.db')
result = conn.execute('PRAGMA wal_checkpoint(FULL)').fetchone()
conn.close()
print(f'WAL checkpoint complete: busy={result[0]}, written={result[1]}, moved={result[2]}')
"

  # SSH pipe data.db to Synology — Next.js reads it live, no image rebuild needed
  # rsync 대신 SSH pipe 사용: Synology sshd가 rsync 프로토콜을 거부함
  echo "[$(date)] === SSH pipe data.db → Synology (${NAS_SSH_USER}@${NAS_SSH_HOST}) ==="
  ssh -p "${NAS_SSH_PORT}" -i /Users/frindle/.ssh/id_rsa \
    "${NAS_SSH_USER}@${NAS_SSH_HOST}" \
    "cat > ${NAS_DATA_DB_PATH}" < output/data.db \
    && echo "[$(date)] SSH pipe succeeded" \
    || { notify "배포 실패 — 수동 배포 필요" "배포 오류 ❌" "Basso"; exit 1; }

  echo "[$(date)] === Pipeline + deploy complete ==="
} 2>&1 | tee "$LOG"

notify "분석 완료 — data.db Synology 배포 완료" "$(date +%H:%M) 완료 ✅" "Glass"
SUMMARY=$(.venv/bin/python3 scripts/telegram_summary.py 2>/dev/null || echo "📊 US Stock 분석 완료 — $(date '+%Y-%m-%d %H:%M KST')")
telegram_notify "$SUMMARY"
