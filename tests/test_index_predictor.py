"""IndexPredictor 단위 테스트 (prompt 11)."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Ensure project root importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT / "src"))

from us_market.index_predictor import IndexPredictor  # noqa: E402


# ------------------------------------------------------------------
# 1. test_calculate_rsi_normal
# ------------------------------------------------------------------

def test_calculate_rsi_normal():
    """상승/하락 혼합 시리즈에서 RSI가 0~100 범위."""
    np.random.seed(42)
    prices = pd.Series(100 + np.cumsum(np.random.randn(50) * 0.5))
    rsi = IndexPredictor._calculate_rsi(prices, period=14)
    valid = rsi.dropna()
    assert (valid >= 0).all(), "RSI < 0 detected"
    assert (valid <= 100).all(), "RSI > 100 detected"
    assert len(valid) > 0, "RSI series is all NaN"


# ------------------------------------------------------------------
# 2. test_calculate_rsi_all_up
# ------------------------------------------------------------------

def test_calculate_rsi_all_up():
    """모든 값이 상승하면 RSI가 100에 가까움."""
    prices = pd.Series(list(range(100, 140)), dtype=float)
    rsi = IndexPredictor._calculate_rsi(prices, period=14)
    # 마지막 값은 100에 근접 (loss=0 → RSI=100)
    assert rsi.iloc[-1] > 95, f"Expected RSI > 95, got {rsi.iloc[-1]}"


# ------------------------------------------------------------------
# 3. test_calculate_macd_signal
# ------------------------------------------------------------------

def test_calculate_macd_signal():
    """상승 추세에서 +1, 하락 추세에서 -1 반환."""
    up_series = pd.Series(list(range(100, 180)), dtype=float)
    macd_up = IndexPredictor._calculate_macd_signal(up_series)
    assert macd_up.iloc[-1] == 1, f"Up-trend should return 1, got {macd_up.iloc[-1]}"

    down_series = pd.Series(list(range(180, 100, -1)), dtype=float)
    macd_down = IndexPredictor._calculate_macd_signal(down_series)
    assert macd_down.iloc[-1] == -1, \
        f"Down-trend should return -1, got {macd_down.iloc[-1]}"

    # Return type check
    assert macd_up.dtype == int, f"Expected int dtype, got {macd_up.dtype}"


# ------------------------------------------------------------------
# 4. test_calculate_bb_position
# ------------------------------------------------------------------

def test_calculate_bb_position():
    """밴드 상단이면 1에 가깝고, 하단이면 0에 가까움."""
    # 19 flat values + 1 spike up → 상단 근접
    up_spike = pd.Series([100.0] * 19 + [110.0])
    bb_up = IndexPredictor._calculate_bb_position(up_spike, window=20)
    assert bb_up.iloc[-1] >= 0.9, \
        f"Upper band should give >=0.9, got {bb_up.iloc[-1]}"

    # 19 flat values + 1 spike down → 하단 근접
    down_spike = pd.Series([100.0] * 19 + [90.0])
    bb_down = IndexPredictor._calculate_bb_position(down_spike, window=20)
    assert bb_down.iloc[-1] <= 0.1, \
        f"Lower band should give <=0.1, got {bb_down.iloc[-1]}"

    # Range check (전체)
    np.random.seed(0)
    prices = pd.Series(100 + np.cumsum(np.random.randn(100) * 0.5))
    bb = IndexPredictor._calculate_bb_position(prices, window=20)
    assert (bb >= 0).all() and (bb <= 1).all(), "BB position out of [0,1]"


# ------------------------------------------------------------------
# 5. test_build_raw_features_columns
# ------------------------------------------------------------------

def test_build_raw_features_columns():
    """FEATURE_NAMES 27개 피처가 모두 결과 DataFrame에 포함."""
    n_days = 400
    idx = pd.date_range('2023-01-01', periods=n_days, freq='B')
    np.random.seed(42)
    data = pd.DataFrame({
        'SPY': 400 + np.cumsum(np.random.randn(n_days) * 1.5),
        'QQQ': 350 + np.cumsum(np.random.randn(n_days) * 2),
        'VIX': 18 + np.abs(np.random.randn(n_days)) * 4,
        'XLK': 150 + np.cumsum(np.random.randn(n_days) * 0.5),
        'XLU': 70 + np.cumsum(np.random.randn(n_days) * 0.3),
        'XLY': 170 + np.cumsum(np.random.randn(n_days) * 0.6),
        'GOLD': 1900 + np.cumsum(np.random.randn(n_days) * 5),
        'DXY': 100 + np.cumsum(np.random.randn(n_days) * 0.3),
        'TNX': 4.0 + np.random.randn(n_days) * 0.1,
        'FVX': 3.5 + np.random.randn(n_days) * 0.1,
        'SPY_VOL': (np.abs(np.random.randn(n_days)) * 1e8).astype(float),
        'QQQ_VOL': (np.abs(np.random.randn(n_days)) * 5e7).astype(float),
    }, index=idx)

    predictor = IndexPredictor(data_dir='.')
    features = predictor._build_raw_features(data)

    missing = [n for n in IndexPredictor.FEATURE_NAMES
               if n not in features.columns]
    assert not missing, f"Missing features: {missing}"


# ------------------------------------------------------------------
# 6. test_inverse_features_direction
# ------------------------------------------------------------------

def test_inverse_features_direction():
    """INVERSE_FEATURES는 양수일 때 bearish."""
    predictor = IndexPredictor(data_dir='.')
    for feature in IndexPredictor.INVERSE_FEATURES:
        direction = predictor._get_driver_direction(feature, 1.5)
        assert direction == 'bearish', \
            f"{feature} with positive value should be bearish, got {direction}"

    # Negative → bullish for inverse
    for feature in IndexPredictor.INVERSE_FEATURES:
        direction = predictor._get_driver_direction(feature, -1.5)
        assert direction == 'bullish', \
            f"{feature} with negative value should be bullish, got {direction}"


# ------------------------------------------------------------------
# 7. test_load_regime_config_defaults
# ------------------------------------------------------------------

def test_load_regime_config_defaults(tmp_path):
    """regime_config.json 없을 때 기본값 반환."""
    predictor = IndexPredictor(data_dir=str(tmp_path))
    config = predictor.config

    assert config['prediction_horizon_days'] == 5
    assert config['cv_splits'] == 5
    assert config['retrain_interval_days'] == 7
    assert config['min_training_samples'] == 50
    assert config['confidence_high_threshold'] == 70
    assert config['confidence_moderate_threshold'] == 60


# ------------------------------------------------------------------
# 8. test_feature_names_count
# ------------------------------------------------------------------

def test_feature_names_count():
    """FEATURE_NAMES가 정확히 27개."""
    assert len(IndexPredictor.FEATURE_NAMES) == 27, \
        f"Expected 27 features, got {len(IndexPredictor.FEATURE_NAMES)}"
    # Verify no duplicates
    assert len(set(IndexPredictor.FEATURE_NAMES)) == 27, \
        "FEATURE_NAMES contains duplicates"
    # Verify INVERSE_FEATURES subset
    assert IndexPredictor.INVERSE_FEATURES.issubset(
        set(IndexPredictor.FEATURE_NAMES)
    ), "INVERSE_FEATURES has entries not in FEATURE_NAMES"
    assert len(IndexPredictor.INVERSE_FEATURES) == 6


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
