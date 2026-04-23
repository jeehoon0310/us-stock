import logging
import os

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

try:
    import yfinance as yf
    YF_AVAILABLE = True
except ImportError:
    YF_AVAILABLE = False
    logger.warning("yfinance 미설치 — Finnhub fallback 사용")


class USStockDataFetcher:
    # period 문자열을 거래일 수로 환산 (슬라이싱 기준)
    _PERIOD_DAYS: dict[str, int] = {
        "1mo": 23,
        "3mo": 65,
        "6mo": 130,
        "1y": 253,
        "2y": 506,
        "5y": 1260,
    }

    def __init__(self):
        self.yf_available = YF_AVAILABLE
        self.yf_session = None

        if self.yf_available:
            try:
                from curl_cffi import requests as curl_requests
                self.yf_session = curl_requests.Session(impersonate="chrome")
                logger.info("curl_cffi 세션 활성화")
            except ImportError:
                pass

        self.finnhub_key = os.environ.get("FINNHUB_API_KEY")
        self.alphavantage_key = os.environ.get("ALPHAVANTAGE_API_KEY")
        self.fmp_key = os.environ.get("FMP_API_KEY")

        # (ticker, period) → DataFrame 인메모리 캐시
        # 긴 period 데이터로 짧은 period 요청을 슬라이싱해 반환
        self._history_cache: dict[tuple[str, str], pd.DataFrame] = {}

        sources = []
        if self.yf_available:
            sources.append("yfinance")
        if self.finnhub_key:
            sources.append("finnhub")
        if self.alphavantage_key:
            sources.append("alphavantage")
        if self.fmp_key:
            sources.append("fmp")
        logger.info("데이터 소스: %s", ", ".join(sources) or "없음")

    def _get_from_cache_or_longer(self, ticker: str, period: str) -> pd.DataFrame | None:
        """캐시에서 요청 period 이상의 데이터가 있으면 슬라이싱해 반환. 없으면 None."""
        want_days = self._PERIOD_DAYS.get(period, 0)
        if want_days == 0:
            return None

        # 캐시에서 요청 period 이상 길이의 데이터 탐색
        best_df: pd.DataFrame | None = None
        best_days = 0
        for (t, p), df in self._history_cache.items():
            if t != ticker or df.empty:
                continue
            cached_days = self._PERIOD_DAYS.get(p, 0)
            if cached_days >= want_days and cached_days > best_days:
                best_df = df
                best_days = cached_days

        if best_df is not None and not best_df.empty:
            # 요청 기간만큼 tail 슬라이싱
            sliced = best_df.tail(want_days)
            return sliced

        return None

    def get_history(self, ticker: str, period: str = "3mo") -> pd.DataFrame:
        # 1. 캐시 적중 확인
        cache_key = (ticker, period)
        if cache_key in self._history_cache:
            return self._history_cache[cache_key]

        # 2. 더 긴 기간 캐시에서 슬라이싱 가능 여부 확인
        sliced = self._get_from_cache_or_longer(ticker, period)
        if sliced is not None:
            self._history_cache[cache_key] = sliced
            logger.info("%s: %d일치 수집 (캐시 슬라이싱)", ticker, len(sliced))
            return sliced

        # 3. 네트워크 수집
        if self.yf_available:
            try:
                t = yf.Ticker(ticker, session=self.yf_session)
                df = t.history(period=period)
                if not df.empty:
                    logger.info("%s: %d일치 수집", ticker, len(df))
                    self._history_cache[cache_key] = df
                    return df
            except Exception:
                logger.debug("%s yfinance 수집 실패", ticker)

        if self.finnhub_key:
            logger.debug("%s Finnhub fallback 시도", ticker)
            try:
                df = self._fetch_finnhub_history(ticker, period)
                if not df.empty:
                    self._history_cache[cache_key] = df
                return df
            except Exception:
                logger.debug("%s Finnhub 수집 실패", ticker)

        logger.warning("%s 수집 실패 — 빈 DataFrame 반환", ticker)
        empty = pd.DataFrame()
        self._history_cache[cache_key] = empty
        return empty

    def get_info(self, ticker: str) -> dict:
        if self.yf_available:
            try:
                t = yf.Ticker(ticker, session=self.yf_session)
                info = t.info
                if info:
                    return info
            except Exception:
                logger.debug("%s info 수집 실패", ticker)
        return {}

    def _fetch_finnhub_history(self, ticker: str, period: str) -> pd.DataFrame:
        import time
        import requests

        period_map = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365}
        days = period_map.get(period, 90)
        now = int(time.time())
        start = now - days * 86400

        url = "https://finnhub.io/api/v1/stock/candle"
        resp = requests.get(url, params={
            "symbol": ticker, "resolution": "D",
            "from": start, "to": now, "token": self.finnhub_key,
        })
        resp.raise_for_status()
        data = resp.json()

        if data.get("s") != "ok":
            return pd.DataFrame()

        df = pd.DataFrame({
            "Open": data["o"], "High": data["h"], "Low": data["l"],
            "Close": data["c"], "Volume": data["v"],
        }, index=pd.to_datetime(data["t"], unit="s"))
        df.index.name = "Date"
        logger.info("%s: %d일치 수집 (Finnhub)", ticker, len(df))
        return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    fetcher = USStockDataFetcher()

    hist = fetcher.get_history("AAPL", period="1mo")
    if not hist.empty:
        print(f"\nAAPL 최근 데이터:\n{hist.tail()}")

    info = fetcher.get_info("AAPL")
    if info:
        print(f"\nAAPL 정보:")
        for k in ["shortName", "sector", "marketCap", "trailingPE"]:
            print(f"  {k}: {info.get(k, 'N/A')}")
