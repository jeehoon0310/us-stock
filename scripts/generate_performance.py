#!/usr/bin/env python3
"""Smart Money Top 10 수익률 시뮬레이션 생성.

오늘(Apr 14) 기준 Top 10 종목을 각 거래일에 균등 매입했을 때의
현재까지 수익률을 yfinance 역사 데이터로 계산.

Usage:
    .venv/bin/python3 scripts/generate_performance.py
"""
import json
from datetime import date, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "output" / "reports"
FRONTEND_DATA = ROOT / "frontend" / "public" / "data"

MARKET_HOLIDAYS_2026 = {
    date(2026, 1, 1),   # New Year's Day
    date(2026, 1, 19),  # MLK Day
    date(2026, 2, 16),  # Presidents Day
    date(2026, 4, 3),   # Good Friday
}


def get_trading_days(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5 and cur not in MARKET_HOLIDAYS_2026:
            days.append(cur)
        cur += timedelta(days=1)
    return days


def main():
    try:
        import yfinance as yf
        import pandas as pd
    except ImportError:
        print("[ERROR] yfinance 또는 pandas 미설치")
        sys.exit(1)

    # 1. 최신 리포트에서 Top 10 종목 추출
    latest_path = REPORTS_DIR / "daily_report_20260414.json"
    if not latest_path.exists():
        # fallback: latest_report.json
        latest_path = REPORTS_DIR / "latest_report.json"
    data = json.loads(latest_path.read_text(encoding="utf-8"))
    picks = data.get("stock_picks", [])[:10]
    tickers = [p["ticker"] for p in picks]
    ticker_meta = {p["ticker"]: p for p in picks}

    print(f"Top 10 종목: {tickers}")
    print("yfinance 역사 데이터 다운로드 중 (2개월)...")

    # 2. 일별 종가 한 번에 다운로드
    raw = yf.download(tickers, start="2026-02-10", end="2026-04-15",
                      progress=False, auto_adjust=True)
    if raw.empty:
        print("[ERROR] yfinance 데이터 없음")
        sys.exit(1)

    close = raw["Close"] if "Close" in raw.columns else raw

    # 3. 거래일 목록 (2달치)
    trading_days = get_trading_days(date(2026, 2, 17), date(2026, 4, 14))

    # 4. 현재가 (최신 거래일)
    current_row = close.iloc[-1]
    current_date_str = close.index[-1].strftime("%Y-%m-%d")

    # 5. 각 매입 날짜별 수익률 계산
    portfolios = []
    for buy_date in trading_days:
        buy_ts = pd.Timestamp(buy_date)
        # 해당 날짜 이전 또는 당일 최근 거래일
        valid = close.index[close.index <= buy_ts]
        if len(valid) == 0:
            continue
        row = close.loc[valid[-1]]

        holdings = []
        returns = []
        for ticker in tickers:
            buy_p = float(row.get(ticker, float("nan")))
            cur_p = float(current_row.get(ticker, float("nan")))
            import math
            if math.isnan(buy_p) or math.isnan(cur_p) or buy_p == 0:
                continue
            ret_pct = round((cur_p - buy_p) / buy_p * 100, 2)
            holdings.append({
                "ticker": ticker,
                "company_name": ticker_meta[ticker].get("company_name", ""),
                "buy_price": round(buy_p, 2),
                "current_price": round(cur_p, 2),
                "return_pct": ret_pct,
            })
            returns.append(ret_pct)

        if not returns:
            continue

        portfolio_return = round(sum(returns) / len(returns), 2)
        days_held = (date(2026, 4, 14) - buy_date).days

        best = max(holdings, key=lambda x: x["return_pct"])
        worst = min(holdings, key=lambda x: x["return_pct"])

        portfolios.append({
            "buy_date": buy_date.isoformat(),
            "days_held": days_held,
            "portfolio_return_pct": portfolio_return,
            "best_pick": {"ticker": best["ticker"], "return_pct": best["return_pct"]},
            "worst_pick": {"ticker": worst["ticker"], "return_pct": worst["return_pct"]},
            "holdings": sorted(holdings, key=lambda x: x["return_pct"], reverse=True),
        })

    payload = {
        "generated_at": current_date_str,
        "current_date": "2026-04-14",
        "note": "Apr 14 기준 Top 10 종목을 각 날짜에 균등 매입 가정 (10% each)",
        "tickers": tickers,
        "portfolios": portfolios,
    }

    FRONTEND_DATA.mkdir(parents=True, exist_ok=True)
    out = FRONTEND_DATA / "performance.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ {out} 생성 완료 ({len(portfolios)}개 포트폴리오)")

    if portfolios:
        best = max(portfolios, key=lambda x: x["portfolio_return_pct"])
        worst = min(portfolios, key=lambda x: x["portfolio_return_pct"])
        print(f"  최고 매입일: {best['buy_date']} → {best['portfolio_return_pct']:+.1f}%")
        print(f"  최악 매입일: {worst['buy_date']} → {worst['portfolio_return_pct']:+.1f}%")


if __name__ == "__main__":
    main()
