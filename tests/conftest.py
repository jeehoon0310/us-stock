"""pytest conftest — src/ 기반 모듈 경로 설정.

src/ 하위 패키지와 flat-import 테스트 모두 동작하도록
sys.path에 src/ 및 주요 서브패키지를 추가한다.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = ROOT / "src"

sys.path.insert(0, str(src))
sys.path.insert(0, str(src / "collectors"))
sys.path.insert(0, str(src / "analyzers"))
sys.path.insert(0, str(src / "pipeline"))
sys.path.insert(0, str(src / "us_market"))
