# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## LLM Wiki (운영 규칙 & Gotchas)

코드 구조는 아래 Architecture 섹션, **운영 규칙·알려진 버그·색상 임계값**은 wiki 참고:

| Wiki | 핵심 내용 |
|------|-----------|
| [.omc/wiki/pipeline-gotchas.md](.omc/wiki/pipeline-gotchas.md) | **맥북=분석, Synology=서빙 전용**, 실행 순서, signals 버그 수정 이력 |
| [.omc/wiki/frontend-color-rules.md](.omc/wiki/frontend-color-rules.md) | 점수별 색상 임계값, HelpBtn 패턴, 전체 토픽 목록 |
| [.omc/wiki/deployment.md](.omc/wiki/deployment.md) | GHA 배포 흐름, Synology Tailscale IP, 수동 배포 명령 |

## Project Overview

US stock market analysis system: data collection → market regime detection → smart money screening → AI-powered reports. Three-part educational project, all parts implemented.

## Quick Start

```bash
source .venv/bin/activate    # Python 3.13.3 venv required

python scripts/run_integrated_analysis.py  # 통합 분석 (Phase 0~3: data → timing → screening → report)
python scripts/run_full_pipeline.py        # Full pipeline (data → regime → screening → AI → report)
python scripts/run_screening.py            # S&P 500 screening only
python scripts/run_daily_scheduler.py              # 1회 즉시 실행
python scripts/run_daily_scheduler.py --status     # 마지막 실행 상태 확인
python scripts/run_daily_scheduler.py --install-cron --time 06:00  # macOS cron 등록
```

## Architecture

```
src/
├── collectors/                  # Data acquisition
│   ├── us_price_fetcher.py      # USPriceFetcher — yfinance + curl_cffi
│   ├── fetch_sp500_list.py      # S&P 500 list from Wikipedia (no __main__ guard!)
│   ├── fetch_sp500_prices.py    # Batch OHLCV download for all 503 stocks
│   ├── macro_collector.py       # MacroDataCollector — FRED API + VIX + Fear&Greed
│   └── data_fetcher.py          # USStockDataFetcher — yfinance primary, Finnhub fallback
│
├── analyzers/                   # Analysis engines
│   ├── technical_indicators.py  # SMA/RSI/ATR/BB (pure functions, returns copies)
│   ├── sector_analyzer.py       # SectorAnalyzer — 11 SPDR sector ETFs
│   ├── market_regime.py         # MarketRegimeDetector — 5-sensor weighted voting
│   ├── market_gate.py           # Market gate (GO/CAUTION/STOP) + volume-price divergence
│   ├── smart_money_screener_v2.py # EnhancedSmartMoneyScreener — composite scoring
│   ├── ai_summary_generator.py  # NewsCollector + Gemini/OpenAI/Perplexity generators
│   └── final_report_generator.py # FinalReportGenerator — quant + AI final ranking
│
├── pipeline/                    # Orchestration
│   ├── us_data_pipeline.py      # USDataPipeline — Part 1 orchestrator
│   ├── run_pipeline.py          # CLI: --top-n, --period, --output-dir
│   ├── data_quality_report.py   # 100-point quality scoring per CSV
│   └── plot_sector_heatmap.py   # Sector heatmap visualization
│
├── ml/                          # Machine learning
│   ├── pipeline/train.py        # GBM training
│   ├── pipeline/predict.py      # GBM inference
│   ├── pipeline/feature_store.py
│   └── validation/walk_forward.py
│
└── us_market/
    └── index_predictor.py       # IndexPredictor — SPY/QQQ direction forecast

scripts/                         # Entry points
├── run_integrated_analysis.py   # 통합 분석 (Phase 0/1/2/3 — verdict + action 매핑)
├── run_daily_scheduler.py       # 일일 스케줄러 (--status, --install-cron, --time)
├── run_full_pipeline.py         # Full 9-step pipeline (data → regime → gate → screening → AI → report → ML)
├── run_all.py                   # Legacy: Part 1 + 2 + 3 basic run
├── run_screening.py             # S&P 500 screening with progress display
└── regen_dashboard_data.py      # Regenerate dashboard JSONs

output/                          # Analysis results
├── reports/                     # Daily reports
│   ├── daily_report_YYYYMMDD.json
│   └── latest_report.json
├── picks/                       # Screened stock picks
│   └── smart_money_picks_YYYYMMDD.csv
├── models/                      # ML model files
│   └── predictor_model_*.joblib
├── regime_result.json
├── final_top10_report.json
└── ...

logs/                            # Execution logs
└── daily_run_YYYYMMDD.log
```

## Data Flow

```
[Wikipedia/Yahoo/FRED] → src/collectors/ → data/*.csv
                                             ↓
                         src/analyzers/market_regime.py → output/regime_config.json
                         src/analyzers/market_gate.py   → GO/CAUTION/STOP
                                             ↓
                         src/analyzers/smart_money_screener_v2.py → output/picks/smart_money_picks_YYYYMMDD.csv
                                             ↓
                         src/analyzers/ai_summary_generator.py → output/ai_summaries.json
                                             ↓
                         src/analyzers/final_report_generator.py → output/final_top10_report.json
```

## Key Commands

