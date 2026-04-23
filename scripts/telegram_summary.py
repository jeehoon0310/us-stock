"""output/reports/latest_report.json → 텔레그램 메시지 포맷 출력 (stdout)."""
import json
import sys
from datetime import datetime
from pathlib import Path

VERDICT_EMOJI = {"GO": "✅", "CAUTION": "⚠️", "STOP": "🛑"}
ACTION_EMOJI = {"BUY": "🟢", "SMALL BUY": "🟡", "WATCH": "👀", "HOLD": "⏸"}

ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = ROOT / "output" / "reports" / "latest_report.json"


def main() -> None:
    if not REPORT_PATH.exists():
        print("❌ latest_report.json 없음")
        sys.exit(1)

    with open(REPORT_PATH) as f:
        r = json.load(f)

    date = r.get("data_date", r.get("generated_at", "")[:10])
    verdict = r.get("verdict", "CAUTION")
    verdict_icon = VERDICT_EMOJI.get(verdict, "⚠️")

    mt = r.get("market_timing", {})
    regime = mt.get("regime", "unknown").upper()
    regime_conf = mt.get("regime_confidence", 0)
    gate = mt.get("gate", "CAUTION")
    gate_score = mt.get("gate_score", 0)

    lines = [
        f"📊 US Stock {date}",
        f"체제: {regime} ({regime_conf:.0f}%) | 게이트: {gate} ({gate_score:.1f})",
        f"판정: {verdict_icon} {verdict}",
        "",
        "🏆 Top 10",
    ]

    picks = r.get("stock_picks", [])[:10]
    for i, p in enumerate(picks, 1):
        ticker = p.get("ticker", "???")
        grade = p.get("grade", "-")
        score = p.get("composite_score", p.get("final_score", 0))
        action = p.get("action", "WATCH")
        action_icon = ACTION_EMOJI.get(action, "")
        name = p.get("company_name", "")
        lines.append(f" {i:2}. {ticker:<5} {grade}  {score:.1f}  {action_icon} {action}  {name}")

    now_kst = datetime.now().strftime("%H:%M KST")
    lines += ["", f"⏱ 완료: {now_kst}"]

    print("\n".join(lines))


if __name__ == "__main__":
    main()
