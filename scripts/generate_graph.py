#!/usr/bin/env python3
"""
Knowledge Graph 데이터 생성.

두 가지 그래프를 생성한다:
  1. system_graph: 시스템 아키텍처 (데이터소스 → 수집 → 분석 → 신호 → 출력 → 페이지)
  2. stock_graph: 종목 네트워크 (상관관계 + 섹터 그룹)

Usage:
    .venv/bin/python3 scripts/generate_graph.py
"""
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DATA = ROOT / "frontend" / "public" / "data"

RISK_ALERTS_PATH = FRONTEND_DATA / "risk_alerts.json"
TOP10_PATH = ROOT / "output" / "final_top10_report.json"


# ── 시스템 아키텍처 그래프 ────────────────────────────────────────

SYSTEM_NODES = [
    # data_source
    {"id": "yahoo_finance", "name": "Yahoo Finance", "type": "data_source",
     "description": "주가·재무 OHLCV 데이터 (yfinance)"},
    {"id": "fred", "name": "FRED", "type": "data_source",
     "description": "연준 거시경제 지표 (금리, CPI 등)"},
    {"id": "vix", "name": "VIX Index", "type": "data_source",
     "description": "공포지수 — ^VIX (CBOE)"},
    {"id": "finnhub", "name": "Finnhub", "type": "data_source",
     "description": "애널리스트 의견 + 뉴스 피드"},
    {"id": "wikipedia", "name": "Wikipedia", "type": "data_source",
     "description": "S&P 500 종목 목록 (HTML 파싱)"},
    # collector
    {"id": "us_price_fetcher", "name": "USPriceFetcher", "type": "collector",
     "description": "S&P500 503종목 일별 OHLCV 수집 (curl_cffi)"},
    {"id": "macro_collector", "name": "MacroCollector", "type": "collector",
     "description": "VIX, FRED, Fear&Greed 거시 데이터 수집"},
    {"id": "sp500_list", "name": "SP500List", "type": "collector",
     "description": "Wikipedia에서 S&P500 종목+섹터 목록"},
    # analyzer
    {"id": "market_regime", "name": "MarketRegime", "type": "analyzer",
     "description": "5-Sensor 가중투표: VIX(30%) + Trend(25%) + Breadth(18%) + Credit(15%) + YieldCurve(12%)"},
    {"id": "market_gate", "name": "MarketGate", "type": "analyzer",
     "description": "11개 섹터 ETF 분석 → GO/CAUTION/STOP"},
    {"id": "smart_money", "name": "SmartMoney", "type": "analyzer",
     "description": "기술(25%) + 펀더멘털(20%) + 애널리스트(15%) + RS(15%) + 볼륨(15%) + 13F(10%)"},
    {"id": "ai_analysis", "name": "AIAnalysis", "type": "analyzer",
     "description": "Gemini/GPT/Perplexity 멀티 AI 분석 + 폴백"},
    {"id": "ml_predictor", "name": "MLPredictor (GBM)", "type": "analyzer",
     "description": "LightGBM — SPY/QQQ 5일 방향 예측 (bullish/bearish)"},
    {"id": "final_report_gen", "name": "FinalReportGen", "type": "analyzer",
     "description": "Quant + AI 점수 결합 → 최종 Top10 랭킹"},
    {"id": "risk_alert_engine", "name": "RiskAlertEngine", "type": "analyzer",
     "description": "Stop-loss / VaR / CDaR / 집중도 / 스트레스 테스트"},
    # signal
    {"id": "sig_regime", "name": "Regime Signal", "type": "signal",
     "description": "risk_on / neutral / risk_off / crisis"},
    {"id": "sig_gate", "name": "Gate Signal", "type": "signal",
     "description": "GO / CAUTION / STOP"},
    {"id": "sig_ml", "name": "ML Signal", "type": "signal",
     "description": "bullish / bearish + confidence %"},
    {"id": "sig_verdict", "name": "Verdict", "type": "signal",
     "description": "최종 진입 판정: GO / CAUTION / STOP"},
    # output
    {"id": "out_top_picks", "name": "TopPicks JSON", "type": "output",
     "description": "final_top10_report.json — 최종 추천 10종목"},
    {"id": "out_risk_alerts", "name": "RiskAlerts JSON", "type": "output",
     "description": "risk_alerts.json — 포지션·리스크 경보"},
    {"id": "out_performance", "name": "Performance JSON", "type": "output",
     "description": "performance.json — 전략 백테스트 시뮬레이션"},
    {"id": "out_daily_report", "name": "DailyReport JSON", "type": "output",
     "description": "daily_report_YYYYMMDD.json — 43개 일별 리포트"},
    # page
    {"id": "page_overview", "name": "Overview", "type": "page", "href": "/",
     "description": "메인 대시보드 — 시장 요약"},
    {"id": "page_regime", "name": "Market Regime", "type": "page", "href": "/regime",
     "description": "5-Sensor 레짐 분석"},
    {"id": "page_risk", "name": "Risk Monitor", "type": "page", "href": "/risk",
     "description": "포지션 리스크 + 스트레스 테스트"},
    {"id": "page_top_picks", "name": "Top Picks", "type": "page", "href": "/top-picks",
     "description": "Smart Money Top 10 종목"},
    {"id": "page_ai", "name": "AI Analysis", "type": "page", "href": "/ai",
     "description": "AI 종목별 투자 논리"},
    {"id": "page_forecast", "name": "Index Forecast", "type": "page", "href": "/forecast",
     "description": "SPY/QQQ 방향 예측"},
    {"id": "page_ml", "name": "ML Rankings", "type": "page", "href": "/ml",
     "description": "GBM 모델 종목 랭킹"},
    {"id": "page_performance", "name": "Performance", "type": "page", "href": "/performance",
     "description": "전략 백테스트 시뮬레이션"},
    {"id": "page_graph", "name": "System Graph", "type": "page", "href": "/graph",
     "description": "시스템 아키텍처 지식 그래프"},
]

