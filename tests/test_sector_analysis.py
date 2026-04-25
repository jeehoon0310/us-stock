"""섹터 분석 모듈 단위 테스트 (Part 7 Prompt 11).

yfinance 네트워크 호출은 monkeypatch로 모킹. 10개 테스트 목록:
  1. test_sector_etfs_count
  2. test_cycle_map_coverage
  3. test_cycle_angles
  4. test_phase_weights_sum
  5. test_options_default_watchlist
  6. test_interpret_signal_bullish
  7. test_interpret_signal_bearish
  8. test_sector_stocks_count
  9. test_heatmap_period_map
 10. test_heavy_call_buying
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import pytest

from us_market.sector_rotation import SectorRotationTracker
from us_market.sector_heatmap import SectorHeatmapCollector
from us_market.options_flow import OptionsFlowAnalyzer, _DEFAULT_WATCHLIST


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def no_yfinance_network(monkeypatch):
    """모든 테스트에서 yfinance 다운로드 차단."""
    import pandas as pd
    import us_market.sector_rotation as sr_mod
    import us_market.sector_heatmap as sh_mod
    import us_market.options_flow as of_mod

    empty_df = pd.DataFrame()

    monkeypatch.setattr(sr_mod.yf, 'download', lambda *a, **kw: empty_df)
    monkeypatch.setattr(sh_mod.yf, 'download', lambda *a, **kw: empty_df)
    monkeypatch.setattr(of_mod.yf, 'download', lambda *a, **kw: empty_df)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_sector_etfs_count():
    """SECTOR_ETFS가 11개인지 확인."""
    t = SectorRotationTracker()
    assert len(t.SECTOR_ETFS) == 11


def test_cycle_map_coverage():
    """CYCLE_MAP의 모든 ETF가 SECTOR_ETFS에 포함되는지 확인."""
    t = SectorRotationTracker()
    for phase, etfs in t.CYCLE_MAP.items():
        for etf in etfs:
            assert etf in t.SECTOR_ETFS, f"{etf} (in {phase}) not in SECTOR_ETFS"


def test_cycle_angles():
    """4개 국면 모두 CYCLE_ANGLES 값이 있는지 확인."""
    t = SectorRotationTracker()
    assert len(t.CYCLE_ANGLES) == 4
    for phase in t.CYCLE_MAP:
        assert phase in t.CYCLE_ANGLES, f"{phase} has no angle"


def test_phase_weights_sum():
    """3개 가중치 합이 1.0인지 확인."""
    t = SectorRotationTracker()
    total = t.phase_weight_1w + t.phase_weight_1m + t.phase_weight_3m
    assert abs(total - 1.0) < 1e-9, f"weights sum {total} != 1.0"


def test_options_default_watchlist(tmp_path):
    """picks 파일 없을 때 기본 워치리스트 15개 반환 확인."""
    # tmp_path에는 output/picks/가 없으므로 반드시 default 반환
    a = OptionsFlowAnalyzer(data_dir=str(tmp_path))
    assert len(a.watchlist) == 15
    assert a.watchlist == list(_DEFAULT_WATCHLIST)


def test_interpret_signal_bullish():
    """P/C Volume Ratio 0.3 → 'Very Bullish' 반환 확인."""
    a = OptionsFlowAnalyzer(data_dir='/tmp')
    result = a._interpret_signal(0.3, 0.4, 1, 0)
    assert result['sentiment'] == 'Very Bullish'
    assert result['sentiment_score'] == 90


def test_interpret_signal_bearish():
    """P/C Volume Ratio 1.5 → 'Very Bearish' 반환 확인."""
    a = OptionsFlowAnalyzer(data_dir='/tmp')
    result = a._interpret_signal(1.5, 1.3, 0, 2)
    assert result['sentiment'] == 'Very Bearish'
    assert result['sentiment_score'] == 10


def test_sector_stocks_count():
    """각 섹터의 종목 수가 10개인지 확인."""
    c = SectorHeatmapCollector()
    for sector, stocks in c.sector_stocks.items():
        assert len(stocks) == 10, f"{sector}: expected 10 stocks, got {len(stocks)}"


def test_heatmap_period_map():
    """'1d' 기간이 '5d' fetch로 변환되는지 확인."""
    c = SectorHeatmapCollector()
    assert c.period_map.get('1d') == '5d'


def test_heavy_call_buying():
    """unusual_calls=10, unusual_puts=2 → 'Heavy Call Buying' 확인."""
    a = OptionsFlowAnalyzer(data_dir='/tmp')
    result = a._interpret_signal(0.7, 0.8, 10, 2)
    assert result['activity'] == 'Heavy Call Buying'
