"""US Stock Market — 통합 분석 파이프라인
Phase 0: 데이터 수집 (incremental)
Phase 1: 시장 분석 (Market Timing) — regime + gate + ML predictor
Phase 2: 종목 선별 (Stock Selection) — volume + smart money screening
Phase 3: 종합 리포트 — verdict + action 매핑
"""
import json
import logging
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent  # project root
REPORTS_DIR = BASE_DIR / "output" / "reports"
LOGS_DIR = BASE_DIR / "logs"
OUTPUT_DIR = BASE_DIR / "output"
DATA_DIR = BASE_DIR / "data"


def setup_dirs():
    for d in [REPORTS_DIR, LOGS_DIR, OUTPUT_DIR, DATA_DIR]:
        d.mkdir(exist_ok=True)


def setup_file_logger(log_path: Path):
    """파일 로거 설정."""
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.INFO)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logging.getLogger().addHandler(fh)
    return fh


# ── Phase 0: 데이터 수집 ──────────────────────────────────────────

def phase0_data_collection() -> dict:
    """데이터 수집 — stale이면 incremental, 없으면 full collection."""
    logger.info("=" * 60)
    logger.info("[Phase 0] 데이터 수집")
    t0 = time.time()

    from pipeline.us_data_pipeline import USDataPipeline
    pipeline = USDataPipeline()

    result = {}
    if pipeline.is_data_stale(str(DATA_DIR)):
        # incremental 시도
        inc = pipeline.incremental_update(top_n=50, output_dir=str(DATA_DIR))
        if inc is None:
            # CSV 없으면 전체 수집
            result = pipeline.run_full_collection(top_n=10, period="1y", output_dir=str(DATA_DIR))
            result["method"] = "full"
        else:
            result = inc
            result["method"] = "incremental"
    else:
        logger.info("데이터가 최신 상태 — 수집 건너뜀")
        result = {"method": "skipped"}

    logger.info("[Phase 0] 완료 (%.1f초) — %s", time.time() - t0, result.get("method", ""))
    return result


# ── Phase 1: 시장 분석 (Market Timing) ────────────────────────────

def phase1_market_timing() -> dict:
    """시장 체제 + 게이트 + ML 지수 예측 → verdict 결정."""
    logger.info("=" * 60)
    logger.info("[Phase 1] 시장 분석 (Market Timing)")
    t0 = time.time()

    timing = {}

    # 1/3: Market Regime Detection
    try:
        from analyzers.market_regime import MarketRegimeDetector
        detector = MarketRegimeDetector()
        regime_result = detector.detect()
        detector.save_result(regime_result)
        detector.save_config(regime_result)
        timing["regime"] = regime_result["final_regime"]
        timing["regime_score"] = regime_result["weighted_score"]
        timing["regime_confidence"] = regime_result["confidence"]
        logger.info("  Regime: %s (score=%.2f, confidence=%.0f%%)",
                     timing["regime"], timing["regime_score"], timing["regime_confidence"])
    except Exception as e:
        logger.error("  Regime 감지 실패: %s", e)
        timing["regime"] = "neutral"
        timing["regime_score"] = 1.5
        timing["regime_confidence"] = 50

    # 2/3: Sector Gate Signal
    try:
        from analyzers.market_gate import run_market_gate
        gate_result = run_market_gate()
        timing["gate"] = gate_result.gate
        timing["gate_score"] = gate_result.score
        logger.info("  Gate: %s (score=%.0f)", timing["gate"], timing["gate_score"])
    except Exception as e:
        logger.error("  Gate 분석 실패: %s", e)
        timing["gate"] = "CAUTION"
        timing["gate_score"] = 50

    # 3/3: Index Predictor ML
    try:
        from us_market.index_predictor import IndexPredictor
        predictor = IndexPredictor(data_dir=".")
        idx_pred = predictor.predict_next_week()
        timing["ml_predictor"] = idx_pred.get("predictions", {})
        spy_pred = timing["ml_predictor"].get("spy", {})
        qqq_pred = timing["ml_predictor"].get("qqq", {})
        logger.info("  ML SPY: %s (%.1f%%), QQQ: %s (%.1f%%)",
                     spy_pred.get("direction", "N/A"), spy_pred.get("probability", 0) * 100,
                     qqq_pred.get("direction", "N/A"), qqq_pred.get("probability", 0) * 100)
    except Exception as e:
        logger.error("  ML 예측 실패: %s", e)
        timing["ml_predictor"] = {}

    # Verdict 판정
    regime = timing["regime"]
    gate = timing["gate"]
    spy_dir = timing.get("ml_predictor", {}).get("spy", {}).get("direction", "")

    regime_ok = regime in ("risk_on", "neutral")
    gate_go = gate == "GO"
    ml_bullish = spy_dir == "bullish"

    if regime in ("crisis", "risk_off") or gate == "STOP":
        verdict = "STOP"
    elif regime_ok and gate_go and ml_bullish:
        verdict = "GO"
    else:
        verdict = "CAUTION"

    timing["verdict"] = verdict
    logger.info("  Verdict: %s (regime=%s, gate=%s, ml=%s)", verdict, regime, gate, spy_dir)
    logger.info("[Phase 1] 완료 (%.1f초)", time.time() - t0)
    return timing


