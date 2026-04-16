#!/bin/bash
# us-stock daily pipeline + deploy via git-scraping
# Runs on Mac (launchd / weekdays 07:00 KST), pushes JSON to git → GitHub Actions builds & deploys.
set -euo pipefail
cd /Users/frindle/workspace/education/us-stock
source .venv/bin/activate

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
mkdir -p logs frontend/public/data/reports

{
  echo "[$(date)] === Starting pipeline ==="

  python scripts/run_integrated_analysis.py
  python scripts/regen_dashboard_data.py

  # Verify all required JSON files exist before committing
  MISSING=""
  for f in output/regime_config.json output/regime_result.json \
           output/market_gate.json output/final_top10_report.json \
           output/gbm_predictions.json output/ai_summaries.json \
           output/index_prediction.json output/prediction_history.json \
           output/latest_report.json output/reports/latest_report.json \
           output/risk_alerts.json; do
    if [ ! -f "$f" ]; then
      MISSING="${MISSING} $f"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "[$(date)] MISSING FILES:$MISSING"
    exit 1
  fi

  # Copy JSON to Next.js public/data (build-time import source)
  DATA_DIR="frontend/public/data"
  cp output/regime_config.json "$DATA_DIR/"
  cp output/regime_result.json "$DATA_DIR/"
  cp output/market_gate.json "$DATA_DIR/"
  cp output/final_top10_report.json "$DATA_DIR/"
  cp output/gbm_predictions.json "$DATA_DIR/"
  cp output/ai_summaries.json "$DATA_DIR/"
  cp output/index_prediction.json "$DATA_DIR/"
  cp output/prediction_history.json "$DATA_DIR/"
  cp output/latest_report.json "$DATA_DIR/"
  cp output/risk_alerts.json "$DATA_DIR/" 2>/dev/null || true
  cp output/reports/*.json "$DATA_DIR/reports/" 2>/dev/null || true
  # risk_dates_manifest.json 갱신 (날짜별 risk_alerts 파일 목록)
  python3 -c "
import json, pathlib
fe = pathlib.Path('$DATA_DIR')
dates = sorted(set(
    f.stem.replace('risk_alerts_', '')
    for f in fe.glob('risk_alerts_????????.json')
    if f.stem.replace('risk_alerts_', '') >= '20260217'
))
(fe / 'risk_dates_manifest.json').write_text(json.dumps({'dates': dates}, indent=2))
" 2>/dev/null || true

  # Git commit & push if there are changes
  if ! git diff --quiet "$DATA_DIR" 2>/dev/null; then
    git add "$DATA_DIR"
    git commit -m "chore(data): daily update $(date +%F)"
    git push origin main
    echo "[$(date)] === Pushed new data to GitHub — Actions will build & deploy ==="
  else
    echo "[$(date)] === No data changes, skipping commit ==="
  fi
} 2>&1 | tee "$LOG"

notify "분석 완료 — 데이터 갱신 후 GitHub 배포 트리거됨" "$(date +%H:%M) 완료 ✅" "Glass"
