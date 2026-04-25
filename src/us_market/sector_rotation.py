"""섹터 순환 추적기 — 경기 사이클 판단 및 주도 섹터 도출 (Part 7 Prompt 1-4).

11개 SPDR 섹터 ETF의 다기간 수익률을 기반으로 Early/Mid/Late/Recession
4개 경기 국면을 판단한다. 가중치는 output/regime_config.json의
sector_rotation 키로 오버라이드 가능.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_yf_session = None
try:
    from curl_cffi import requests as curl_requests
    _yf_session = curl_requests.Session(impersonate="chrome")
except ImportError:
    pass


class SectorRotationTracker:
    """경기 사이클 기반 섹터 순환 추적기."""

    SECTOR_ETFS = {
        'XLK':  'Technology',
        'XLF':  'Financials',
        'XLV':  'Healthcare',
        'XLY':  'Consumer Disc.',
        'XLP':  'Consumer Staples',
        'XLE':  'Energy',
        'XLI':  'Industrials',
        'XLB':  'Materials',
        'XLRE': 'Real Estate',
        'XLU':  'Utilities',
        'XLC':  'Comm. Services',
    }

    CYCLE_MAP = {
        'Early Cycle': ['XLF', 'XLY', 'XLI'],
        'Mid Cycle':   ['XLK', 'XLC', 'XLB'],
        'Late Cycle':  ['XLE', 'XLRE'],
        'Recession':   ['XLU', 'XLP', 'XLV'],
    }

    CYCLE_ANGLES = {
        'Early Cycle': 45,
        'Mid Cycle':   135,
        'Late Cycle':  225,
        'Recession':   315,
    }

    def __init__(self, data_dir: str = '.'):
        self.data_dir = Path(data_dir)
        self.output_file = self.data_dir / 'output' / 'sector_rotation.json'
        self.phase_weight_1w = 0.25
        self.phase_weight_1m = 0.40
        self.phase_weight_3m = 0.35
        self._load_regime_config()
        logger.info("SectorRotationTracker initialized: data_dir=%s", self.data_dir)

    def _load_regime_config(self) -> None:
        """output/regime_config.json의 sector_rotation 키로 가중치 오버라이드."""
        config_path = self.data_dir / 'output' / 'regime_config.json'
        try:
            with open(config_path) as f:
                config = json.load(f)
            sr = config.get('sector_rotation', {})
            if 'phase_weight_1w' in sr:
                self.phase_weight_1w = float(sr['phase_weight_1w'])
            if 'phase_weight_1m' in sr:
                self.phase_weight_1m = float(sr['phase_weight_1m'])
            if 'phase_weight_3m' in sr:
                self.phase_weight_3m = float(sr['phase_weight_3m'])
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            pass

    def _extract_close(self, raw: pd.DataFrame) -> pd.DataFrame:
        """yfinance 반환 DataFrame에서 Close 컬럼 추출."""
        if isinstance(raw.columns, pd.MultiIndex):
            if 'Close' in raw.columns.get_level_values(0):
                return raw['Close']
            if 'Price' in raw.columns.get_level_values(0):
                return raw['Price']
        if 'Close' in raw.columns:
            return raw[['Close']].rename(columns={'Close': raw.columns[0]})
        return raw

    def get_multi_period_performance(self) -> Dict:
        """11개 섹터 ETF + SPY의 5개 기간별 수익률 계산.

        yfinance 세션: curl_cffi Session(impersonate="chrome") 사용 (rate-limit 방지)
        """
        tickers = list(self.SECTOR_ETFS.keys()) + ['SPY']
        try:
            kwargs: Dict = {'period': '1y', 'auto_adjust': True, 'progress': False}
            if _yf_session:
                kwargs['session'] = _yf_session
            raw = yf.download(tickers, **kwargs)
            if raw.empty:
                return {}
            prices = self._extract_close(raw)
        except Exception as e:
            logger.warning("get_multi_period_performance error: %s", e)
            return {}

        period_days = {'1w': 7, '1m': 30, '3m': 90, '6m': 180, '12m': 365}
        result: Dict = {}

        for ticker in tickers:
            if ticker not in prices.columns:
                continue
            series = prices[ticker].dropna()
            if series.empty:
                continue
            current = float(series.iloc[-1])
            entry: Dict = {
                'name': self.SECTOR_ETFS.get(ticker, ticker),
                'current_price': round(current, 2),
            }
            for label, days in period_days.items():
                idx = max(0, len(series) - days)
                start = float(series.iloc[idx])
                entry[label] = round((current / start - 1) * 100, 2) if start else 0.0
            result[ticker] = entry

        return result

    def calculate_relative_strength_history(self, weeks: int = 12) -> Dict:
        """SPY 대비 각 섹터의 주간 상대 수익률 히스토리 (금요일 기준 리샘플).

        yfinance 세션: curl_cffi Session(impersonate="chrome") 사용 (rate-limit 방지)
        """
        days_needed = weeks * 7 + 14
        tickers = list(self.SECTOR_ETFS.keys()) + ['SPY']
        try:
            kwargs: Dict = {'period': f'{days_needed}d', 'auto_adjust': True, 'progress': False}
            if _yf_session:
                kwargs['session'] = _yf_session
            raw = yf.download(tickers, **kwargs)
            if raw.empty:
                return {}
            prices = self._extract_close(raw)
        except Exception as e:
            logger.warning("calculate_relative_strength_history error: %s", e)
            return {}

        if 'SPY' not in prices.columns:
            return {}

        weekly = prices.resample('W-FRI').last()
        spy_ret = weekly['SPY'].pct_change().dropna()
        if len(spy_ret) < 2:
            return {}

        result: Dict = {'dates': [d.strftime('%Y-%m-%d') for d in spy_ret.index]}
        for ticker in self.SECTOR_ETFS:
            if ticker not in weekly.columns:
                continue
            sector_ret = weekly[ticker].pct_change().reindex(spy_ret.index)
            rel = ((sector_ret - spy_ret) * 100).round(2).tolist()
            result[ticker] = [0.0 if pd.isna(v) else v for v in rel]

        return result

    def detect_cycle_phase(self, performance: Dict) -> Dict:
        """섹터 수익률 가중 평균을 통한 현재 경기 국면 도출."""
        if not performance:
            return {}

        spy = performance.get('SPY', {})
        spy_w = (
            spy.get('1w', 0) * self.phase_weight_1w
            + spy.get('1m', 0) * self.phase_weight_1m
            + spy.get('3m', 0) * self.phase_weight_3m
        )

        phase_scores: Dict[str, float] = {}
        for phase, etfs in self.CYCLE_MAP.items():
            scores = []
            for etf in etfs:
                if etf not in performance:
                    continue
                d = performance[etf]
                weighted = (
                    d.get('1w', 0) * self.phase_weight_1w
                    + d.get('1m', 0) * self.phase_weight_1m
                    + d.get('3m', 0) * self.phase_weight_3m
                )
                scores.append(weighted - spy_w)
            phase_scores[phase] = round(sum(scores) / len(scores), 2) if scores else 0.0

        current_phase = max(phase_scores, key=phase_scores.get)

        sector_excess: Dict[str, float] = {
            ticker: (
                d.get('1w', 0) * self.phase_weight_1w
                + d.get('1m', 0) * self.phase_weight_1m
                + d.get('3m', 0) * self.phase_weight_3m
            ) - spy_w
            for ticker, d in performance.items()
            if ticker != 'SPY'
        }
        sorted_sectors: List[str] = sorted(sector_excess, key=sector_excess.get, reverse=True)

        return {
            'current_phase': current_phase,
            'phase_scores': phase_scores,
            'leading_sectors': sorted_sectors[:3],
            'lagging_sectors': sorted_sectors[-3:],
            'angle': self.CYCLE_ANGLES[current_phase],
        }