```bash
# Part 1: Data collection
python src/pipeline/run_pipeline.py --top-n 50 --period 1y --output-dir data

# Part 2: Market regime
python src/analyzers/market_regime.py              # 5-sensor regime detection
python src/analyzers/market_gate.py                # 11-sector gate signal

# Part 3: Smart money screening
python scripts/run_screening.py                    # Full S&P 500 (saves to output/picks/)
python src/analyzers/ai_summary_generator.py --provider gemini --ticker AAPL
python src/analyzers/final_report_generator.py     # Final top 10 report

# Tests
python tests/test_price_fetcher.py             # Price fetcher (4 checks)
python tests/test_indicators.py                # Technical indicators (5 checks)
python src/pipeline/data_quality_report.py     # CSV quality scoring
```

## Market Regime Detection

5 sensors with weighted voting:

| Sensor | Weight | Source |
|--------|--------|--------|
| VIX | 30% | ^VIX — fear gauge |
| Trend | 25% | SPY vs SMA50/SMA200 |
| Breadth | 18% | RSP/SPY relative strength |
| Credit | 15% | HYG/IEF ratio |
| Yield Curve | 12% | ^TNX - ^IRX spread |

Score → regime: <0.75 risk_on, 0.75-1.5 neutral, 1.5-2.25 risk_off, ≥2.25 crisis

Adaptive params per regime:
- risk_on: stop_loss -10%, mdd -12%
- neutral: stop_loss -8%, mdd -10%
- risk_off: stop_loss -5%, mdd -7%
- crisis: stop_loss -3%, mdd -5%

## Composite Scoring (Smart Money)

| Factor | Weight |
|--------|--------|
| Technical (RSI/MACD/MA) | 25% |
| Fundamental (PE/Growth/ROE) | 20% |
| Analyst (recommendation/upside) | 15% |
| Relative Strength vs SPY | 15% |
| Volume (SD score) | 15% |
| 13F Holdings | 10% |

Grade: A(80+) Strong Accumulation → F(<20) Capitulation

Strategy: Trend (RS>0 + MA Bullish) / Swing (RSI 30-70) / Reversal (RSI<30 or Death Cross)
Setup: Breakout (Golden Cross or RSI>60) / Pullback (Bullish + RSI 40-55) / Base (횡보 바닥)

## Verdict & Action (Integrated Analysis)

Verdict 판정 (regime + gate + ML):
- Regime OK + Gate GO + ML Bullish → **GO**
- Regime crisis/risk_off or Gate STOP → **STOP**
- 나머지 → **CAUTION**

Action 매핑 (verdict + grade):
| Verdict | Grade A/B | Grade C | Grade D+ |
|---------|-----------|---------|----------|
| GO | BUY | WATCH | WATCH |
| CAUTION | SMALL BUY | WATCH | WATCH |
| STOP | HOLD | HOLD | HOLD |

## Environment Variables

`.env` file (loaded via python-dotenv):

| Key | Required | Purpose |
|-----|----------|---------|
| FRED_API_KEY | Yes | Federal Reserve economic data |
| GOOGLE_API_KEY | For AI | Gemini API |
| OPENAI_API_KEY | For AI | GPT API |
| PERPLEXITY_API_KEY | For AI | Perplexity API |
| FINNHUB_API_KEY | Optional | News + price fallback |

## Key Patterns

- **curl_cffi**: All yfinance sessions use `Session(impersonate="chrome")` to avoid rate limits
- **Immutable indicators**: `src/analyzers/technical_indicators.py` always returns copies
- **fetch_sp500_list.py**: No `__main__` guard — pipeline reimplements logic internally
- **Symbol format**: Dots → dashes for yfinance (BRK.B → BRK-B)
- **Look-ahead bias**: `load_data()` filters holdings by filing_date ≤ yesterday
- **AI fallback**: All generators return fallback JSON on error, never crash
- **API cost tracking**: `APIUsageTracker` singleton tracks tokens/cost per provider
- **sys.path**: Scripts in `scripts/` insert `parent.parent/src` for cross-package imports

## API Cost Tracking

`src/analyzers/ai_summary_generator.py` has a module-level `usage_tracker` singleton:

| Provider | Input | Output |
|----------|-------|--------|
| Gemini Flash | $0.10/1M tokens | $0.40/1M tokens |
| GPT-5-mini | $0.15/1M tokens | $0.60/1M tokens |
| Perplexity Sonar | $3/1K requests | — |

`scripts/run_full_pipeline.py` prints cost summary at the end.

## Dashboard

```bash
# Next.js dashboard (active)
cd frontend && npm run dev
# Open http://localhost:3000

# Legacy static dashboard (archived)
cd archive/legacy-dashboard && python3 -m http.server 8889
```

Data files synced from `output/` to `frontend/public/data/` by pipeline.

## Output Files

| Path | Content |
|------|---------|
| data/sp500_list.csv | 503 stocks with sectors |
| data/us_daily_prices.csv | OHLCV + indicators (MultiIndex) |
| data/us_macro.csv | VIX, FRED rates, Fear&Greed |
| data/us_sectors.csv | 11 sector returns |
| output/regime_result.json | Full regime detection detail |
| output/regime_config.json | Regime + adaptive params |
| output/ai_summaries.json | AI analysis per ticker |
| output/final_top10_report.json | Final ranked top 10 |
| output/picks/smart_money_picks_YYYYMMDD.csv | Date-stamped screening results |
| output/reports/latest_report.json | Latest integrated analysis report |
| output/reports/daily_report_YYYYMMDD.json | Daily report archive |