# ── Phase 2: 종목 선별 (Stock Selection) ──────────────────────────

def phase2_stock_selection() -> list[dict]:
    """Volume Analysis + Smart Money Screening."""
    logger.info("=" * 60)
    logger.info("[Phase 2] 종목 선별 (Stock Selection)")
    t0 = time.time()

    import pandas as pd

    # volume 데이터 준비
    sp500_path = DATA_DIR / "sp500_list.csv"
    if sp500_path.exists():
        sp500 = pd.read_csv(sp500_path)
        OUTPUT_DIR.mkdir(exist_ok=True)
        pd.DataFrame({"ticker": sp500["Symbol"], "sd_score": 50}).to_csv(
            OUTPUT_DIR / "us_volume_analysis.csv", index=False)

    from analyzers.smart_money_screener_v2 import EnhancedSmartMoneyScreener
    screener = EnhancedSmartMoneyScreener(data_dir=str(OUTPUT_DIR))
    top20 = screener.run_screening()

    picks = []
    if top20 is not None:
        for _, row in top20.iterrows():
            picks.append(row.to_dict())
        logger.info("  선별 종목: %d개", len(picks))

        # 날짜별 CSV 저장
        result_dir = BASE_DIR / "result"
        result_dir.mkdir(exist_ok=True)
        today = datetime.now().strftime("%Y%m%d")
        top20.to_csv(result_dir / f"smart_money_picks_{today}.csv", index=False, encoding="utf-8-sig")

    logger.info("[Phase 2] 완료 (%.1f초)", time.time() - t0)
    return picks


# ── Phase 3: 종합 리포트 ──────────────────────────────────────────

def _assign_action(verdict: str, grade: str) -> str:
    """Verdict + Grade → Action 매핑."""
    if verdict == "GO":
        if grade in ("A", "B"):
            return "BUY"
        return "WATCH"
    elif verdict == "CAUTION":
        if grade == "A":
            return "SMALL BUY"
        return "WATCH"
    else:  # STOP
        return "HOLD"


