"""옵션 플로우 분석기 — 개별 종목 옵션 체인 분석 (Part 7 Prompt 6-9).

워치리스트 종목의 옵션 Put/Call Ratio, 미결제약정, 내재변동성을 분석하여
기관 투자자 심리를 판단한다. 워치리스트는 output/picks/의 최신 CSV에서 로드.
"""

import glob
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

_DEFAULT_WATCHLIST = [
    'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN',
    'META', 'GOOGL', 'SPY',  'QQQ',  'AMD',
    'NFLX', 'BA',   'DIS',  'COIN', 'PLTR',
]


class OptionsFlowAnalyzer:
    """워치리스트 종목의 옵션 플로우 분석기."""

    def __init__(self, data_dir: str = '.'):
        self.data_dir = Path(data_dir)
        self.watchlist = self._load_from_screener()
        logger.info("OptionsFlowAnalyzer initialized: %d tickers", len(self.watchlist))

    def _load_from_screener(self, top_n: int = 15) -> List[str]:
        """output/picks/ 최신 smart_money_picks_YYYYMMDD.csv에서 ticker 로드.

        파일 없으면 기본 15개 반환.
        """
        picks_dir = self.data_dir / 'output' / 'picks'
        files = sorted(glob.glob(str(picks_dir / 'smart_money_picks_*.csv')))
        if not files:
            return list(_DEFAULT_WATCHLIST)
        try:
            df = pd.read_csv(files[-1])
            col = next((c for c in df.columns if c.lower() == 'ticker'), None)
            if col is None:
                return list(_DEFAULT_WATCHLIST)
            tickers = df[col].dropna().astype(str).unique().tolist()[:top_n]
            return tickers if tickers else list(_DEFAULT_WATCHLIST)
        except Exception as e:
            logger.warning("_load_from_screener error: %s", e)
            return list(_DEFAULT_WATCHLIST)

    def get_options_summary(self, ticker: str) -> Dict:
        """개별 종목 옵션 체인 분석 (P/C Ratio, OI, IV, Unusual Activity)."""
        try:
            stock = yf.Ticker(ticker)
            if _yf_session:
                stock.session = _yf_session

            expirations = stock.options
            if not expirations:
                return {'ticker': ticker, 'error': 'No options data available'}

            expiry = expirations[0]
            chain = stock.option_chain(expiry)
            calls, puts = chain.calls, chain.puts

            total_call_volume = int(calls['volume'].fillna(0).sum())
            total_put_volume  = int(puts['volume'].fillna(0).sum())
            total_call_oi     = int(calls['openInterest'].fillna(0).sum())
            total_put_oi      = int(puts['openInterest'].fillna(0).sum())

            pc_vol_ratio = round(total_put_volume / total_call_volume, 3) if total_call_volume > 0 else 99.0
            pc_oi_ratio  = round(total_put_oi     / total_call_oi,     3) if total_call_oi     > 0 else 99.0

            max_call_strike = (
                float(calls.loc[calls['openInterest'].fillna(0).idxmax(), 'strike'])
                if not calls.empty else None
            )
            max_put_strike = (
                float(puts.loc[puts['openInterest'].fillna(0).idxmax(), 'strike'])
                if not puts.empty else None
            )

            # 평균 거래량 3배 초과 = Unusual
            call_mean = calls['volume'].fillna(0).mean()
            put_mean  = puts['volume'].fillna(0).mean()
            unusual_calls = int((calls['volume'].fillna(0) > call_mean * 3).sum())
            unusual_puts  = int((puts['volume'].fillna(0) > put_mean  * 3).sum())

            # 내재변동성 (컬럼명이 버전마다 다를 수 있음)
            iv_col_c = next((c for c in calls.columns if 'implied' in c.lower()), None)
            iv_col_p = next((c for c in puts.columns  if 'implied' in c.lower()), None)
            avg_call_iv = round(float(calls[iv_col_c].fillna(0).mean()) * 100, 2) if iv_col_c else 0.0
            avg_put_iv  = round(float(puts[iv_col_p].fillna(0).mean())  * 100, 2) if iv_col_p else 0.0

            # 현재가
            hist = stock.history(period='1d')
            current_price = float(hist['Close'].iloc[-1]) if not hist.empty else 0.0

            signal = self._interpret_signal(pc_vol_ratio, pc_oi_ratio, unusual_calls, unusual_puts)

            return {
                'ticker':             ticker,
                'expiration':         expiry,
                'current_price':      round(current_price, 2),
                'total_call_volume':  total_call_volume,
                'total_put_volume':   total_put_volume,
                'total_call_oi':      total_call_oi,
                'total_put_oi':       total_put_oi,
                'pc_vol_ratio':       pc_vol_ratio,
                'pc_oi_ratio':        pc_oi_ratio,
                'max_call_strike':    max_call_strike,
                'max_put_strike':     max_put_strike,
                'unusual_calls':      unusual_calls,
                'unusual_puts':       unusual_puts,
                'unusual_call_count': unusual_calls,
                'unusual_put_count':  unusual_puts,
                'avg_call_iv':        avg_call_iv,
                'avg_put_iv':         avg_put_iv,
                **signal,
            }
        except Exception as e:
            logger.warning("get_options_summary(%s) error: %s", ticker, e)
            return {'ticker': ticker, 'error': str(e)}

    def _interpret_signal(
        self,
        pc_vol_ratio: float,
        pc_oi_ratio: float,
        unusual_calls: int,
        unusual_puts: int,
    ) -> Dict:
        """P/C Volume Ratio 기반 시장 심리 해석."""
        if pc_vol_ratio < 0.5:
            sentiment, score = 'Very Bullish', 90
        elif pc_vol_ratio < 0.7:
            sentiment, score = 'Bullish', 70
        elif pc_vol_ratio < 1.0:
            sentiment, score = 'Neutral', 50
        elif pc_vol_ratio < 1.3:
            sentiment, score = 'Bearish', 30
        else:
            sentiment, score = 'Very Bearish', 10

        if unusual_calls > unusual_puts * 2:
            activity = 'Heavy Call Buying'
        elif unusual_puts > unusual_calls * 2:
            activity = 'Heavy Put Buying'
        elif unusual_calls > 3 or unusual_puts > 3:
            activity = 'High Unusual Activity'
        else:
            activity = 'Normal Activity'

        return {'sentiment': sentiment, 'sentiment_score': score, 'activity': activity}

    def analyze_watchlist(self) -> List[Dict]:
        """워치리스트 전종목 옵션 분석, Unusual Activity 내림차순 정렬."""
        results = []
        for ticker in self.watchlist:
            summary = self.get_options_summary(ticker)
            if 'error' not in summary:
                results.append(summary)

        results.sort(
            key=lambda x: x.get('unusual_call_count', 0) + x.get('unusual_put_count', 0),
            reverse=True,
        )
        return results

    def save_data(self, output_dir: Optional[str] = None) -> None:
        """워치리스트 분석 결과를 output/options_flow.json으로 저장."""
        out_dir = Path(output_dir) if output_dir else self.data_dir / 'output'
        out_dir.mkdir(parents=True, exist_ok=True)

        # watchlist_source: 실제 로드한 파일명 또는 'default'
        picks_dir = self.data_dir / 'output' / 'picks'
        files = sorted(glob.glob(str(picks_dir / 'smart_money_picks_*.csv')))
        source = Path(files[-1]).name if files else 'default'

        data = self.analyze_watchlist()
        payload = {
            'metadata': {
                'generated_at':    datetime.now().isoformat(),
                'stocks_analyzed': len(data),
                'watchlist_source': source,
            },
            'data': data,
        }
        path = out_dir / 'options_flow.json'
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
        logger.info("options_flow.json saved: %s (%d stocks)", path, len(data))

    def analyze_earnings_impact(self, ticker: str) -> Dict:
        """실적 발표 전후 주가 반응 및 현재 IV 분석."""
        try:
            stock = yf.Ticker(ticker)
            if _yf_session:
                stock.session = _yf_session

            # 다음 실적 발표일
            next_earnings: Optional[str] = None
            try:
                cal = stock.calendar
                if isinstance(cal, pd.DataFrame) and not cal.empty:
                    date_val = cal.get('Earnings Date')
                    if date_val is not None and hasattr(date_val, 'iloc'):
                        next_earnings = str(date_val.iloc[0])[:10]
                elif isinstance(cal, dict):
                    ed = cal.get('Earnings Date')
                    if ed:
                        next_earnings = str(ed[0] if isinstance(ed, list) else ed)[:10]
            except Exception:
                pass

            # 과거 실적 반응 (최대 4분기)
            historical_reactions: List[Dict] = []
            try:
                hist_all = stock.history(period='2y')
                earnings_hist = getattr(stock, 'earnings_history', None)
                if earnings_hist is None or (hasattr(earnings_hist, 'empty') and earnings_hist.empty):
                    earnings_hist = getattr(stock, 'quarterly_earnings', None)

                if earnings_hist is not None and not (hasattr(earnings_hist, 'empty') and earnings_hist.empty):
                    for i, (date_idx, row) in enumerate(earnings_hist.iterrows()):
                        if i >= 4:
                            break
                        try:
                            e_date = pd.to_datetime(date_idx)
                            window = hist_all[
                                (hist_all.index >= e_date - pd.Timedelta(days=1)) &
                                (hist_all.index <= e_date + pd.Timedelta(days=5))
                            ]
                            if len(window) < 2:
                                continue
                            reaction = round(
                                (float(window['Close'].iloc[-1]) / float(window['Close'].iloc[0]) - 1) * 100, 2
                            )
                            surprise_pct = row.get('Surprise(%)', None)
                            surprise = bool(float(surprise_pct) > 0) if surprise_pct is not None else None
                            historical_reactions.append({
                                'quarter':           str(date_idx)[:7],
                                'surprise':          surprise,
                                'price_reaction_pct': reaction,
                            })
                        except Exception:
                            continue
            except Exception:
                pass

            # 현재 IV (가장 가까운 만기 ATM 콜 중앙값)
            current_iv = 0.0
            try:
                exps = stock.options
                if exps:
                    chain = stock.option_chain(exps[0])
                    iv_col = next((c for c in chain.calls.columns if 'implied' in c.lower()), None)
                    if iv_col:
                        current_iv = round(float(chain.calls[iv_col].median()) * 100, 2)
            except Exception:
                pass

            pos = [r['price_reaction_pct'] for r in historical_reactions if r['price_reaction_pct'] > 0]
            neg = [r['price_reaction_pct'] for r in historical_reactions if r['price_reaction_pct'] <= 0]

            return {
                'ticker':               ticker,
                'next_earnings_date':   next_earnings,
                'historical_reactions': historical_reactions,
                'avg_positive_reaction': round(sum(pos) / len(pos), 2) if pos else 0.0,
                'avg_negative_reaction': round(sum(neg) / len(neg), 2) if neg else 0.0,
                'current_iv':           current_iv,
            }

        except Exception as e:
            logger.warning("analyze_earnings_impact(%s) error: %s", ticker, e)
            return {'ticker': ticker, 'error': str(e)}