SYSTEM_EDGES = [
    # data_source → collector
    {"source": "yahoo_finance", "target": "us_price_fetcher", "type": "feeds"},
    {"source": "yahoo_finance", "target": "macro_collector", "type": "feeds"},
    {"source": "fred", "target": "macro_collector", "type": "feeds"},
    {"source": "vix", "target": "macro_collector", "type": "feeds"},
    {"source": "finnhub", "target": "us_price_fetcher", "type": "feeds"},
    {"source": "wikipedia", "target": "sp500_list", "type": "feeds"},
    # collector → analyzer
    {"source": "us_price_fetcher", "target": "market_regime", "type": "feeds"},
    {"source": "us_price_fetcher", "target": "market_gate", "type": "feeds"},
    {"source": "us_price_fetcher", "target": "smart_money", "type": "feeds"},
    {"source": "us_price_fetcher", "target": "ml_predictor", "type": "feeds"},
    {"source": "macro_collector", "target": "market_regime", "type": "feeds"},
    {"source": "sp500_list", "target": "smart_money", "type": "feeds"},
    {"source": "sp500_list", "target": "us_price_fetcher", "type": "feeds"},
    # analyzer chain
    {"source": "smart_money", "target": "ai_analysis", "type": "feeds"},
    {"source": "smart_money", "target": "final_report_gen", "type": "feeds"},
    {"source": "ai_analysis", "target": "final_report_gen", "type": "enhances"},
    {"source": "final_report_gen", "target": "out_top_picks", "type": "produces"},
    {"source": "out_top_picks", "target": "risk_alert_engine", "type": "feeds"},
    {"source": "market_regime", "target": "risk_alert_engine", "type": "feeds"},
    # analyzer → signal
    {"source": "market_regime", "target": "sig_regime", "type": "produces"},
    {"source": "market_gate", "target": "sig_gate", "type": "produces"},
    {"source": "ml_predictor", "target": "sig_ml", "type": "produces"},
    # signal → verdict
    {"source": "sig_regime", "target": "sig_verdict", "type": "determines"},
    {"source": "sig_gate", "target": "sig_verdict", "type": "determines"},
    {"source": "sig_ml", "target": "sig_verdict", "type": "determines"},
    # verdict → output
    {"source": "sig_verdict", "target": "out_daily_report", "type": "gates"},
    {"source": "out_top_picks", "target": "out_daily_report", "type": "feeds"},
    {"source": "sig_regime", "target": "out_daily_report", "type": "feeds"},
    {"source": "risk_alert_engine", "target": "out_risk_alerts", "type": "produces"},
    {"source": "out_top_picks", "target": "out_performance", "type": "feeds"},
    {"source": "sig_verdict", "target": "out_performance", "type": "feeds"},
    # output → page
    {"source": "out_daily_report", "target": "page_overview", "type": "displays"},
    {"source": "sig_regime", "target": "page_regime", "type": "displays"},
    {"source": "sig_gate", "target": "page_regime", "type": "displays"},
    {"source": "out_risk_alerts", "target": "page_risk", "type": "displays"},
    {"source": "out_top_picks", "target": "page_top_picks", "type": "displays"},
    {"source": "ai_analysis", "target": "page_ai", "type": "displays"},
    {"source": "sig_ml", "target": "page_forecast", "type": "displays"},
    {"source": "ml_predictor", "target": "page_ml", "type": "displays"},
    {"source": "out_performance", "target": "page_performance", "type": "displays"},
    {"source": "out_top_picks", "target": "page_graph", "type": "displays"},
    {"source": "out_risk_alerts", "target": "page_graph", "type": "displays"},
]