def phase3_report(timing: dict, picks: list[dict]) -> dict:
    """종합 리포트 생성 — daily_report_YYYYMMDD.json."""
    logger.info("=" * 60)
    logger.info("[Phase 3] 종합 리포트 생성")
    t0 = time.time()

    verdict = timing.get("verdict", "CAUTION")
    now = datetime.now()

    # Action 매핑
    for pick in picks:
        grade = pick.get("grade", "C")
        pick["action"] = _assign_action(verdict, grade)

    # 분포 계산
    grade_dist = {}
    strategy_dist = {}
    action_dist = {}
    for pick in picks:
        g = pick.get("grade", "?")
        grade_dist[g] = grade_dist.get(g, 0) + 1
        s = pick.get("strategy", "Unknown")
        strategy_dist[s] = strategy_dist.get(s, 0) + 1
        a = pick.get("action", "?")
        action_dist[a] = action_dist.get(a, 0) + 1

    report = {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "data_date": now.strftime("%Y-%m-%d"),
        "market_timing": {
            "regime": timing.get("regime", "neutral"),
            "regime_score": timing.get("regime_score", 0),
            "regime_confidence": timing.get("regime_confidence", 0),
            "gate": timing.get("gate", "CAUTION"),
            "gate_score": timing.get("gate_score", 0),
            "ml_predictor": timing.get("ml_predictor", {}),
        },
        "verdict": verdict,
        "stock_picks": picks,
        "summary": {
            "total_screened": len(picks),
            "grade_distribution": grade_dist,
            "strategy_distribution": strategy_dist,
            "action_distribution": action_dist,
        },
    }

    # 저장: reports/daily_report_YYYYMMDD.json
    today = now.strftime("%Y%m%d")
    daily_path = REPORTS_DIR / f"daily_report_{today}.json"
    with open(daily_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    logger.info("  리포트 저장: %s", daily_path)

    # latest_report.json 업데이트 (복사)
    latest_path = REPORTS_DIR / "latest_report.json"
    shutil.copy2(daily_path, latest_path)
    logger.info("  최신 리포트: %s", latest_path)

    # output/에도 대시보드용 복사
    out_latest = OUTPUT_DIR / "latest_report.json"
    shutil.copy2(daily_path, out_latest)

    logger.info("[Phase 3] 완료 (%.1f초)", time.time() - t0)
    return report


# ── 메인 ──────────────────────────────────────────────────────────

def run_integrated_analysis() -> dict:
    """전체 통합 분석 실행."""
    setup_dirs()

    start = datetime.now()
    today = start.strftime("%Y%m%d")
    log_path = LOGS_DIR / f"daily_run_{today}.log"
    fh = setup_file_logger(log_path)

    print()
    print("=" * 65)
    print("  US Stock Market — Integrated Analysis")
    print(f"  {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    try:
        # Phase 0: 데이터 수집
        data_result = phase0_data_collection()

        # Phase 1: 시장 분석
        timing = phase1_market_timing()

        # Phase 2: 종목 선별
        picks = phase2_stock_selection()

        # Phase 3: 종합 리포트
        report = phase3_report(timing, picks)

        # 종합 요약
        elapsed = (datetime.now() - start).total_seconds()
        print(f"\n{'=' * 65}")
        print(f"  종합 요약")
        print(f"{'=' * 65}")
        print(f"  Verdict: {report['verdict']}")
        print(f"  Regime: {timing.get('regime', 'N/A').upper()} "
              f"(score={timing.get('regime_score', 0):.2f}, "
              f"confidence={timing.get('regime_confidence', 0):.0f}%)")
        print(f"  Gate: {timing.get('gate', 'N/A')} (score={timing.get('gate_score', 0):.0f})")

        spy_pred = timing.get("ml_predictor", {}).get("spy", {})
        qqq_pred = timing.get("ml_predictor", {}).get("qqq", {})
        if spy_pred:
            print(f"  ML SPY: {spy_pred.get('direction', 'N/A').upper()} "
                  f"({spy_pred.get('predicted_return', 0):+.2f}%, "
                  f"신뢰도 {spy_pred.get('confidence_pct', 0):.0f}%)")
        if qqq_pred:
            print(f"  ML QQQ: {qqq_pred.get('direction', 'N/A').upper()} "
                  f"({qqq_pred.get('predicted_return', 0):+.2f}%, "
                  f"신뢰도 {qqq_pred.get('confidence_pct', 0):.0f}%)")

        if picks:
            print(f"\n  Top Picks ({len(picks)}종목):")
            for i, p in enumerate(picks[:10], 1):
                print(f"    {i:>2}. {p.get('ticker', '?'):>6} — "
                      f"{p.get('composite_score', 0):.1f}점 [{p.get('grade', '?')}] "
                      f"{p.get('strategy', '')}/{p.get('setup', '')} → {p.get('action', '?')}")

        print(f"\n  리포트: {REPORTS_DIR / f'daily_report_{today}.json'}")
        print(f"  로그: {log_path}")
        print(f"  총 소요 시간: {elapsed:.1f}초")
        print(f"{'=' * 65}")

        return report

    finally:
        logging.getLogger().removeHandler(fh)
        fh.close()


if __name__ == "__main__":
    run_integrated_analysis()
