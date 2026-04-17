# ── Stage 1: Builder ─────────────────────────────────────────────
FROM python:3.13-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

# ── Stage 2: Runner ──────────────────────────────────────────────
FROM python:3.13-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    cron curl libgomp1 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# Application code
COPY analyzers/ ./analyzers/
COPY collectors/ ./collectors/
COPY pipeline/ ./pipeline/
COPY ml/ ./ml/
COPY us_market/ ./us_market/
COPY dashboard/ ./dashboard/
COPY run_integrated_analysis.py run_full_pipeline.py run_screening.py \
     run_daily_scheduler.py run_all.py regen_dashboard_data.py ./
COPY entrypoint.sh run_docker_analysis.sh ./
COPY crontab /etc/cron.d/us-stock-cron

# Cron setup
RUN chmod 0644 /etc/cron.d/us-stock-cron && \
    crontab /etc/cron.d/us-stock-cron && \
    touch /var/log/cron.log

# Data directories (overlaid by volume mounts at runtime)
RUN mkdir -p data output reports result logs ml/models

# Remove symlinks from dashboard/ — entrypoint copies files instead
RUN find dashboard/ -type l -delete 2>/dev/null || true

# Make scripts executable
RUN chmod +x entrypoint.sh run_docker_analysis.sh

HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8889/ || exit 1

EXPOSE 8889

ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
