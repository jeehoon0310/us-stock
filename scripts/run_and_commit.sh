#!/bin/bash
# us-stock daily pipeline + deploy via git-scraping
# Runs on Mac (launchd / weekdays 06:00 KST), pushes JSON to git → GitHub Actions builds & deploys.
set -euo pipefail
cd /Users/frindle/workspace/education/us-stock
source .venv/bin/activate

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
           output/latest_report.json output/reports/latest_report.json; do
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
  cp output/reports/*.json "$DATA_DIR/reports/" 2>/dev/null || true

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
