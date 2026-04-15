import json
import logging
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


class FinalReportGenerator:
    def __init__(self):
        self.picks_df = None
        self.ai_summaries = {}

    def load_data(self):
        picks_path = OUTPUT_DIR / "smart_money_picks_v2.csv"
        if not picks_path.exists():
            raise FileNotFoundError(f"스크리닝 결과 없음: {picks_path}")
        self.picks_df = pd.read_csv(picks_path)
        logger.info("picks 로드: %d종목", len(self.picks_df))

        ai_path = OUTPUT_DIR / "ai_summaries.json"
        if ai_path.exists():
            with open(ai_path, encoding="utf-8") as f:
                self.ai_summaries = json.load(f)
            logger.info("AI 요약 로드: %d종목", len(self.ai_summaries))
        else:
            self.ai_summaries = {}
            logger.warning("AI 요약 파일 없음 — 퀀트 점수만 사용")

    @staticmethod
    def extract_ai_recommendation(summary: dict) -> tuple[str, int]:
        """AI 응답의 recommendation 필드를 직접 파싱."""
        if not summary or not isinstance(summary, dict):
            return "HOLD", 5

        rec = summary.get("recommendation", "").upper().strip()
        confidence = min(max(int(summary.get("confidence", 50)), 0), 100)

        # 표준화된 recommendation 값 매핑 (긴 키를 먼저 매칭)
        rec_map = [
            ("STRONG_BUY", "STRONG_BUY", 20),
            ("STRONG BUY", "STRONG_BUY", 20),
            ("STRONG_SELL", "STRONG_SELL", 0),
            ("STRONG SELL", "STRONG_SELL", 0),
            ("적극매수", "STRONG_BUY", 20),
            ("적극 매수", "STRONG_BUY", 20),
            ("BUY", "BUY", 15),
            ("HOLD", "HOLD", 5),
            ("SELL", "SELL", 0),
            ("매수", "BUY", 15),
            ("중립", "HOLD", 5),
            ("매도", "SELL", 0),
        ]

        for key, rec_type, base_score in rec_map:
            if key in rec:
                # confidence를 반영한 보너스 점수 (최대 5점 추가)
                bonus = min(5, int(confidence / 20))
                return rec_type, base_score + bonus

        return "HOLD", 5

    def calculate_final_score(self, row: pd.Series, ai_summaries: dict) -> dict:
        ticker_col = "종목" if "종목" in row.index else "ticker"
        score_col = "점수" if "점수" in row.index else "composite_score"
        grade_col = "등급" if "등급" in row.index else "grade"

        ticker = row[ticker_col]
        quant_score = float(row[score_col])

        ai_score = 0
        ai_recommendation = "N/A"
        has_ai = ticker in ai_summaries

        if has_ai:
            ai_recommendation, ai_score = self.extract_ai_recommendation(ai_summaries[ticker])

        ai_contribution = min(max(0, ai_score), 10) * 0.5
        final_score = quant_score * 0.9 + ai_contribution

        return {
            "ticker": ticker,
            "quant_score": round(quant_score, 1),
            "grade": row.get(grade_col, "N/A"),
            "ai_score": ai_score,
            "ai_recommendation": ai_recommendation,
            "ai_contribution": round(ai_contribution, 1),
            "final_score": round(final_score, 1),
            "has_ai": has_ai,
            "tech_score": row.get("Tech", row.get("technical_score", 0)),
            "fund_score": row.get("Fund", row.get("fundamental_score", 0)),
            "rs_vs_spy": row.get("RS vs SPY", row.get("rs_vs_spy", 0)),
        }

    def generate_report(self) -> list[dict]:
        self.load_data()

        results = []
        for _, row in self.picks_df.iterrows():
            result = self.calculate_final_score(row, self.ai_summaries)
            results.append(result)

        results.sort(key=lambda x: x["final_score"], reverse=True)
        top10 = results[:10]

        report = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_screened": len(results),
            "ai_analyzed": sum(1 for r in results if r["has_ai"]),
            "top10": top10,
        }

        out_path = OUTPUT_DIR / "final_top10_report.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        logger.info("리포트 저장: %s", out_path)

        # 콘솔 출력
        print(f"\n{'=' * 75}")
        print(f"  Final Top 10 Report ({report['generated_at']})")
        print(f"  총 {report['total_screened']}종목 스크리닝, AI 분석 {report['ai_analyzed']}종목")
        print(f"{'=' * 75}")
        print(f"  {'순위':>4} {'종목':>6} {'등급':>4} {'퀀트':>6} {'AI':>4} {'최종':>6} {'AI추천':<12} {'Tech':>5} {'Fund':>5} {'RS':>8}")
        print(f"  {'-' * 70}")
        for i, r in enumerate(top10, 1):
            print(f"  {i:>4} {r['ticker']:>6}   {r['grade']:>2} {r['quant_score']:>6.1f} {r['ai_score']:>+4} {r['final_score']:>6.1f} {r['ai_recommendation']:<12} {r['tech_score']:>5} {r['fund_score']:>5} {r['rs_vs_spy']:>+7}%")
        print(f"{'=' * 75}")

        return top10


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    gen = FinalReportGenerator()
    gen.generate_report()
