import logging
import os
import pandas as pd
from collectors.us_price_fetcher import USPriceFetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# S&P 500 목록 로드
sp500 = pd.read_csv("sp500_list.csv")
symbols = sp500["Symbol"].tolist()
logger.info("수집 대상: %d개 종목", len(symbols))

fetcher = USPriceFetcher()
output_dir = "sp500_prices"
os.makedirs(output_dir, exist_ok=True)

success, fail = 0, 0
for i, symbol in enumerate(symbols):
    csv_path = os.path.join(output_dir, f"{symbol}.csv")
    if os.path.exists(csv_path):
        logger.info("[%d/%d] %s 스킵 (이미 존재)", i + 1, len(symbols), symbol)
        success += 1
        continue

    df = fetcher.fetch_ohlcv(symbol, period="1y")
    if not df.empty:
        df.to_csv(csv_path)
        success += 1
    else:
        fail += 1

    if (i + 1) % 50 == 0:
        logger.info("진행: %d/%d (성공: %d, 실패: %d)", i + 1, len(symbols), success, fail)

    import time
    if i < len(symbols) - 1:
        time.sleep(1)

logger.info("수집 완료: 성공 %d, 실패 %d / 총 %d", success, fail, len(symbols))
