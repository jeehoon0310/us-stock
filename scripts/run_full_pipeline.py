"""US Stock Market — 전체 파이프라인 (데이터 수집 → 체제 감지 → 스크리닝 → AI 분석 → 최종 리포트)"""
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def timed(name):
    """단계별 소요 시간 측정 데코레이터"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.info("=" * 60)
            logger.info("[%s] 시작", name)
            t0 = time.time()
            try:
                result = func(*args, **kwargs)
                elapsed = time.time() - t0
                logger.info("[%s] 완료 (%.1f초)", name, elapsed)
                return result
            except Exception as e:
                elapsed = time.time() - t0
                logger.error("[%s] 실패 (%.1f초): %s", name, elapsed, e)
                return None
        return wrapper
    return decorator


@timed("1. 데이터 수집")
def step_data_collection():
    from pipeline.us_data_pipeline import USDataPipeline
    pipeline = USDataPipeline()
    return pipeline.run_full_collection(top_n=10, period="1y", output_dir="data")


@timed("2. 시장 체제 감지")
def step_regime_detection():
    from analyzers.market_regime import MarketRegimeDetector
    detector = MarketRegimeDetector()
    result = detector.detect()
    detector.save_result(result)
    detector.save_config(result)
    return result


@timed("3. 시장 게이트")
def step_market_gate(session=None):
    from analyzers.market_gate import run_market_gate
    return run_market_gate(session=session)


@timed("9. 대시보드 JSON 내보내기")
def step_export_dashboard(gate=None, gbm_df=None):
    """Persist dashboard-facing JSONs (market_gate.json, gbm_predictions.json,
    enrich final_top10_report.json with company_name)."""
    from regen_dashboard_data import (
        save_market_gate_json,
        save_gbm_json,
        enrich_top10_with_company_names,
    )
    save_market_gate_json(gate=gate)
    save_gbm_json(gbm_df=gbm_df)
    enrich_top10_with_company_names()


@timed("4. 스마트머니 스크리닝")
def step_screening():
    import pandas as pd

    # volume 데이터 준비
    sp500_path = Path("sp500_list.csv")
    if not sp500_path.exists():
        sp500_path = Path("data/sp500_list.csv")
    if sp500_path.exists():
        sp500 = pd.read_csv(sp500_path)
        Path("output").mkdir(exist_ok=True)
        pd.DataFrame({"ticker": sp500["Symbol"], "sd_score": 50}).to_csv(
            "output/us_volume_analysis.csv", index=False)

    from analyzers.smart_money_screener_v2 import EnhancedSmartMoneyScreener
    screener = EnhancedSmartMoneyScreener(data_dir="output")
    return screener.run_screening()


@timed("5. AI 분석")
def step_ai_analysis(top_n=10):
    import json
    import pandas as pd
    from analyzers.ai_summary_generator import NewsCollector, get_ai_provider

    csv_path = Path("output/smart_money_picks_v2.csv")
    if not csv_path.exists():
        logger.warning("스크리닝 결과 없음 — AI 분석 건너뜀")
        return None

    df = pd.read_csv(csv_path)
    col = "종목" if "종목" in df.columns else "ticker"
    tickers = df[col].head(top_n).tolist()

    collector = NewsCollector()
    ai = get_ai_provider("gemini")
    results = {}

    for i, ticker in enumerate(tickers):
        news = collector.get_news_for_ticker(ticker)
        row = df[df[col] == ticker]
        data = row.iloc[0].to_dict() if not row.empty else {}
        summary = ai.generate_summary(ticker, data, news)
        try:
            results[ticker] = json.loads(summary)
        except json.JSONDecodeError:
            # 부분 JSON에서 recommendation 추출 시도
            import re
            m = re.search(r'"recommendation"\s*:\s*"([^"]+)"', summary)
            rec = m.group(1) if m else "N/A(parse-fail)"
            results[ticker] = {"raw": summary, "recommendation": rec}
        logger.info("  [%d/%d] %s: %s", i + 1, len(tickers), ticker,
                     results[ticker].get("recommendation", "N/A"))

    out_path = Path("output/ai_summaries.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    return results


@timed("6. 최종 리포트")
def step_final_report():
    from analyzers.final_report_generator import FinalReportGenerator
    gen = FinalReportGenerator()
    return gen.generate_report()


@timed("7. GBM 예측 (ML)")
def step_gbm_inference():
    """LightGBM 기반 cross-sectional Top 20 예측 (ml-team 산출물)."""
    try:
        from ml.pipeline.predict import predict_top_candidates
        return predict_top_candidates(top_n=20)
    except Exception as e:
        logger.warning("GBM 예측 실패 (모델 미학습 가능): %s", e)
        return None


@timed("8. 지수 방향 예측 (IndexPredictor ML)")
def step_index_prediction():
    """SPY/QQQ 5일 forward 방향 예측 (us_market/index_predictor.py 27 피처 GBM 재사용).

    2026-04-05 service-evolver cycle #2: 이미 존재하는 GBM 모듈을 파이프라인에 노출.
    """
    try:
        from us_market.index_predictor import IndexPredictor
        predictor = IndexPredictor(data_dir='.')
        return predictor.predict_next_week()
    except Exception as e:
        logger.warning("지수 예측 실패 (데이터/모델 부족 가능): %s", e)
        return None


def main():
    start = datetime.now()
    print()
    print("=" * 65)
    print("  US Stock Market Analysis — Full Pipeline")
    print(f"  {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    # 1. 데이터 수집
    step_data_collection()

    # 2. 시장 체제
    regime = step_regime_detection()

    # 3. 시장 게이트
    gate = step_market_gate()

    # 4. 스크리닝
    screening = step_screening()

    # 5. AI 분석
    ai_results = step_ai_analysis(top_n=10)

    # 6. 최종 리포트
    top10 = step_final_report()

    # 7. GBM 예측 (ML)
    gbm_top20 = step_gbm_inference()

    # 8. 지수 방향 예측 (SPY/QQQ)
    idx_pred = step_index_prediction()

    # 9. 대시보드 JSON 내보내기 (sector gate, gbm rankings, company_name 보강)
    step_export_dashboard(gate=gate, gbm_df=gbm_top20)

    # 종합 요약
    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n{'=' * 65}")
    print(f"  종합 요약")
    print(f"{'=' * 65}")

    if regime:
        params = {"risk_on": "-10%", "neutral": "-8%", "risk_off": "-5%", "crisis": "-3%"}
        print(f"  시장 체제: {regime['final_regime'].upper()} (점수: {regime['weighted_score']}, 신뢰도: {regime['confidence']}%)")
        print(f"  stop_loss: {params.get(regime['final_regime'], 'N/A')}")

    if gate:
        print(f"  시장 게이트: {gate.gate} (점수: {gate.score})")

    if screening is not None:
        print(f"  스크리닝: {len(screening)}종목 선별")

    if ai_results:
        print(f"  AI 분석: {len(ai_results)}종목 완료 (Gemini)")

    if top10:
        print(f"\n  Final Top 10:")
        for i, r in enumerate(top10, 1):
            print(f"    {i:>2}. {r['ticker']:>6} — 최종 {r['final_score']:.1f}점 [{r['grade']}] (AI: {r['ai_recommendation']})")

    if gbm_top20 is not None and not gbm_top20.empty:
        print(f"\n  GBM Top 10 (ML):")
        for _, r in gbm_top20.head(10).iterrows():
            print(f"    {r['gbm_rank']:>2}. {r['ticker']:>6} — GBM score {r['gbm_score']:+.4f}")

    if idx_pred and idx_pred.get("predictions"):
        print(f"\n  지수 5일 방향 예측 (IndexPredictor):")
        for ticker in ["spy", "qqq"]:
            p = idx_pred["predictions"].get(ticker, {})
            if p:
                print(f"    {ticker.upper()}: {p.get('direction', 'N/A').upper()} "
                      f"({p.get('predicted_return', 0):+.2f}%, "
                      f"신뢰도 {p.get('confidence_pct', 0):.0f}% / {p.get('confidence', '')})")

    print(f"\n  총 소요 시간: {elapsed:.1f}초")
    print(f"{'=' * 65}")

    # API 비용 요약
    from analyzers.ai_summary_generator import usage_tracker
    usage_tracker.print_summary()


if __name__ == "__main__":
    main()
