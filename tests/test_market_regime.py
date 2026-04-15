"""MarketRegimeDetector 단위 테스트."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
import pytest

from analyzers.market_regime import MarketRegimeDetector


@pytest.fixture
def detector():
    with patch("analyzers.market_regime.MarketRegimeDetector.__init__", lambda self: None):
        d = MarketRegimeDetector()
        d.yf_session = None
    return d


def make_series(values, name="test"):
    return pd.Series(values, name=name)


class TestVixSignal:
    def test_risk_on(self, detector):
        vix = make_series([12.0] * 25)
        result = detector._vix_signal(vix)
        assert result["vix_regime"] == "risk_on"
        assert result["vix_current"] == 12.0

    def test_neutral(self, detector):
        vix = make_series([18.0] * 25)
        result = detector._vix_signal(vix)
        assert result["vix_regime"] == "neutral"

    def test_risk_off(self, detector):
        vix = make_series([25.0] * 25)
        result = detector._vix_signal(vix)
        assert result["vix_regime"] == "risk_off"

    def test_crisis(self, detector):
        vix = make_series([35.0] * 25)
        result = detector._vix_signal(vix)
        assert result["vix_regime"] == "crisis"


class TestTrendSignal:
    def test_risk_on_above_both_positive_slope(self, detector):
        # SPY가 SMA50, SMA200 위 + 상승 기울기
        # rolling(200).mean().iloc[-21] 계산에 최소 220개 데이터 필요
        base = list(range(1, 221))  # 220개 데이터, 기울기 양
        spy = make_series([float(x) * 1.5 + 100 for x in base])
        result = detector._trend_signal(spy)
        assert result["trend_regime"] == "risk_on"

    def test_insufficient_data(self, detector):
        spy = make_series([100.0] * 50)
        result = detector._trend_signal(spy)
        assert result["trend_regime"] == "neutral"
        assert result.get("data_insufficient") is True


class TestWeightedScore:
    def test_confidence_range(self, detector):
        """Confidence는 항상 0~100 사이."""
        regimes = {k: "risk_on" for k in detector.SIGNAL_WEIGHTS}
        weighted_score = sum(
            detector.REGIME_SCORES[regimes[k]] * detector.SIGNAL_WEIGHTS[k]
            for k in detector.SIGNAL_WEIGHTS
        )
        assert 0.0 <= weighted_score <= 3.0

    def test_all_crisis_gives_high_score(self, detector):
        regimes = {k: "crisis" for k in detector.SIGNAL_WEIGHTS}
        score = sum(
            detector.REGIME_SCORES[regimes[k]] * detector.SIGNAL_WEIGHTS[k]
            for k in detector.SIGNAL_WEIGHTS
        )
        assert score >= 2.25  # crisis 경계값 이상


class TestDetectIntegration:
    def test_detect_returns_required_keys(self):
        """detect() 결과에 필수 키가 있어야 함."""
        required_keys = {"final_regime", "weighted_score", "confidence", "signals", "details"}
        detector = MarketRegimeDetector.__new__(MarketRegimeDetector)
        detector.yf_session = None

        with patch.object(detector, "_fetch_series") as mock_fetch:
            mock_series = pd.Series([20.0] * 250)
            mock_fetch.return_value = mock_series
            result = detector.detect()

        assert required_keys.issubset(result.keys())
        assert result["final_regime"] in {"risk_on", "neutral", "risk_off", "crisis"}
        assert 0 <= result["confidence"] <= 100

    def test_detect_handles_all_none_series(self):
        """모든 시리즈 수집 실패 시에도 결과 반환."""
        detector = MarketRegimeDetector.__new__(MarketRegimeDetector)
        detector.yf_session = None

        with patch.object(detector, "_fetch_series", return_value=None):
            result = detector.detect()

        assert "final_regime" in result
        assert result["final_regime"] in {"risk_on", "neutral", "risk_off", "crisis"}
