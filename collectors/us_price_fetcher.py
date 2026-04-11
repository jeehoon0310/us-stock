import logging
import time

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)


class USPriceFetcher:
    def __init__(self):
        self.yf_session = None
        try:
            from curl_cffi import requests as curl_requests
            self.yf_session = curl_requests.Session(impersonate="chrome")
            logger.info("curl_cffi 세션 활성화")
        except ImportError:
            logger.info("curl_cffi not installed - may hit rate limits")

    def fetch_ohlcv(self, symbol: str, period: str = "1y") -> pd.DataFrame:
        try:
            ticker = yf.Ticker(symbol, session=self.yf_session)
            df = ticker.history(period=period)
            if df.empty:
                logger.warning("데이터 없음: %s", symbol)
                return pd.DataFrame()
            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.index.name = "Date"
            logger.info("%s: %d일치 데이터 수집", symbol, len(df))
            return df
        except Exception:
            logger.exception("수집 실패: %s", symbol)
            return pd.DataFrame()

    def fetch_batch(self, symbols: list[str], period: str = "1y") -> dict[str, pd.DataFrame]:
        results = {}
        for i, symbol in enumerate(symbols):
            results[symbol] = self.fetch_ohlcv(symbol, period)
            if i < len(symbols) - 1:
                time.sleep(1)
        logger.info("배치 수집 완료: %d/%d 성공", sum(1 for v in results.values() if not v.empty), len(symbols))
        return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    fetcher = USPriceFetcher()

    # 단일 종목 테스트
    df = fetcher.fetch_ohlcv("AAPL", period="5d")
    if not df.empty:
        logger.info("AAPL 최근 데이터:\n%s", df.tail())

    # 배치 테스트
    results = fetcher.fetch_batch(["MSFT", "GOOGL", "AMZN"], period="5d")
    for sym, data in results.items():
        logger.info("%s: %d행", sym, len(data))