# ── 종목 네트워크 그래프 ──────────────────────────────────────────

SECTOR_COLORS: dict[str, str] = {
    "Information Technology": "#60a5fa",
    "Health Care": "#4ade80",
    "Financials": "#facc15",
    "Consumer Discretionary": "#fb923c",
    "Communication Services": "#a78bfa",
    "Industrials": "#22d3ee",
    "Consumer Staples": "#f472b6",
    "Energy": "#fbbf24",
    "Utilities": "#86efac",
    "Real Estate": "#c084fc",
    "Materials": "#34d399",
    "Unknown": "#94a3b8",
}


def build_stock_graph() -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []

    # position_sizes에서 티커 + 가중치 추출
    tickers_info: dict[str, dict] = {}
    if RISK_ALERTS_PATH.exists():
        try:
            ra = json.loads(RISK_ALERTS_PATH.read_text(encoding="utf-8"))
            for pos in ra.get("position_sizes", []):
                ticker = pos.get("ticker", "")
                if ticker:
                    tickers_info[ticker] = {
                        "final_pct": pos.get("final_pct", 10),
                        "grade": pos.get("grade", "?"),
                    }
        except Exception as e:
            print(f"[WARN] risk_alerts.json 파싱 실패: {e}")

    # sector 정보 추가
    sector_map: dict[str, str] = {}
    if TOP10_PATH.exists():
        try:
            t10 = json.loads(TOP10_PATH.read_text(encoding="utf-8"))
            for pick in t10.get("top10", []):
                ticker = pick.get("ticker", "")
                sector = pick.get("sector", "Unknown")
                if ticker:
                    sector_map[ticker] = sector
        except Exception as e:
            print(f"[WARN] final_top10_report.json 파싱 실패: {e}")

    # 섹터 노드 (존재하는 섹터만)
    present_sectors: set[str] = set()
    for ticker, info in tickers_info.items():
        sector = sector_map.get(ticker, "Unknown")
        present_sectors.add(sector)

    for sector in sorted(present_sectors):
        nodes.append({
            "id": f"sector_{sector.replace(' ', '_')}",
            "name": sector,
            "type": "sector",
            "description": f"{sector} 섹터",
            "color": SECTOR_COLORS.get(sector, "#94a3b8"),
        })

    # 티커 노드
    for ticker, info in tickers_info.items():
        sector = sector_map.get(ticker, "Unknown")
        nodes.append({
            "id": ticker,
            "name": ticker,
            "type": "ticker",
            "description": f"Grade {info['grade']} · {info['final_pct']:.1f}% 비중",
            "sector": sector,
            "weight": info["final_pct"],
        })
        # 섹터 연결 엣지
        edges.append({
            "source": f"sector_{sector.replace(' ', '_')}",
            "target": ticker,
            "type": "sector_peer",
        })

    # 상관관계 엣지 (risk_alerts.json의 high_correlation_pairs)
    if RISK_ALERTS_PATH.exists():
        try:
            ra = json.loads(RISK_ALERTS_PATH.read_text(encoding="utf-8"))
            concentration = ra.get("concentration", {})
            corr_pairs = concentration.get("high_correlation_pairs", [])
            for item in corr_pairs:
                pair = item.get("pair", [])
                corr = item.get("corr", 0)
                if len(pair) == 2 and abs(corr) >= 0.3:
                    t1, t2 = pair[0], pair[1]
                    if t1 in tickers_info and t2 in tickers_info:
                        edges.append({
                            "source": t1,
                            "target": t2,
                            "type": "correlation",
                            "value": round(abs(corr), 3),
                            "label": f"r={corr:.2f}",
                        })
        except Exception as e:
            print(f"[WARN] 상관관계 파싱 실패: {e}")

    return {"nodes": nodes, "edges": edges}


def main():
    print("=== Knowledge Graph Generator ===")

    stock_graph = build_stock_graph()

    payload = {
        "generated_at": date.today().isoformat(),
        "system_graph": {
            "nodes": SYSTEM_NODES,
            "edges": SYSTEM_EDGES,
        },
        "stock_graph": stock_graph,
    }

    FRONTEND_DATA.mkdir(parents=True, exist_ok=True)
    out = FRONTEND_DATA / "graph.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✓ system_graph: {len(SYSTEM_NODES)}개 노드, {len(SYSTEM_EDGES)}개 엣지")
    print(f"✓ stock_graph: {len(stock_graph['nodes'])}개 노드, {len(stock_graph['edges'])}개 엣지")
    print(f"✓ {out} 저장 완료")


if __name__ == "__main__":
    main()
