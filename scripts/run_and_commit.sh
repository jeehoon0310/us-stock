#!/bin/bash
# us-stock daily pipeline + deploy via SSH pipe to Synology
# Runs on Mac (launchd / weekdays 07:00 KST).
# Data delivered via SSH cat pipe (output/data.db → NAS) — no git commit, no image rebuild required.
set -euo pipefail
cd /Users/frindle/workspace/synology/us-stock
source .venv/bin/activate

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

# --- ERR 트랩: 어느 단계든 실패 시 알림 ---
on_error() {
  local exit_code=$?
  notify "오류 발생 (exit ${exit_code}) — 수동 실행 필요" "파이프라인 실패 ❌" "Basso"
}
trap on_error ERR

# --- 늦은 실행 감지: 07:30 이후 = 맥북이 잠들어 있었음 ---
CURRENT_HOUR=$((10#$(date +%H)))
CURRENT_MIN=$((10#$(date +%M)))
if [ "$CURRENT_HOUR" -gt 7 ] || ([ "$CURRENT_HOUR" -eq 7 ] && [ "$CURRENT_MIN" -gt 30 ]); then
  notify "07:00 이후 실행됨 (현재 $(date +%H:%M)) — 맥북이 잠들어 있었을 수 있음" "늦은 실행 ⚠️" "Ping"
fi

# --- 네트워크 체크 ---
if ! ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
  notify "네트워크 없음 — 수동 실행 필요" "네트워크 오류 ❌" "Basso"
  exit 1
fi

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
