#!/usr/bin/env python3
"""Regenerate dashboard JSON files from current pipeline outputs + fresh market gate.

Produces three files for the dashboard:
  - output/market_gate.json        (11 sectors GO/CAUTION/STOP + SPY divergence)
  - output/gbm_predictions.json    (cross-sectional ML ranking, top 20)
  - output/final_top10_report.json (enriched in-place with company_name + sector)

Callable standalone, or import save_* functions from run_full_pipeline.py.
"""
from __future__ import annotations

import csv
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
DATA_DIR = ROOT / "data"


def _make_session():
    try:
        from curl_cffi import requests as curl_requests
        return curl_requests.Session(impersonate="chrome")
    except ImportError:
        return None


def _divergence_label(signal: str) -> str:
    return {
        "bullish_climax": "강세 클라이맥스 — 바닥에서 거래량 폭발 + 가격↓. 매수 신호.",
        "bearish_climax": "약세 클라이맥스 — 고점에서 거래량 폭발 + 가격↑. 매도 신호.",
        "bullish_div": "강세 다이버전스 — 가격↓ + 거래량↓. 매도 압력 약화.",
        "bearish_div": "약세 다이버전스 — 가격↑ + 거래량↓. 상승 동력 약화.",
        "volume_surge": "거래량 급증 — 가격↑ + 거래량↑. 강한 상승 추세.",
        "volume_decline_bear": "강한 매도 — 가격↓ + 거래량↑. 매도 압력 지속.",
        "normal": "특이 신호 없음",
        "none": "특이 신호 없음",
        "insufficient_data": "데이터 부족",
    }.get(signal, "unknown")


def _divergence_severity(signal: str) -> str:
    return {
        "bullish_climax": "opportunity",
        "bearish_climax": "warning",
        "bullish_div": "opportunity",
        "bearish_div": "warning",
        "volume_surge": "opportunity",
        "volume_decline_bear": "warning",
        "normal": "neutral",
        "none": "neutral",
        "insufficient_data": "neutral",
    }.get(signal, "neutral")


