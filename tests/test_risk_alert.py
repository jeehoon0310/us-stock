"""Part 6 — RiskAlertSystem 테스트."""

import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def mock_yf(monkeypatch):
    """yfinance를 mock하여 고정 가격 데이터 반환."""
    dates = pd.date_range("2026-01-15", periods=60, freq="B")
    prices = np.linspace(100, 120, 60)  # 100→120 상승

    def fake_download(tickers, period=None, progress=False, session=None):
        if isinstance(tickers, str):
            tickers = [tickers]
        data = {}
        for t in tickers:
            data[t] = prices.copy()
        df = pd.DataFrame(data, index=dates)
        # MultiIndex columns: (Close, ticker)
        df.columns = pd.MultiIndex.from_product([["Close"], tickers])
        return df

    mock_ticker = MagicMock()
    mock_ticker.return_value.info = {"sector": "Technology"}
    mock_ticker.return_value.history.return_value = pd.DataFrame(
        {"Close": [115.0]}, index=[dates[-1]]
    )

    monkeypatch.setattr("us_market.risk_alert.yf.download", fake_download)
    monkeypatch.setattr("us_market.risk_alert.yf.Ticker", mock_ticker)


@pytest.fixture
def regime_config_file(tmp_path):
    """임시 regime_config.json 생성."""
    config = {
        "regime": "neutral",
        "weighted_score": 0.81,
        "adaptive_params": {
            "stop_loss": "-8%",
            "max_drawdown_warning": "-10%",
        },
    }
    out_dir = tmp_path / "output"
    out_dir.mkdir()
    (out_dir / "reports").mkdir()
    with open(out_dir / "regime_config.json", "w") as f:
        json.dump(config, f)
    return tmp_path


@pytest.fixture
def risk_system(regime_config_file, monkeypatch, mock_yf):
    """RiskAlertSystem 인스턴스 (테스트용 디렉토리)."""
    from us_market.risk_alert import RiskAlertSystem

    # OUTPUT_DIR을 tmp_path/output으로 오버라이드
    out_dir = regime_config_file / "output"

    # latest_report.json 생성
    report = {"verdict": "CAUTION", "market_timing": {"regime": "neutral"}}
    with open(out_dir / "reports" / "latest_report.json", "w") as f:
        json.dump(report, f)

    system = RiskAlertSystem.__new__(RiskAlertSystem)
    system.data_dir = regime_config_file
    system.OUTPUT_DIR = out_dir
    system.output_file = out_dir / "risk_alerts.json"
    system._sector_cache = {}
    system.regime_config = system._load_regime_config()
    system.verdict_data = system._load_verdict()
    return system


@pytest.fixture
def sample_picks():
    """테스트용 picks 데이터."""
    return [
        {"ticker": "AAPL", "company_name": "Apple", "grade": "A",
         "strategy": "Trend", "setup": "Breakout", "composite_score": 85,
         "entry_price": 100, "sector": "Technology", "current_price": 115},
        {"ticker": "MSFT", "company_name": "Microsoft", "grade": "B",
         "strategy": "Trend", "setup": "Breakout", "composite_score": 72,
         "entry_price": 100, "sector": "Technology", "current_price": 110},
        {"ticker": "XOM", "company_name": "Exxon", "grade": "C",
         "strategy": "Swing", "setup": "Base", "composite_score": 55,
         "entry_price": 100, "sector": "Energy", "current_price": 105},
        {"ticker": "JPM", "company_name": "JPMorgan", "grade": "D",
         "strategy": "Swing", "setup": "Pullback", "composite_score": 40,
         "entry_price": 100, "sector": "Financials", "current_price": 98},
        {"ticker": "GME", "company_name": "GameStop", "grade": "E",
         "strategy": "Reversal", "setup": "Base", "composite_score": 18,
         "entry_price": 100, "sector": "Consumer Discretionary", "current_price": 80},
    ]


# ── 테스트 ────────────────────────────────────────────────────────

def test_load_regime_config_adaptive_params(risk_system):
    """#1: regime_config.json의 stop_loss가 float로 파싱되는지 확인."""
    config = risk_system.regime_config
    assert config["regime"] == "neutral"
    assert config["adaptive_params"]["stop_loss"] == -0.08
    assert config["adaptive_params"]["max_drawdown_warning"] == -0.10


def test_position_sizing_verdict_stop(risk_system, sample_picks):
    """#2: verdict=STOP일 때 모든 포지션이 0%인지 확인."""
    risk_system.verdict_data = {"verdict": "STOP"}
    sizes = risk_system.calculate_position_sizes(sample_picks)
    for s in sizes:
        if s["ticker"] == "CASH":
            assert s["final_pct"] == 100.0
        else:
            assert s["final_pct"] == 0


def test_position_sizing_caution_cap(risk_system, sample_picks):
    """#3: verdict=CAUTION일 때 총 투자 비중이 50% 이하인지 확인."""
    risk_system.verdict_data = {"verdict": "CAUTION"}
    sizes = risk_system.calculate_position_sizes(sample_picks)
    invested = sum(s["final_pct"] for s in sizes if s["ticker"] != "CASH")
    assert invested <= 50.0


