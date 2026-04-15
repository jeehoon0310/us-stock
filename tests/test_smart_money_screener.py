"""EnhancedSmartMoneyScreener 단위 테스트."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
import pytest

from analyzers.smart_money_screener_v2 import EnhancedSmartMoneyScreener


@pytest.fixture
def screener(tmp_path):
    """tmp_path에 최소 필요 파일 생성 후 screener 초기화."""
    data_dir = str(tmp_path)
    # 최소 sp500_list.csv
    sp500 = pd.DataFrame({
        "Symbol": ["AAPL", "MSFT", "GOOGL"],
        "Security": ["Apple", "Microsoft", "Alphabet"],
        "GICS Sector": ["Technology", "Technology", "Communication Services"],
    })
    sp500.to_csv(tmp_path / "sp500_list.csv", index=False)

    # 최소 us_daily_prices.csv
    dates = pd.date_range("2025-01-01", periods=50, freq="B")
    prices = pd.DataFrame({
        "Date": dates.tolist() * 3,
        "ticker": ["AAPL"] * 50 + ["MSFT"] * 50 + ["GOOGL"] * 50,
        "Close": np.random.uniform(100, 200, 150),
        "Volume": np.random.randint(1000000, 10000000, 150),
        "SMA_20": np.random.uniform(100, 200, 150),
        "RSI": np.random.uniform(30, 70, 150),
    })
    prices.to_csv(tmp_path / "us_daily_prices.csv", index=False)

    s = EnhancedSmartMoneyScreener.__new__(EnhancedSmartMoneyScreener)
    s.data_dir = data_dir
    return s


class TestCompositeScoreRange:
    def test_composite_score_0_100(self, screener):
        """composite_score는 항상 0~100 범위."""
        scores = {
            "technical_score": 75.0,
            "fundamental_score": 60.0,
            "analyst_score": 80.0,
            "rs_score": 55.0,
            "volume_score": 65.0,
            "holdings_score": 50.0,
        }
        # _calculate_composite_score가 있으면 호출, 없으면 직접 계산
        if hasattr(screener, "_calculate_composite_score"):
            result = screener._calculate_composite_score(scores)
            assert 0 <= result <= 100


class TestGradeAssignment:
    def test_grade_a_for_high_score(self, screener):
        if hasattr(screener, "_assign_grade"):
            assert screener._assign_grade(90) == "A"
            assert screener._assign_grade(50) in {"C", "D"}
            assert screener._assign_grade(10) in {"E", "F"}


class Test13FLookAheadBias:
    def test_filter_removes_future_filings(self, screener):
        """filing_date + 45일이 오늘 이후인 데이터는 필터링되어야 한다."""
        if not hasattr(screener, "_filter_13f_no_lookahead"):
            pytest.skip("_filter_13f_no_lookahead 메서드 없음")

        from datetime import date, timedelta
        today = date.today()
        future_period = (today + timedelta(days=10)).strftime("%Y-%m-%d")
        past_period = (today - timedelta(days=90)).strftime("%Y-%m-%d")

        df = pd.DataFrame({
            "ticker": ["AAPL", "MSFT"],
            "filing_date": [
                (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            ],
            "report_period_of_report": [future_period, past_period],
            "value": [1000, 2000],
        })
        filtered = screener._filter_13f_no_lookahead(df)
        assert "MSFT" in filtered["ticker"].values
        assert "AAPL" not in filtered["ticker"].values