def save_market_gate_json(gate=None, session=None) -> Path:
    """Compute SPY divergence + persist gate result to output/market_gate.json.

    If ``gate`` is None, runs run_market_gate() fresh (network calls).
    """
    from analyzers.market_gate import (
        _fetch_history,
        detect_volume_price_divergence,
        run_market_gate,
    )

    session = session or _make_session()

    if gate is None:
        gate = run_market_gate(session=session)

    # SPY divergence (separate fetch — run_market_gate doesn't expose SPY data)
    spy_hist = _fetch_history("SPY", period="6mo", session=session)
    divergence = "none"
    spy_metrics: dict = {}
    if not spy_hist.empty:
        close = spy_hist["Close"]
        volume = spy_hist["Volume"]
        divergence = detect_volume_price_divergence(spy_hist)
        if len(close) >= 11 and len(volume) >= 20:
            vol_avg20 = float(volume.rolling(20).mean().iloc[-1])
            vol_recent_2d = float(volume.iloc[-2:].mean())
            spy_metrics = {
                "spy_price": round(float(close.iloc[-1]), 2),
                "change_10d_pct": round(float((close.iloc[-1] / close.iloc[-11] - 1) * 100), 2),
                "vol_ratio_2d_vs_20d_avg": round(vol_recent_2d / vol_avg20, 2) if vol_avg20 else None,
            }

    payload = {
        "gate": gate.gate,
        "score": gate.score,
        "reasons": gate.reasons,
        "metrics": gate.metrics,
        "sectors": [asdict(s) for s in gate.sectors],
        "spy_divergence": {
            "signal": divergence,
            "label": _divergence_label(divergence),
            "severity": _divergence_severity(divergence),
            **spy_metrics,
        },
    }

    out = OUTPUT_DIR / "market_gate.json"
    OUTPUT_DIR.mkdir(exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    logger.info("saved %s (gate=%s, sectors=%d, div=%s)", out, gate.gate, len(gate.sectors), divergence)
    try:
        from db import data_store as _ds
        _conn = _ds.get_db()
        _ds.upsert_market_gate_snapshot(_conn, payload)
        _conn.close()
    except Exception as _e:
        logger.warning("SQLite market_gate 쓰기 실패: %s", _e)
    return out


def save_gbm_json(gbm_df=None) -> Path | None:
    """Convert GBM predictions (CSV or dataframe) → output/gbm_predictions.json.

    If ``gbm_df`` is None, reads existing output/gbm_predictions.csv.
    """
    rows: list[dict] = []

    if gbm_df is not None:
        for _, r in gbm_df.iterrows():
            rows.append({
                "ticker": str(r["ticker"]),
                "gbm_score": round(float(r["gbm_score"]), 4),
                "gbm_rank": int(r["gbm_rank"]),
            })
    else:
        src = OUTPUT_DIR / "gbm_predictions.csv"
        if not src.exists():
            logger.warning("no gbm_predictions.csv found — skipping")
            return None
        with src.open() as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({
                    "ticker": row["ticker"],
                    "gbm_score": round(float(row["gbm_score"]), 4),
                    "gbm_rank": int(row["gbm_rank"]),
                })

    # Enrich with company name + sector
    lookup = _load_sp500_names()
    for r in rows:
        meta = lookup.get(r["ticker"], {})
        r["company_name"] = meta.get("name", "")
        r["sector"] = meta.get("sector", "")

    payload = {
        "total": len(rows),
        "top": rows,
        "model": "GradientBoosting (cross-sectional, 20-day horizon)",
        "generated_from": "output/gbm_predictions.csv",
    }

    out = OUTPUT_DIR / "gbm_predictions.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    logger.info("saved %s (top %d)", out, len(rows))
    try:
        from db import data_store as _ds
        _conn = _ds.get_db()
        _ds.upsert_gbm_predictions(_conn, payload)
        _conn.close()
    except Exception as _e:
        logger.warning("SQLite gbm_predictions 쓰기 실패: %s", _e)
    return out


def enrich_top10_with_company_names() -> Path | None:
    """Add company_name + sector fields to each entry in final_top10_report.json."""
    src = OUTPUT_DIR / "final_top10_report.json"
    if not src.exists():
        logger.warning("no final_top10_report.json found — skipping")
        return None

    data = json.loads(src.read_text())
    lookup = _load_sp500_names()
    for entry in data.get("top10", []):
        meta = lookup.get(entry.get("ticker", ""), {})
        entry.setdefault("company_name", meta.get("name", ""))
        entry.setdefault("sector", meta.get("sector", ""))

    src.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    logger.info("enriched %s with company_name (top10=%d)", src, len(data.get("top10", [])))
    return src


def _load_sp500_names() -> dict:
    src = DATA_DIR / "sp500_list.csv"
    lookup: dict = {}
    if not src.exists():
        return lookup
    with src.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym = (row.get("Symbol") or "").strip()
            if sym:
                lookup[sym] = {
                    "name": (row.get("Security") or "").strip(),
                    "sector": (row.get("GICS Sector") or "").strip(),
                }
    return lookup


_SCHEDULE_DEFS = [
    {
        "id": "main_pipeline",
        "name": "메인 분석 파이프라인",
        "name_en": "Main Analysis Pipeline",
        "cron_kst": "0 7 * * 1-5",
        "cron_desc": "평일 매일 07:00 KST",
        "category": "daily",
        "enabled": True,
    },
    {
        "id": "sp500_update",
        "name": "S&P500 구성종목 갱신",
        "name_en": "S&P 500 List Update",
        "cron_kst": "0 8 1 * *",
        "cron_desc": "매월 1일 08:00 KST",
        "category": "monthly",
        "enabled": False,
    },
    {
        "id": "holdings_13f",
        "name": "13F 홀딩스 업데이트",
        "name_en": "13F Holdings Update",
        "cron_kst": "0 8 1 2,5,8,11 *",
        "cron_desc": "분기별 1일 08:00 KST (2/5/8/11월)",
        "category": "quarterly",
        "enabled": False,
    },
    {
        "id": "ml_retrain",
        "name": "ML 모델 재훈련",
        "name_en": "ML Model Retrain",
        "cron_kst": "0 8 * * 0",
        "cron_desc": "매주 일요일 08:00 KST",
        "category": "weekly",
        "enabled": False,
    },
    {
        "id": "backtest_verify",
        "name": "성능 검증 (백테스트)",
        "name_en": "Backtest Verification",
        "cron_kst": "0 18 * * 5",
        "cron_desc": "매주 금요일 18:00 KST",
        "category": "weekly",
        "enabled": False,
    },
    {
        "id": "research_agent",
        "name": "리서치 에이전트",
        "name_en": "Research Agent",
        "cron_kst": "0 9 * * 1",
        "cron_desc": "매주 월요일 09:00 KST",
        "category": "weekly",
        "enabled": False,
    },
    {
        "id": "system_health",
        "name": "시스템 상태 점검",
        "name_en": "System Health Check",
        "cron_kst": "30 9 * * 1",
        "cron_desc": "매주 월요일 09:30 KST",
        "category": "weekly",
        "enabled": False,
    },
]


def _next_cron_kst(cron_expr: str) -> str | None:
    """Calculate next run time for a cron expression (KST, no external deps)."""
    from datetime import datetime, timedelta, timezone

    KST = timezone(timedelta(hours=9))
    now = datetime.now(KST)

    parts = cron_expr.strip().split()
    if len(parts) != 5:
        return None

    c_min, c_hour, c_dom, c_month, c_dow = parts

    def _matches(field: str, value: int) -> bool:
        if field == "*":
            return True
        for part in field.split(","):
            if "-" in part:
                lo, hi = map(int, part.split("-"))
                if lo <= value <= hi:
                    return True
            elif int(part) == value:
                return True
        return False

    t = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
    limit = t + timedelta(days=400)

    while t < limit:
        # Python weekday Mon=0..Sun=6 → cron DOW Sun=0, Mon=1..Sat=6
        cron_dow = (t.weekday() + 1) % 7

        month_ok = _matches(c_month, t.month)
        dom_ok = _matches(c_dom, t.day)
        dow_ok = _matches(c_dow, cron_dow)

        # Unix cron: both dom and dow restricted → either match satisfies
        if c_dom != "*" and c_dow != "*":
            day_ok = dom_ok or dow_ok
        else:
            day_ok = dom_ok and dow_ok

        if month_ok and day_ok and _matches(c_hour, t.hour) and _matches(c_min, t.minute):
            return t.strftime("%Y-%m-%dT%H:%M:00+09:00")

        if not month_ok or not day_ok:
            t = (t + timedelta(days=1)).replace(hour=0, minute=0)
        elif not _matches(c_hour, t.hour):
            next_h = next((h for h in range(t.hour + 1, 24) if _matches(c_hour, h)), None)
            if next_h is not None:
                t = t.replace(hour=next_h, minute=0)
            else:
                t = (t + timedelta(days=1)).replace(hour=0, minute=0)
        else:
            t += timedelta(minutes=1)

    return None


def _parse_daily_logs(logs_dir: Path, days: int = 14) -> dict[str, dict]:
    """Parse logs/daily_run_YYYYMMDD.log files → {date: {status, started_at, duration_sec}}."""
    import re

    results: dict[str, dict] = {}
    ts_re = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")
    fmt = "%Y-%m-%d %H:%M:%S"

    for log_file in sorted(logs_dir.glob("daily_run_*.log"))[-days:]:
        m = re.match(r"daily_run_(\d{4})(\d{2})(\d{2})\.log", log_file.name)
        if not m:
            continue
        date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

        try:
            content = log_file.read_text(errors="replace")
        except OSError:
            continue

        lines = content.strip().splitlines()
        if not lines:
            continue

        first_ts = last_ts = None
        for line in lines:
            m2 = ts_re.search(line)
            if m2:
                if first_ts is None:
                    first_ts = m2.group(1)
                last_ts = m2.group(1)

        # Check last 5 lines for completion — takes priority over intermediate ERRORs
        last5 = "\n".join(lines[-5:])
        if any(kw in last5 for kw in ("완료", "Phase 4", "complete")):
            status = "success"
        elif "Traceback (most recent" in content or "SystemExit" in content[-500:]:
            status = "failure"
        else:
            status = "unknown"

        duration_sec = None
        if first_ts and last_ts:
            try:
                from datetime import datetime as _dt
                dt1 = _dt.strptime(first_ts, fmt)
                dt2 = _dt.strptime(last_ts, fmt)
                duration_sec = max(0, int((dt2 - dt1).total_seconds()))
            except Exception:
                pass

        results[date_str] = {
            "status": status,
            "started_at": first_ts,
            "duration_sec": duration_sec,
        }

    return results


def update_schedules_in_db() -> None:
    """Parse logs and upsert all schedule definitions + run history into data_schedules."""
    try:
        from db import data_store as _ds
    except ImportError:
        logger.warning("data_store 임포트 실패 — schedules 업데이트 건너뜀")
        return

    logs_dir = ROOT / "logs"
    log_history = _parse_daily_logs(logs_dir, days=14) if logs_dir.exists() else {}

    # Build 14-day history list for main_pipeline
    from datetime import date, timedelta
    today = date.today()
    history_14d = []
    for i in range(13, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        entry = log_history.get(d)
        history_14d.append({"date": d, "status": entry["status"] if entry else "no_run"})

    latest = max(log_history.items(), key=lambda x: x[0]) if log_history else None

    try:
        conn = _ds.get_db()
        for sdef in _SCHEDULE_DEFS:
            row = dict(sdef)
            row["next_run_at"] = _next_cron_kst(sdef["cron_kst"])

            if sdef["id"] == "main_pipeline" and latest:
                info = latest[1]
                row["last_run_at"] = info.get("started_at")
                row["last_status"] = info.get("status")
                row["last_duration_sec"] = info.get("duration_sec")
                row["run_count"] = sum(1 for v in log_history.values() if v["status"] == "success")
                row["history"] = history_14d

            _ds.upsert_schedule(conn, row)

        conn.close()
        logger.info("schedules 업데이트 완료 (%d개)", len(_SCHEDULE_DEFS))
    except Exception as e:
        logger.warning("schedules DB 업데이트 실패: %s", e)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    save_market_gate_json()
    save_gbm_json()
    enrich_top10_with_company_names()
    update_schedules_in_db()
    print("\n✓ Dashboard JSONs regenerated.")


if __name__ == "__main__":
    main()
