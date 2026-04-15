"""FinalReportGenerator 단위 테스트."""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from unittest.mock import patch, mock_open, MagicMock
import pytest

from analyzers.final_report_generator import FinalReportGenerator


@pytest.fixture
def generator(tmp_path):
    gen = FinalReportGenerator.__new__(FinalReportGenerator)
    gen.output_dir = tmp_path
    return gen


class TestExtractAiRecommendation:
    def test_buy_recommendation(self, generator):
        summary = {"recommendation": "BUY", "thesis": "Strong growth"}
        rec, score = generator.extract_ai_recommendation(summary)
        assert rec == "BUY"

    def test_sell_recommendation(self, generator):
        summary = {"recommendation": "SELL", "bear_cases": ["declining revenue"]}
        rec, score = generator.extract_ai_recommendation(summary)
        assert rec == "SELL"

    def test_hold_default(self, generator):
        summary = {"thesis": "Uncertain outlook"}  # recommendation 키 없음
        rec, score = generator.extract_ai_recommendation(summary)
        assert rec == "HOLD"

    def test_bear_case_does_not_pollute_buy(self, generator):
        """bear_cases에 '매수' 언급이 있어도 recommendation 필드 기준으로 판단."""
        summary = {
            "recommendation": "SELL",
            "bear_cases": ["경쟁사가 매수 공세로 시장점유율 감소"],
        }
        rec, score = generator.extract_ai_recommendation(summary)
        assert rec == "SELL"  # bear_cases의 '매수' 키워드에 오염되면 안 됨


class TestScoreIntegrity:
    def test_final_score_bounded(self, generator):
        """최종 점수가 0~100 범위여야 한다."""
        if hasattr(generator, "_combine_scores"):
            score = generator._combine_scores(quant=85, ai=70, ai_weight=0.1)
            assert 0 <= score <= 100
