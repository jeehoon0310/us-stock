import json
import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


class MarketRegimeDetector:
    VIX_BOUNDARIES = {
        "risk_on": (0, 16),
        "neutral": (16, 22),
        "risk_off": (22, 30),
        "crisis": (30, 999),
    }

    def __init__(self):
        self.yf_session = None
        try:
            from curl_cffi import requests as curl_requests
            self.yf_session = curl_requests.Session(impersonate="chrome")
            logger.info("curl_cffi 세션 활성화")
        except ImportError:
            pass

    def _fetch_series(self, ticker: str, period: str = "6mo") -> pd.Series | None:
        try:
            df = yf.download(ticker, period=period, progress=False, session=self.yf_session)
            if df.empty:
                logger.warning("데이터 없음: %s", ticker)
                return None
            series = df["Close"].squeeze()
            series.name = ticker
            logger.info("%s: %d일치 수집", ticker, len(series))
            return series
        except Exception:
            logger.exception("수집 실패: %s", ticker)
            return None

    def _vix_signal(self, vix_series: pd.Series) -> dict:
        current = float(vix_series.iloc[-1])

        if len(vix_series) >= 20:
            ma20 = float(vix_series.rolling(20).mean().iloc[-1])
        else:
            ma20 = current

        trend = "falling" if current < ma20 else "rising"

        regime = "crisis"
        for name, (lo, hi) in self.VIX_BOUNDARIES.items():
            if lo <= current < hi:
                regime = name
                break

        return {
            "vix_current": round(current, 2),
            "vix_ma20": round(ma20, 2),
            "vix_trend": trend,
            "vix_regime": regime,
        }

    def _trend_signal(self, spy_series: pd.Series) -> dict:
        if len(spy_series) < 200:
            return {
                "trend_regime": "neutral",
                "spy_above_50": None,
                "spy_above_200": None,
                "sma200_slope": None,
                "data_insufficient": True,
            }

        current = float(spy_series.iloc[-1])
        sma50 = float(spy_series.rolling(50).mean().iloc[-1])
        sma200 = float(spy_series.rolling(200).mean().iloc[-1])
        sma200_20ago = float(spy_series.rolling(200).mean().iloc[-21])

        slope = sma200 - sma200_20ago
        above_50 = current > sma50
        above_200 = current > sma200

        if above_50 and above_200 and slope > 0:
            regime = "risk_on"
        elif above_200:
            regime = "neutral"
        elif not above_200 and slope < 0:
            regime = "risk_off"
        else:
            regime = "neutral"

        return {
            "trend_regime": regime,
            "spy_above_50": above_50,
            "spy_above_200": above_200,
            "sma200_slope": round(slope, 4),
        }

    def _breadth_signal(self) -> dict:
        fallback = {"breadth_ratio": None, "breadth_regime": "neutral"}
        try:
            rsp = self._fetch_series("RSP", period="3mo")
            spy = self._fetch_series("SPY", period="3mo")
            if rsp is None or spy is None:
                logger.debug("RSP/SPY 수집 실패 — neutral 반환")
                return fallback

            # RSP/SPY 상대강도 비율 (Equal Weight vs Cap Weight)
            ratio = rsp / spy
            ratio = ratio.dropna()
            if len(ratio) < 20:
                logger.debug("RSP/SPY 데이터 부족 — neutral 반환")
                return fallback

            current_ratio = float(ratio.iloc[-1])
            ma20_ratio = float(ratio.rolling(20).mean().iloc[-1])
            pct_change = (current_ratio / ma20_ratio - 1) * 100

            # 상대강도 변화율 기준 breadth 판단
            # RSP가 SPY보다 강하면 시장 참여 폭이 넓음
            if pct_change > 1.0:
                regime = "risk_on"
            elif pct_change > -0.5:
                regime = "neutral"
            elif pct_change > -2.0:
                regime = "risk_off"
            else:
                regime = "crisis"

            return {
                "breadth_ratio": round(current_ratio, 4),
                "breadth_ratio_ma20": round(ma20_ratio, 4),
                "breadth_pct_change": round(pct_change, 2),
                "breadth_regime": regime,
            }
        except Exception:
            logger.debug("breadth 처리 실패", exc_info=True)
            return fallback

    def _credit_spread_signal(self) -> dict:
        fallback = {"credit_ratio": None, "credit_regime": "neutral"}
        try:
            hyg = self._fetch_series("HYG", period="3mo")
            ief = self._fetch_series("IEF", period="3mo")
            if hyg is None or ief is None:
                logger.debug("HYG/IEF 수집 실패 — neutral 반환")
                return fallback

            ratio = hyg / ief
            ratio = ratio.dropna()
            if len(ratio) < 20:
                logger.debug("HYG/IEF 데이터 부족 — neutral 반환")
                return fallback

            current = float(ratio.iloc[-1])
            ma20 = float(ratio.rolling(20).mean().iloc[-1])

            if current > ma20 * 1.01:
                regime = "risk_on"
            elif current > ma20 * 0.99:
                regime = "neutral"
            elif current > ma20 * 0.97:
                regime = "risk_off"
            else:
                regime = "crisis"

            return {
                "credit_ratio": round(current, 4),
                "credit_ratio_ma20": round(ma20, 4),
                "credit_regime": regime,
            }
        except Exception:
            logger.debug("credit spread 처리 실패", exc_info=True)
            return fallback

    def _yield_curve_signal(self) -> dict:
        fallback = {"yield_spread": None, "yield_regime": "neutral"}
        try:
            tnx = self._fetch_series("^TNX", period="3mo")
            irx = self._fetch_series("^IRX", period="3mo")
            if tnx is None or irx is None:
                logger.debug("^TNX/^IRX 수집 실패 — neutral 반환")
                return fallback

            spread = float(tnx.iloc[-1]) - float(irx.iloc[-1])

            if spread > 0.5:
                regime = "risk_on"
            elif spread > 0:
                regime = "neutral"
            else:
                regime = "risk_off"

            return {"yield_spread": round(spread, 2), "yield_regime": regime}
        except Exception:
            logger.debug("yield curve 처리 실패", exc_info=True)
            return fallback

    REGIME_SCORES = {"risk_on": 0, "neutral": 1, "risk_off": 2, "crisis": 3}
    SIGNAL_WEIGHTS = {
        "vix": 0.30,
        "trend": 0.25,
        "breadth": 0.18,
        "credit": 0.15,
        "yield_curve": 0.12,
    }

    def detect(self) -> dict:
        from collections import Counter

        # 1. 데이터 수집
        vix_series = self._fetch_series("^VIX", period="3mo")
        spy_series = self._fetch_series("SPY", period="1y")

        # 2. 5개 신호 수집
        signals = {}
        signals["vix"] = self._vix_signal(vix_series) if vix_series is not None else {"vix_regime": "neutral"}
        signals["trend"] = self._trend_signal(spy_series) if spy_series is not None else {"trend_regime": "neutral"}
        signals["breadth"] = self._breadth_signal()
        signals["credit"] = self._credit_spread_signal()
        signals["yield_curve"] = self._yield_curve_signal()

        # 3. 점수 계산
        regimes = {
            "vix": signals["vix"].get("vix_regime", "neutral"),
            "trend": signals["trend"].get("trend_regime", "neutral"),
            "breadth": signals["breadth"].get("breadth_regime", "neutral"),
            "credit": signals["credit"].get("credit_regime", "neutral"),
            "yield_curve": signals["yield_curve"].get("yield_regime", "neutral"),
        }

        # 4. 가중 합산
        weighted_score = sum(
            self.REGIME_SCORES[regimes[k]] * self.SIGNAL_WEIGHTS[k]
            for k in self.SIGNAL_WEIGHTS
        )

        # 5. 최종 체제
        if weighted_score < 0.75:
            final_regime = "risk_on"
        elif weighted_score < 1.5:
            final_regime = "neutral"
        elif weighted_score < 2.25:
            final_regime = "risk_off"
        else:
            final_regime = "crisis"

        # 6. Confidence (다수결 일치 비율)
        regime_counts = Counter(regimes.values())
        majority_count = regime_counts.most_common(1)[0][1]
        confidence = round(majority_count / len(regimes) * 100, 1)

        result = {
            "final_regime": final_regime,
            "weighted_score": round(weighted_score, 3),
            "confidence": confidence,
            "signals": regimes,
            "details": signals,
        }

        logger.info("최종 체제: %s (점수: %.3f, 신뢰도: %.1f%%)", final_regime, weighted_score, confidence)
        return result

    ADAPTIVE_PARAMS = {
        "risk_on": {"stop_loss": -0.10, "max_drawdown_warning": -0.12},
        "neutral": {"stop_loss": -0.08, "max_drawdown_warning": -0.10},
        "risk_off": {"stop_loss": -0.05, "max_drawdown_warning": -0.07},
        "crisis": {"stop_loss": -0.03, "max_drawdown_warning": -0.05},
    }

    def save_config(self, result: dict, filename: str = "regime_config.json"):
        regime = result["final_regime"]
        params = self.ADAPTIVE_PARAMS[regime]
        config = {
            "regime": regime,
            "weighted_score": result["weighted_score"],
            "confidence": result["confidence"],
            "signals": result["signals"],
            "adaptive_params": {
                "stop_loss": f"{params['stop_loss']:.0%}",
                "max_drawdown_warning": f"{params['max_drawdown_warning']:.0%}",
            },
        }
        path = OUTPUT_DIR / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2, default=str)
        logger.info("설정 저장: %s (stop_loss=%s, mdd=%s)",
                     path, config["adaptive_params"]["stop_loss"],
                     config["adaptive_params"]["max_drawdown_warning"])
        return str(path)

    def save_result(self, result: dict, filename: str = "regime_result.json"):
        path = OUTPUT_DIR / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        logger.info("결과 저장: %s", path)
        return str(path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    detector = MarketRegimeDetector()
    result = detector.detect()

    print(f"\n최종 체제: {result['final_regime']}")
    print(f"가중 점수: {result['weighted_score']}")
    print(f"신뢰도: {result['confidence']}%")
    print(f"\n개별 신호:")
    for name, regime in result["signals"].items():
        print(f"  {name}: {regime}")

    detector.save_result(result)
    detector.save_config(result)

    # 적응형 파라미터 출력
    params = detector.ADAPTIVE_PARAMS[result["final_regime"]]
    print(f"\n적응형 파라미터:")
    print(f"  stop_loss: {params['stop_loss']:.0%}")
    print(f"  max_drawdown_warning: {params['max_drawdown_warning']:.0%}")
