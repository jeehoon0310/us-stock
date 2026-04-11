#!/bin/bash
# Pipeline wrapper for cron execution inside Docker container.
# Sources environment vars (cron doesn't inherit them) and syncs dashboard after run.
set -e
cd /app

# Source environment variables saved by entrypoint
[ -f /app/.env.cron ] && set -a && source /app/.env.cron && set +a

LOCK=/tmp/us-stock-pipeline.lock
LOG_DATE=$(date +%Y%m%d)

# Prevent concurrent runs
if [ -f "$LOCK" ]; then
    echo "[$(date)] Pipeline already running (lock exists). Skipping." | tee -a "logs/daily_run_${LOG_DATE}.log"
    exit 0
fi
trap 'rm -f "$LOCK"' EXIT
touch "$LOCK"

echo "[$(date)] === Starting integrated analysis ===" | tee -a "logs/daily_run_${LOG_DATE}.log"

# Run the main pipeline
python run_integrated_analysis.py 2>&1 | tee -a "logs/daily_run_${LOG_DATE}.log"

# Regenerate dashboard JSON files
echo "[$(date)] Regenerating dashboard data..." | tee -a "logs/daily_run_${LOG_DATE}.log"
python regen_dashboard_data.py 2>&1 | tee -a "logs/daily_run_${LOG_DATE}.log"

# Sync output/ → dashboard/ (replaces symlinks)
for f in ai_summaries.json regime_config.json regime_result.json \
         final_top10_report.json gbm_predictions.json market_gate.json \
         index_prediction.json prediction_history.json latest_report.json; do
    [ -f "output/$f" ] && cp "output/$f" "dashboard/$f"
done
mkdir -p dashboard/reports
cp reports/*.json dashboard/reports/ 2>/dev/null || true

echo "[$(date)] === Pipeline complete ===" | tee -a "logs/daily_run_${LOG_DATE}.log"
