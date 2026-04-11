import logging
from us_price_fetcher import USPriceFetcher
from technical_indicators import add_all_indicators

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

fetcher = USPriceFetcher()
original = fetcher.fetch_ohlcv("AAPL", period="1y")
original_id = id(original)
original_cols = list(original.columns)

df = add_all_indicators(original)

passed, failed = 0, 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ PASS: {name} {detail}")
    else:
        failed += 1
        print(f"  ❌ FAIL: {name} {detail}")


print()
print("🔍 technical_indicators 검증")
print("=" * 55)

# 1. SMA_200 처음 199행 NaN
sma200_nan = df["SMA_200"].iloc[:199].isna().all()
sma200_first_valid = df["SMA_200"].iloc[199]
check("SMA_200 처음 199행 NaN", sma200_nan, f"(200번째 값: {sma200_first_valid:.2f})")

# 2. RSI 0~100 범위
rsi_valid = df["RSI"].dropna()
rsi_in_range = (rsi_valid >= 0).all() and (rsi_valid <= 100).all()
check("RSI 0~100 범위", rsi_in_range, f"(min: {rsi_valid.min():.2f}, max: {rsi_valid.max():.2f})")

# 3. ATR 양수
atr_valid = df["ATR"].dropna()
atr_positive = (atr_valid > 0).all()
check("ATR 양수", atr_positive, f"(min: {atr_valid.min():.4f})")

# 4. BB_Upper > BB_Middle > BB_Lower
bb = df[["BB_Upper", "BB_Middle", "BB_Lower"]].dropna()
bb_order = (bb["BB_Upper"] > bb["BB_Middle"]).all() and (bb["BB_Middle"] > bb["BB_Lower"]).all()
check("BB_Upper > BB_Middle > BB_Lower", bb_order, f"({len(bb)}행 검증)")

# 5. 원본 DataFrame 미변경
same_id = id(original) == original_id
same_cols = list(original.columns) == original_cols
check("원본 DataFrame 미변경", same_id and same_cols, f"(컬럼: {original_cols})")

print("=" * 55)
print(f"  결과: {passed} passed, {failed} failed")
print()
