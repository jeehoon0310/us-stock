#!/bin/bash
set -e

# ── Export env vars for cron (cron doesn't inherit environment) ──
printenv | grep -E '^(FRED_|GOOGLE_|OPENAI_|PERPLEXITY_|FINNHUB_|GEMINI_|TZ=)' > /app/.env.cron
echo "PATH=$PATH" >> /app/.env.cron

# ── Sync output/ → dashboard/ (replaces macOS symlinks) ─────────
sync_dashboard() {
    for f in ai_summaries.json regime_config.json regime_result.json \
             final_top10_report.json gbm_predictions.json market_gate.json \
             index_prediction.json prediction_history.json latest_report.json; do
        [ -f "output/$f" ] && cp "output/$f" "dashboard/$f"
    done
    mkdir -p dashboard/reports
    cp reports/*.json dashboard/reports/ 2>/dev/null || true
    echo "[entrypoint] Dashboard synced at $(date)"
}

sync_dashboard

# ── Start cron daemon in background ─────────────────────────────
echo "[entrypoint] Starting cron daemon..."
cron

# ── Start HTTP server (foreground, PID 1 after exec) ────────────
echo "[entrypoint] Starting dashboard on port 8889..."
cd /app/dashboard
exec python -m http.server 8889 --bind 0.0.0.0
