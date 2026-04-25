"""섹터 히트맵 데이터 수집기 — 11개 섹터 × 10개 종목 (Part 7 Prompt 5).

각 섹터의 시총 상위 10개 종목의 단기 등락폭을 수집하여
output/sector_heatmap.json으로 저장한다.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_yf_session = None
try:
    from curl_cffi import requests as curl_requests
    _yf_session = curl_requests.Session(impersonate="chrome")
except ImportError:
    pass


class SectorHeatmapCollector:
    """11개 SPDR 섹터 ETF 및 대표 종목 등락폭 수집기."""

    def __init__(self):
        self.sector_etfs = {
            'XLK':  {'name': 'Technology',        'color': '#4A90A4'},
            'XLF':  {'name': 'Financials',         'color': '#6B8E23'},
            'XLV':  {'name': 'Healthcare',         'color': '#FF69B4'},
            'XLE':  {'name': 'Energy',             'color': '#FF6347'},
            'XLY':  {'name': 'Consumer Disc.',     'color': '#FFD700'},
            'XLP':  {'name': 'Consumer Staples',   'color': '#98D8C8'},
            'XLI':  {'name': 'Industrials',        'color': '#DDA0DD'},
            'XLB':  {'name': 'Materials',          'color': '#F0E68C'},
            'XLU':  {'name': 'Utilities',          'color': '#87CEEB'},
            'XLRE': {'name': 'Real Estate',        'color': '#CD853F'},
            'XLC':  {'name': 'Comm. Services',     'color': '#9370DB'},
        }

        self.sector_stocks: Dict[str, List[str]] = {
            'Technology':       ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD', 'ORCL', 'CRM', 'ADBE', 'CSCO', 'ACN'],
            'Financials':       ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'SCHW', 'C', 'AXP', 'SPGI'],
            'Healthcare':       ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN', 'BSX'],
            'Consumer Disc.':   ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'BKNG', 'SBUX', 'TJX', 'MAR'],
            'Consumer Staples': ['PG', 'KO', 'PEP', 'COST', 'WMT', 'PM', 'MDLZ', 'MO', 'CL', 'STZ'],
            'Energy':           ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PSX', 'MPC', 'VLO', 'OXY', 'HAL'],
            'Industrials':      ['GE', 'CAT', 'RTX', 'HON', 'UPS', 'BA', 'LMT', 'MMM', 'DE', 'FDX'],
            'Materials':        ['LIN', 'SHW', 'APD', 'ECL', 'FCX', 'NEM', 'PPG', 'ALB', 'VMC', 'NUE'],
            'Real Estate':      ['AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'WELL', 'DLR', 'AVB', 'O', 'EQR'],
            'Utilities':        ['NEE', 'DUK', 'SO', 'D', 'SRE', 'AEP', 'EXC', 'XEL', 'PCG', 'ETR'],
            'Comm. Services':   ['META', 'GOOGL', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'EA', 'TTWO', 'LYV'],
        }

        # 1d 기간 요청 시 5d 데이터를 받아 마지막 2일 비교
        self.period_map: Dict[str, str] = {
            '1d':  '5d',
            '1w':  '1mo',
            '1m':  '3mo',
            '3m':  '6mo',
            '6m':  '1y',
            '1y':  '2y',
        }

    def _download(self, tickers: List[str], period: str) -> pd.DataFrame:
        """공통 yfinance 다운로드 헬퍼. curl_cffi 세션으로 rate-limit 방지."""
        kwargs: Dict = {'period': period, 'auto_adjust': True, 'progress': False}
        if _yf_session:
            kwargs['session'] = _yf_session
        raw = yf.download(tickers, **kwargs)
        if raw.empty:
            return pd.DataFrame()
        if isinstance(raw.columns, pd.MultiIndex):
            return raw['Close'] if 'Close' in raw.columns.get_level_values(0) else pd.DataFrame()
        return raw

    def get_sector_performance(self, period: str = '1d') -> List[Dict]:
        """11개 섹터 ETF의 기간별 등락폭 수집."""
        fetch_period = self.period_map.get(period, '5d')
        tickers = list(self.sector_etfs.keys())
        prices = self._download(tickers, fetch_period)
        if prices.empty:
            return []

        result: List[Dict] = []
        for ticker, info in self.sector_etfs.items():
            if ticker not in prices.columns:
                continue
            series = prices[ticker].dropna()
            if len(series) < 2:
                continue
            current = float(series.iloc[-1])
            start = float(series.iloc[-2]) if period == '1d' else float(series.iloc[0])
            change_pct = round((current / start - 1) * 100, 2) if start else 0.0
            result.append({
                'ticker': ticker,
                'name': info['name'],
                'color': info['color'],
                'current_price': round(current, 2),
                'change_pct': change_pct,
                'volume': 0,
            })

        return result

    def get_stock_performance(self, sector: str, period: str = '1d') -> List[Dict]:
        """특정 섹터 내 대표 종목들의 등락폭 수집."""
        stocks = self.sector_stocks.get(sector, [])
        if not stocks:
            return []

        fetch_period = self.period_map.get(period, '5d')
        prices = self._download(stocks, fetch_period)
        if prices.empty:
            return []

        result: List[Dict] = []
        for ticker in stocks:
            if ticker not in prices.columns:
                continue
            series = prices[ticker].dropna()
            if len(series) < 2:
                continue
            current = float(series.iloc[-1])
            start = float(series.iloc[-2]) if period == '1d' else float(series.iloc[0])
            change_pct = round((current / start - 1) * 100, 2) if start else 0.0
            result.append({
                'ticker': ticker,
                'name': ticker,
                'change_pct': change_pct,
                'current_price': round(current, 2),
                'volume': 0,
            })

        return result

    def save_data(self, output_dir: Optional[str] = None) -> None:
        """섹터 히트맵 데이터 수집 후 output/sector_heatmap.json 저장."""
        out_dir = Path(output_dir) if output_dir else Path('output')
        out_dir.mkdir(parents=True, exist_ok=True)

        sectors = self.get_sector_performance('1d')
        payload = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'sectors_count': len(sectors),
            },
            'data': sectors,
        }
        path = out_dir / 'sector_heatmap.json'
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
        logger.info("sector_heatmap.json saved: %s (%d sectors)", path, len(sectors))
