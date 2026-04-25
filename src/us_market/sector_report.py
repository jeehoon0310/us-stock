"""섹터 리포트 통합 생성기 — 섹터 순환 + 히트맵 + 옵션 플로우 통합 (Part 7 Prompt 10, 12).

세 모듈의 데이터를 통합하여 output/sector_report.json으로 저장한다.
각 모듈 오류 시 해당 섹션만 빈 dict로 처리하여 전체 실패를 방지한다.
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# src/ 를 경로에 추가: 직접 스크립트 실행 시에도 임포트 정상 동작
_SRC = str(Path(__file__).resolve().parent.parent)
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from us_market.sector_rotation import SectorRotationTracker
from us_market.sector_heatmap import SectorHeatmapCollector
from us_market.options_flow import OptionsFlowAnalyzer

logger = logging.getLogger(__name__)


def generate_sector_report(data_dir: str = '.') -> Dict:
    """섹터 순환 + 히트맵 + 옵션 플로우를 통합하여 리포트 생성.

    각 모듈 실패 시 해당 섹션을 {} 로 처리하고 계속 진행.
    결과를 output/sector_report.json 으로 저장 후 반환.
    """
    report: Dict = {'generated_at': datetime.now().isoformat()}

    # 1. 섹터 순환
    try:
        tracker = SectorRotationTracker(data_dir)
        performance = tracker.get_multi_period_performance()
        cycle = tracker.detect_cycle_phase(performance)
        rs_history = tracker.calculate_relative_strength_history()
        report['sector_rotation'] = {
            'performance':    performance,
            'current_phase':  cycle.get('current_phase', ''),
            'phase_scores':   cycle.get('phase_scores', {}),
            'leading_sectors': cycle.get('leading_sectors', []),
            'lagging_sectors': cycle.get('lagging_sectors', []),
            'angle':          cycle.get('angle', 0),
            'rs_history':     rs_history,
        }
        logger.info("sector_rotation OK — phase: %s", cycle.get('current_phase'))
    except Exception as e:
        logger.error("sector_rotation failed: %s", e)
        report['sector_rotation'] = {}

    # 2. 섹터 히트맵
    try:
        collector = SectorHeatmapCollector()
        heatmap: List[Dict] = collector.get_sector_performance('1d')
        report['sector_heatmap'] = heatmap
        logger.info("sector_heatmap OK — %d sectors", len(heatmap))
    except Exception as e:
        logger.error("sector_heatmap failed: %s", e)
        report['sector_heatmap'] = {}

    # 3. 옵션 플로우
    try:
        analyzer = OptionsFlowAnalyzer(data_dir)
        options_flow = analyzer.analyze_watchlist()

        avg_sentiment = (
            round(sum(s.get('sentiment_score', 50) for s in options_flow) / len(options_flow), 1)
            if options_flow else 50.0
        )
        unusual_count = sum(
            1 for s in options_flow if s.get('activity', '') != 'Normal Activity'
        )
        report['options_flow'] = {
            'overall_sentiment':     avg_sentiment,
            'stocks_analyzed':       len(options_flow),
            'unusual_activity_count': unusual_count,
            'details':               options_flow,
        }
        logger.info("options_flow OK — %d stocks, unusual: %d", len(options_flow), unusual_count)
    except Exception as e:
        logger.error("options_flow failed: %s", e)
        report['options_flow'] = {}

    # 저장
    out_dir = Path(data_dir) / 'output'
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / 'sector_report.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    logger.info("sector_report.json saved: %s", path)

    return report


if __name__ == '__main__':
    import os
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

    report = generate_sector_report(data_dir='.')

    sr = report.get('sector_rotation', {})
    hm = report.get('sector_heatmap', [])
    of = report.get('options_flow', {})

    print('\n=== 섹터 리포트 요약 ===')
    print(f"경기 국면  : {sr.get('current_phase', 'N/A')}")
    print(f"주도 섹터  : {sr.get('leading_sectors', [])}")
    print(f"열위 섹터  : {sr.get('lagging_sectors', [])}")

    if isinstance(hm, list) and hm:
        sorted_hm = sorted(hm, key=lambda x: x.get('change_pct', 0), reverse=True)
        print(f"\n히트맵 상위 3 : {[(s['ticker'], s.get('change_pct', 0)) for s in sorted_hm[:3]]}")
        print(f"히트맵 하위 3 : {[(s['ticker'], s.get('change_pct', 0)) for s in sorted_hm[-3:]]}")

    print(f"\n옵션 전체 심리 : {of.get('overall_sentiment', 'N/A')}")
    unusual = [d['ticker'] for d in of.get('details', []) if d.get('activity', '') != 'Normal Activity']
    print(f"Unusual 종목   : {unusual}")

    path = 'output/sector_report.json'
    print(f"\n저장 경로: {path}")
    print(f"존재: {os.path.exists(path)}")
    if os.path.exists(path):
        print(f"크기: {os.path.getsize(path):,} bytes")
