import logging
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors.data_fetcher import USStockDataFetcher

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


class EnhancedSmartMoneyScreener:
    def __init__(self, data_dir: str = None):
        self.output_dir = Path(data_dir) if data_dir else OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)

        self.fetcher = USStockDataFetcher()

        self.volume_df: pd.DataFrame | None = None
        self.holdings_df: pd.DataFrame | None = None
        self.etf_df: pd.DataFrame | None = None
        self.stocks_df: pd.DataFrame | None = None
        self.spy_data: pd.DataFrame | None = None

        self._info_cache: dict[str, dict] = {}

        logger.info("EnhancedSmartMoneyScreener 초기화 (output: %s)", self.output_dir)

    def _filter_13f_no_lookahead(self, holdings_df: pd.DataFrame,
                                   as_of_date: datetime = None) -> pd.DataFrame:
        """13F look-ahead bias 방지 필터

        - filing_date <= as_of_date (공시일 기준)
        - report_period_of_report + 45일 <= as_of_date (실제 데이터 가용 시점)
        """
        if as_of_date is None:
            as_of_date = datetime.now()

        if 'filing_date' not in holdings_df.columns:
            return holdings_df

        # filing_date 기준 필터
        mask = pd.to_datetime(holdings_df['filing_date']) <= as_of_date

        # report_period_of_report + 45일 필터 (있는 경우)
        if 'report_period_of_report' in holdings_df.columns:
            period_mask = (
                pd.to_datetime(holdings_df['report_period_of_report']) +
                pd.Timedelta(days=45)
            ) <= as_of_date
            mask = mask & period_mask

        return holdings_df[mask].copy()

    def load_data(self) -> bool:
        base = self.output_dir
        data_dir = Path(__file__).resolve().parent.parent / "data"

        # 1. volume_df (필수)
        vol_path = base / "us_volume_analysis.csv"
        if vol_path.exists():
            self.volume_df = pd.read_csv(vol_path)
            logger.info("volume_df 로드: %d행 (%s)", len(self.volume_df), vol_path)
        else:
            logger.warning("volume_df 파일 없음: %s — 중단", vol_path)
            return False

        # 2. holdings_df (선택)
        holdings_path = base / "us_13f_holdings.csv"
        if holdings_path.exists():
            self.holdings_df = pd.read_csv(holdings_path)
            before = len(self.holdings_df)
            self.holdings_df = self._filter_13f_no_lookahead(self.holdings_df)
            logger.info("holdings_df 로드: %d→%d행 (look-ahead bias 필터)", before, len(self.holdings_df))
        else:
            logger.info("holdings_df 미제공 (선택): %s — 13f_score 기본값 50 사용", holdings_path)

        # 3. etf_df (선택)
        etf_path = base / "us_etf_flows.csv"
        if etf_path.exists():
            self.etf_df = pd.read_csv(etf_path)
            logger.info("etf_df 로드: %d행", len(self.etf_df))
        else:
            logger.info("etf_df 미제공 (선택): %s — ETF flow 미반영", etf_path)

        # 4. stocks_df (선택)
        stocks_path = data_dir / "us_stocks_list.csv"
        if stocks_path.exists():
            self.stocks_df = pd.read_csv(stocks_path)
            logger.info("stocks_df 로드: %d행", len(self.stocks_df))
        else:
            logger.info("stocks_df 미제공 (선택): %s — 종목 메타데이터 미반영", stocks_path)

        # 5. SPY 데이터
        self.spy_data = self.fetcher.get_history("SPY", period="3mo")
        if not self.spy_data.empty:
            logger.info("SPY 데이터 로드: %d일", len(self.spy_data))
        else:
            logger.warning("SPY 데이터 수집 실패")

        return True

    def _get_info_cached(self, ticker: str) -> dict:
        if ticker not in self._info_cache:
            self._info_cache[ticker] = self.fetcher.get_info(ticker)
        return self._info_cache[ticker]

    def get_relative_strength(self, ticker: str) -> float:
        if self.spy_data is None or self.spy_data.empty:
            return 0.0

        hist = self.fetcher.get_history(ticker, period="3mo")
        if hist.empty or len(hist) < 2:
            return 0.0

        spy_close = self.spy_data["Close"]
        lookback = min(20, len(hist) - 1, len(spy_close) - 1)

        stock_ret = (float(hist["Close"].iloc[-1]) / float(hist["Close"].iloc[-1 - lookback]) - 1) * 100
        spy_ret = (float(spy_close.iloc[-1]) / float(spy_close.iloc[-1 - lookback]) - 1) * 100

        return round(stock_ret - spy_ret, 1)

    def _calculate_volume_sd_score(self, ticker: str, lookback: int = 20) -> float:
        """거래량 표준편차 기반 수급 점수 (0-100)

        최근 거래량이 20일 평균 대비 얼마나 높은지
        높을수록 기관 매수 가능성
        """
        try:
            hist = self.fetcher.get_history(ticker, period="3mo")
            if hist.empty or len(hist) < lookback + 1:
                return 50.0

            vol_data = hist['Volume'].dropna()
            if len(vol_data) < lookback + 1:
                return 50.0

            rolling_mean = vol_data.rolling(lookback).mean()
            rolling_std = vol_data.rolling(lookback).std()

            current_vol = vol_data.iloc[-1]
            mean_vol = rolling_mean.iloc[-1]
            std_vol = rolling_std.iloc[-1]

            if std_vol == 0 or pd.isna(std_vol):
                return 50.0

            # Z-score를 0-100으로 정규화
            z_score = (current_vol - mean_vol) / std_vol
            # z=-3 → 0점, z=0 → 50점, z=3 → 100점
            normalized = min(100.0, max(0.0, (z_score + 3) / 6 * 100))
            return round(normalized, 1)
        except Exception:
            return 50.0

    def _get_momentum_score(self, ticker: str) -> float:
        """표준 크로스섹션 모멘텀 (Jegadeesh & Titman)

        12개월 수익률에서 최근 1개월 제외 (12-1 momentum)
        """
        try:
            hist = self.fetcher.get_history(ticker, period="1y")
            if hist.empty:
                return 50.0

            close = hist['Close'].dropna()
            if len(close) < 252:
                return 50.0

            # 각 기간 수익률
            ret_1m = (close.iloc[-1] / close.iloc[-21] - 1) * 100
            ret_3m = (close.iloc[-1] / close.iloc[-63] - 1) * 100
            ret_6m = (close.iloc[-1] / close.iloc[-126] - 1) * 100

            # 12-1 모멘텀 (skipping most recent month)
            ret_12_1 = (close.iloc[-21] / close.iloc[-252] - 1) * 100

            # 가중 합산 (최근 = 낮은 가중치)
            momentum = (ret_12_1 * 0.4 + ret_6m * 0.3 + ret_3m * 0.2 + ret_1m * 0.1)

            # 0-100 정규화 (momentum -50% → 0점, 0% → 50점, +50% → 100점)
            normalized = min(100.0, max(0.0, (momentum + 50) / 100 * 100))
            return round(normalized, 1)
        except Exception:
            return 50.0

    def _get_quality_score(self, ticker_info: dict) -> float:
        """간소화된 퀄리티 점수 (0-100)

        Piotroski F-Score 기반 지표들 중 yfinance로 획득 가능한 것들:
        1. ROE > 0 (수익성)
        2. FCF > 0 (현금흐름)
        3. 부채비율 개선 (D/E 비율)
        4. 유동비율 > 1 (단기 안정성)
        5. 순이익 증가율 > 0
        """
        try:
            score = 0.0
            max_score = 5.0

            # ROE > 0
            roe = ticker_info.get('returnOnEquity', None)
            if roe is not None and roe > 0:
                score += 1

            # FCF > 0 (freeCashflow)
            fcf = ticker_info.get('freeCashflow', None)
            if fcf is not None and fcf > 0:
                score += 1

            # D/E 비율 < 1 (보수적 기준)
            de_ratio = ticker_info.get('debtToEquity', None)
            if de_ratio is not None and de_ratio < 100:  # yfinance는 %, 100% = 1.0
                score += 1

            # 유동비율 > 1
            current_ratio = ticker_info.get('currentRatio', None)
            if current_ratio is not None and current_ratio > 1.0:
                score += 1

            # 순이익 마진 > 5%
            profit_margin = ticker_info.get('profitMargins', None)
            if profit_margin is not None and profit_margin > 0.05:
                score += 1

            return (score / max_score) * 100
        except Exception:
            return 50.0  # 데이터 없으면 중립

    @staticmethod
    def _default_technical() -> dict:
        return {
            "rsi": 50, "macd": 0, "macd_signal": 0, "macd_histogram": 0,
            "ma20": 0, "ma50": 0, "ma_signal": "Unknown",
            "cross_signal": "None", "technical_score": 50,
        }

    def get_technical_analysis(self, ticker: str) -> dict:
        hist = self.fetcher.get_history(ticker, period="1y")
        if hist.empty or len(hist) < 50:
            logger.warning("%s 데이터 부족 (%d일) — 기본값 반환", ticker, len(hist) if not hist.empty else 0)
            return self._default_technical()

        close = hist["Close"]

        # RSI 14일 (Wilder's Smoothing)
        delta = close.diff()
        gain = delta.where(delta > 0, 0).ewm(alpha=1/14, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
        rs = gain / loss
        rsi_series = 100 - (100 / (1 + rs))
        rsi = float(rsi_series.iloc[-1])

        # MACD
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram = macd_line - signal_line

        # 이동평균
        ma20 = float(close.rolling(20).mean().iloc[-1])
        ma50 = float(close.rolling(50).mean().iloc[-1])
        ma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else ma50

        price = float(close.iloc[-1])

        # MA 배열 판단
        if price > ma20 > ma50:
            ma_signal = "Bullish"
        elif price < ma20 < ma50:
            ma_signal = "Bearish"
        else:
            ma_signal = "Neutral"

        # Golden/Death Cross
        cross_signal = "None"
        if len(close) >= 205:
            ma50_now = float(close.rolling(50).mean().iloc[-1])
            ma200_now = float(close.rolling(200).mean().iloc[-1])
            ma50_5ago = float(close.rolling(50).mean().iloc[-6])
            ma200_5ago = float(close.rolling(200).mean().iloc[-6])

            if ma50_5ago <= ma200_5ago and ma50_now > ma200_now:
                cross_signal = "Golden Cross"
            elif ma50_5ago >= ma200_5ago and ma50_now < ma200_now:
                cross_signal = "Death Cross"

        # Technical Score (기본 50점)
        tech_score = 50

        # RSI 점수
        if rsi < 30:
            tech_score += 10 + int((30 - rsi) / 6)
        elif rsi < 45:
            tech_score += 10
        elif rsi < 60:
            tech_score += 8
        elif rsi < 70:
            tech_score += 2
        else:
            tech_score -= 5

        # MACD 점수
        hist_now = float(histogram.iloc[-1])
        hist_prev = float(histogram.iloc[-2])
        if hist_prev < 0 < hist_now:
            tech_score += 15
        elif hist_now > 0:
            tech_score += 8
        elif hist_now < 0:
            tech_score -= 5

        # MA 점수
        if ma_signal == "Bullish":
            tech_score += 15
        elif ma_signal == "Bearish":
            tech_score -= 10

        if cross_signal == "Golden Cross":
            tech_score += 10
        elif cross_signal == "Death Cross":
            tech_score -= 15

        tech_score = max(0, min(100, tech_score))

        return {
            "rsi": round(rsi, 2),
            "macd": round(float(macd_line.iloc[-1]), 4),
            "macd_signal": round(float(signal_line.iloc[-1]), 4),
            "macd_histogram": round(hist_now, 4),
            "ma20": round(ma20, 2),
            "ma50": round(ma50, 2),
            "ma_signal": ma_signal,
            "cross_signal": cross_signal,
            "technical_score": tech_score,
        }


    @staticmethod
    def _default_analyst() -> dict:
        return {
            "company_name": "Unknown", "current_price": 0,
            "target_mean": 0, "target_high": 0, "target_low": 0,
            "upside_pct": 0, "recommendation": "N/A",
            "num_analysts": 0, "analyst_score": 50,
        }

    def get_analyst_ratings(self, ticker: str) -> dict:
        info = self._get_info_cached(ticker)
        if not info:
            logger.warning("%s 애널리스트 정보 없음 — 기본값 반환", ticker)
            return self._default_analyst()

        name = info.get("longName") or info.get("shortName") or ticker
        price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        target_mean = info.get("targetMeanPrice") or 0
        target_high = info.get("targetHighPrice") or 0
        target_low = info.get("targetLowPrice") or 0
        rec = info.get("recommendationKey") or "N/A"
        num_analysts = info.get("numberOfAnalystOpinions") or 0

        upside = ((target_mean - price) / price * 100) if price > 0 and target_mean > 0 else 0

        # Analyst Score (기본 50점)
        score = 50

        rec_scores = {"strongBuy": 15, "strong_buy": 15, "buy": 10, "hold": 0,
                      "sell": -10, "strongSell": -15, "strong_sell": -15}
        score += rec_scores.get(rec, 0)

        if upside > 30:
            score += 10
        elif upside > 10:
            score += 5
        elif upside > 0:
            score += 2
        elif upside < 0:
            score -= 10

        if num_analysts > 10:
            score += 5

        score = max(0, min(100, score))

        return {
            "company_name": name,
            "current_price": round(price, 2),
            "target_mean": round(target_mean, 2),
            "target_high": round(target_high, 2),
            "target_low": round(target_low, 2),
            "upside_pct": round(upside, 2),
            "recommendation": rec,
            "num_analysts": num_analysts,
            "analyst_score": score,
        }

    @staticmethod
    def _default_fundamental() -> dict:
        return {
            "pe_trailing": 0, "pe_forward": 0, "pb": 0, "ps": 0,
            "revenue_growth": 0, "earnings_growth": 0,
            "profit_margin": 0, "roe": 0,
            "market_cap": 0, "market_cap_category": "Unknown",
            "dividend_yield": 0, "fundamental_score": 50,
        }

    def get_fundamental_analysis(self, ticker: str) -> dict:
        info = self._get_info_cached(ticker)
        if not info:
            logger.warning("%s 기본 정보 없음 — 기본값 반환", ticker)
            return self._default_fundamental()

        pe = info.get("trailingPE") or 0
        pe_fwd = info.get("forwardPE") or 0
        pb = info.get("priceToBook") or 0
        ps = info.get("priceToSalesTrailing12Months") or 0
        rev_growth = info.get("revenueGrowth") or 0
        earn_growth = info.get("earningsGrowth") or 0
        margin = info.get("profitMargins") or 0
        roe = info.get("returnOnEquity") or 0
        mcap = info.get("marketCap") or 0
        div_yield = info.get("dividendYield") or 0

        # 시가총액 분류
        if mcap > 200_000_000_000:
            cap_cat = "Mega Cap"
        elif mcap > 10_000_000_000:
            cap_cat = "Large Cap"
        elif mcap > 2_000_000_000:
            cap_cat = "Mid Cap"
        elif mcap > 300_000_000:
            cap_cat = "Small Cap"
        else:
            cap_cat = "Micro Cap"

        # Fundamental Score (기본 50점)
        score = 50

        # P/E 점수
        if pe < 0:
            score -= 15
        elif pe <= 15:
            score += 15
        elif pe <= 25:
            score += 10
        elif pe > 40:
            score -= 10

        # 매출성장 점수
        if rev_growth > 0.20:
            score += 15
        elif rev_growth > 0.10:
            score += 10
        elif rev_growth > 0:
            score += 5
        elif rev_growth < 0:
            score -= 10

        # ROE 점수
        if roe > 0.20:
            score += 10
        elif roe > 0.10:
            score += 5
        elif roe < 0:
            score -= 10

        score = max(0, min(100, score))

        # Quality score (Piotroski 간소화) 20% 반영
        quality_score = self._get_quality_score(info)
        score = int(score * 0.8 + quality_score * 0.2)
        score = max(0, min(100, score))

        return {
            "pe_trailing": round(pe, 2),
            "pe_forward": round(pe_fwd, 2),
            "pb": round(pb, 2),
            "ps": round(ps, 2),
            "revenue_growth": round(rev_growth * 100, 2),
            "earnings_growth": round(earn_growth * 100, 2),
            "profit_margin": round(margin * 100, 2),
            "roe": round(roe * 100, 2),
            "market_cap": mcap,
            "market_cap_category": cap_cat,
            "dividend_yield": round(div_yield * 100, 2),
            "fundamental_score": score,
        }


    @staticmethod
    def _classify_strategy_setup(tech: dict, rs_vs_spy: float) -> tuple[str, str]:
        """기술적 지표 기반 Strategy(Trend/Swing/Reversal) + Setup(Breakout/Pullback/Base) 분류."""
        rsi = tech.get("rsi", 50)
        ma_signal = tech.get("ma_signal", "Neutral")
        cross_signal = tech.get("cross_signal", "None")
        macd_hist = tech.get("macd_histogram", 0)

        # Strategy 분류
        if rsi < 30 or cross_signal == "Death Cross":
            strategy = "Reversal"
        elif ma_signal == "Bullish" and rs_vs_spy > 0:
            strategy = "Trend"
        else:
            strategy = "Swing"

        # Setup 분류
        if cross_signal == "Golden Cross" or (ma_signal == "Bullish" and rsi > 60):
            setup = "Breakout"
        elif ma_signal == "Bullish" and 40 <= rsi <= 55:
            setup = "Pullback"
        else:
            setup = "Base"

        return strategy, setup

    def calculate_composite_score(self, ticker: str) -> dict:
        tech = self.get_technical_analysis(ticker)
        fund = self.get_fundamental_analysis(ticker)
        analyst = self.get_analyst_ratings(ticker)
        rs_raw = self.get_relative_strength(ticker)

        # RS를 0~100 스케일로 보정 (-20% ~ +20% → 0 ~ 100)
        rs_score = max(0, min(100, 50 + rs_raw * 2.5))

        # volume_df에서 sd_score (없거나 NaN이면 직접 계산)
        sd_score = 50
        if self.volume_df is not None and "ticker" in self.volume_df.columns:
            row = self.volume_df[self.volume_df["ticker"] == ticker]
            if not row.empty and "sd_score" in row.columns:
                val = row.iloc[0]["sd_score"]
                if not pd.isna(val):
                    sd_score = float(val)
                else:
                    sd_score = self._calculate_volume_sd_score(ticker)
            else:
                sd_score = self._calculate_volume_sd_score(ticker)
        else:
            sd_score = self._calculate_volume_sd_score(ticker)

        # holdings_df에서 13f_score
        f13_score = 50
        if self.holdings_df is not None and "ticker" in self.holdings_df.columns:
            row = self.holdings_df[self.holdings_df["ticker"] == ticker]
            if not row.empty and "13f_score" in row.columns:
                f13_score = float(row.iloc[0]["13f_score"])

        # 가중 합산
        weights = {
            "technical": 0.25,
            "fundamental": 0.20,
            "analyst": 0.15,
            "relative_strength": 0.15,
            "volume": 0.15,
            "13f": 0.10,
        }
        scores = {
            "technical": tech["technical_score"],
            "fundamental": fund["fundamental_score"],
            "analyst": analyst["analyst_score"],
            "relative_strength": round(rs_score, 1),
            "volume": sd_score,
            "13f": f13_score,
        }
        composite = sum(scores[k] * weights[k] for k in weights)
        composite = round(max(0, min(100, composite)), 1)

        # 등급
        if composite >= 80:
            grade = "A"
            label = "Strong Accumulation"
        elif composite >= 65:
            grade = "B"
            label = "Moderate Accumulation"
        elif composite >= 50:
            grade = "C"
            label = "Neutral"
        elif composite >= 35:
            grade = "D"
            label = "Moderate Distribution"
        elif composite >= 20:
            grade = "E"
            label = "Strong Distribution"
        else:
            grade = "F"
            label = "Capitulation"

        # Strategy/Setup 분류
        strategy, setup = self._classify_strategy_setup(tech, rs_raw)

        return {
            "ticker": ticker,
            "company_name": analyst["company_name"],
            "composite_score": composite,
            "grade": grade,
            "grade_label": label,
            "strategy": strategy,
            "setup": setup,
            "scores": scores,
            "weights": weights,
            "technical": tech,
            "fundamental": fund,
            "analyst": analyst,
            "rs_vs_spy": rs_raw,
        }


    def run_screening(self) -> pd.DataFrame | None:
        import time
        try:
            from tqdm import tqdm
        except ImportError:
            tqdm = None

        if not self.load_data():
            logger.error("데이터 로드 실패 — 스크리닝 중단")
            return None

        tickers = self.volume_df["ticker"].tolist()
        logger.info("스크리닝 시작: %d개 종목", len(tickers))
        start = time.time()

        results = []
        iterator = tqdm(tickers, desc="스크리닝") if tqdm else tickers
        for ticker in iterator:
            try:
                score = self.calculate_composite_score(ticker)
                results.append({
                    "ticker": score["ticker"],
                    "company_name": score["company_name"],
                    "composite_score": score["composite_score"],
                    "grade": score["grade"],
                    "grade_label": score["grade_label"],
                    "strategy": score["strategy"],
                    "setup": score["setup"],
                    "technical_score": score["scores"]["technical"],
                    "fundamental_score": score["scores"]["fundamental"],
                    "analyst_score": score["scores"]["analyst"],
                    "rs_score": score["scores"]["relative_strength"],
                    "volume_score": score["scores"]["volume"],
                    "13f_score": score["scores"]["13f"],
                    "rs_vs_spy": score["rs_vs_spy"],
                })
            except Exception:
                logger.debug("%s 스크리닝 실패", ticker)

        elapsed = time.time() - start

        if not results:
            logger.warning("스크리닝 결과 없음")
            return None

        df = pd.DataFrame(results).sort_values("composite_score", ascending=False)
        top20 = df.head(20)

        out_path = self.output_dir / "smart_money_picks_v2.csv"
        top20.to_csv(out_path, index=False, encoding="utf-8-sig")

        logger.info("스크리닝 완료: %d종목, %.1f초", len(results), elapsed)
        logger.info("저장: %s (상위 %d개)", out_path, len(top20))
        logger.info("상위 5개:")
        for _, row in top20.head(5).iterrows():
            logger.info("  %s (%s) — %.1f점 [%s]",
                         row["ticker"], row["company_name"],
                         row["composite_score"], row["grade"])

        return top20


    def validate_results(self, path: str = None) -> bool:
        csv_path = Path(path) if path else self.output_dir / "smart_money_picks_v2.csv"
        passed, failed = 0, 0

        def check(name, ok, detail=""):
            nonlocal passed, failed
            if ok:
                passed += 1
                print(f"  ✅ PASS: {name} {detail}")
            else:
                failed += 1
                print(f"  ❌ FAIL: {name} {detail}")

        print(f"\n{'=' * 50}")
        print(f"  smart_money_picks_v2.csv 검증")
        print(f"{'=' * 50}")

        # 1. 파일 존재
        check("파일 존재", csv_path.exists(), str(csv_path))
        if not csv_path.exists():
            print(f"{'=' * 50}")
            print(f"  결과: {passed} passed, {failed} failed")
            return False

        df = pd.read_csv(csv_path)

        # 2. 행 수 > 0
        check("행 수 > 0", len(df) > 0, f"({len(df)}행)")

        # 3. 필수 컬럼
        required = ["ticker", "composite_score", "grade", "technical_score", "fundamental_score"]
        missing = [c for c in required if c not in df.columns]
        check("필수 컬럼", len(missing) == 0, f"누락: {missing}" if missing else "")

        # 4. composite_score 범위 0~100
        if "composite_score" in df.columns:
            in_range = df["composite_score"].between(0, 100).all()
            check("composite_score 0~100", in_range,
                  f"(min={df['composite_score'].min()}, max={df['composite_score'].max()})")

        # 5. grade 값
        valid_grades = {"A", "B", "C", "D", "E", "F"}
        if "grade" in df.columns:
            actual = set(df["grade"].unique())
            ok = actual.issubset(valid_grades)
            check("grade 유효값", ok, f"(값: {actual})")

        # 6. 중복 ticker
        if "ticker" in df.columns:
            dupes = df["ticker"].duplicated().sum()
            check("중복 ticker 없음", dupes == 0, f"({dupes}개 중복)" if dupes else "")

        # 7. NaN 비율 < 20%
        nan_pct = df.isna().sum().sum() / (len(df) * len(df.columns)) * 100
        check("NaN < 20%", nan_pct < 20, f"({nan_pct:.1f}%)")

        print(f"{'=' * 50}")
        all_pass = failed == 0
        print(f"  결과: {passed} passed, {failed} failed — {'검증 완료' if all_pass else '일부 실패'}")
        print(f"{'=' * 50}\n")
        return all_pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    screener = EnhancedSmartMoneyScreener(data_dir="output")
    screener.run_screening()
    screener.validate_results()
