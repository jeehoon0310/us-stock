import logging
from us_price_fetcher import USPriceFetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

fetcher = USPriceFetcher()
passed, failed = 0, 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        logger.info("✅ %s %s", name, detail)
    else:
        failed += 1
        logger.error("❌ %s %s", name, detail)


# 1. AAPL 1년치 데이터 행 수 >= 200
df_aapl = fetcher.fetch_ohlcv("AAPL", period="1y")
check("AAPL 행 수 >= 200", len(df_aapl) >= 200, f"(실제: {len(df_aapl)}행)")

# 2. OHLCV 5개 컬럼 확인
expected_cols = {"Open", "High", "Low", "Close", "Volume"}
actual_cols = set(df_aapl.columns)
check("OHLCV 컬럼 확인", expected_cols.issubset(actual_cols), f"(컬럼: {list(df_aapl.columns)})")

# 3. 존재하지 않는 티커 → 빈 DataFrame
df_bad = fetcher.fetch_ohlcv("ZZZZZ", period="1y")
check("잘못된 티커 → 빈 DataFrame", df_bad.empty, f"(행 수: {len(df_bad)})")

# 4. 배치 수집 3개 모두 데이터 존재
results = fetcher.fetch_batch(["AAPL", "MSFT", "GOOGL"], period="5d")
all_have_data = all(not v.empty for v in results.values())
sizes = {k: len(v) for k, v in results.items()}
check("배치 수집 3/3 성공", all_have_data, f"(행 수: {sizes})")

# 결과 요약
print()
print("=" * 40)
print(f"  결과: {passed} passed, {failed} failed")
print("=" * 40)