def test_trailing_stop_breached(risk_system):
    """#4: trailing stop BREACHED 판정 테스트.

    entry=100, peak=120, current=112
    trailing_threshold = -8% / 2 = -4%
    from_peak_pct = (112/120 - 1)*100 = -6.67% → BREACHED
    """
    picks = [{"ticker": "TEST", "company_name": "Test", "entry_price": 100,
              "grade": "B", "sector": "Technology"}]
    drawdowns = {
        "TEST": {
            "current_price": 112,
            "peak_price": 120,
            "entry_price": 100,
            "from_entry_pct": 12.0,  # 진입가 대비 +12%
            "from_peak_pct": -6.67,  # 최고가 대비 -6.67%
            "max_dd": -6.67,
            "from_peak_days": 5,
        }
    }
    result = risk_system.check_stop_losses(picks, drawdowns)
    assert len(result) == 1
    assert result[0]["trailing_status"] == "BREACHED"
    assert result[0]["fixed_status"] == "OK"


def test_fixed_stop_warning(risk_system):
    """#5: fixed stop WARNING 판정 테스트.

    entry=100, current=93
    threshold=-8%, from_entry_pct=-7% → WARNING (2% 이내)
    """
    picks = [{"ticker": "TEST", "company_name": "Test", "entry_price": 100,
              "grade": "B", "sector": "Technology"}]
    drawdowns = {
        "TEST": {
            "current_price": 93,
            "peak_price": 105,
            "entry_price": 100,
            "from_entry_pct": -7.0,
            "from_peak_pct": -11.43,
            "max_dd": -11.43,
            "from_peak_days": 10,
        }
    }
    result = risk_system.check_stop_losses(picks, drawdowns)
    assert len(result) == 1
    assert result[0]["fixed_status"] == "WARNING"


def test_risk_budget_exceeded(risk_system, monkeypatch):
    """#6: VaR이 5% 초과할 때 budget_status=EXCEEDED."""
    def fake_var(tickers, **kwargs):
        return {"risk_budget_usage_pct": 6.2, "regime_adjusted_var_dollar": 6200}

    monkeypatch.setattr(risk_system, "calculate_portfolio_var", fake_var)
    picks = [{"ticker": "AAPL", "sector": "Technology"}]
    result = risk_system.check_risk_budget(picks)
    assert result["budget_status"] == "EXCEEDED"


def test_concentration_crisis_threshold(risk_system):
    """#7: crisis 체제에서 상관관계 임계값이 0.70인지 확인."""
    risk_system.regime_config["regime"] = "crisis"
    picks = [{"ticker": "AAPL", "sector": "Technology"}]
    result = risk_system.analyze_concentration_risk(picks)
    assert result["correlation_threshold"] == 0.70


def test_telegram_format_length(risk_system, sample_picks, mock_yf):
    """#8: 텔레그램 메시지가 4096자 이하인지 확인."""
    # generate_alerts를 직접 호출 대신, _last_result를 설정
    risk_system._last_result = {
        "regime": "neutral",
        "verdict": "CAUTION",
        "alerts": [
            {"level": "CRITICAL", "category": "stop_loss", "ticker": "GME",
             "message": "GME stop-loss 돌파 (-20%)", "action": "SELL"},
            {"level": "WARNING", "category": "concentration", "ticker": "PORTFOLIO",
             "message": "Technology 섹터 45% > 한도 40%", "action": "MONITOR"},
        ],
        "position_sizes": [
            {"ticker": "AAPL", "final_pct": 16.0},
            {"ticker": "CASH", "final_pct": 57.0},
        ],
        "portfolio_summary": {
            "total_var_dollar": 3200,
            "risk_budget_status": "OK",
        },
    }
    msg = risk_system.format_telegram_message()
    assert len(msg) <= 4096
    assert "CRITICAL" in msg


def test_generate_alerts_output_structure(risk_system, sample_picks, monkeypatch):
    """#9: generate_alerts() 결과에 필수 키 존재."""
    # load_picks mock
    monkeypatch.setattr(risk_system, "load_picks", lambda: sample_picks)

    result = risk_system.generate_alerts()
    assert "alerts" in result
    assert "position_sizes" in result
    assert "portfolio_summary" in result
    assert "regime" in result
    assert "verdict" in result
    assert isinstance(result["alerts"], list)


def test_grade_e_f_zero_position(risk_system):
    """#10: Grade E/F 종목은 포지션 0%."""
    picks = [
        {"ticker": "GME", "company_name": "GameStop", "grade": "E",
         "entry_price": 50, "sector": "Consumer Discretionary"},
        {"ticker": "AMC", "company_name": "AMC", "grade": "F",
         "entry_price": 10, "sector": "Communication"},
    ]
    risk_system.verdict_data = {"verdict": "GO"}
    sizes = risk_system.calculate_position_sizes(picks)
    for s in sizes:
        if s["ticker"] != "CASH":
            assert s["final_pct"] == 0
