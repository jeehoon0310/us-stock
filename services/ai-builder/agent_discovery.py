"""에이전트 디스커버리 — .claude/agents/ 폴더 파싱"""
import re
from pathlib import Path

AGENTS_DIR = Path(__file__).resolve().parents[2] / ".claude" / "agents"


def discover_agents() -> list[dict]:
    """agents/ 하위 .md 파일을 파싱해서 에이전트 목록 반환"""
    agents = []
    if not AGENTS_DIR.exists():
        return agents

    for md in sorted(AGENTS_DIR.rglob("*.md")):
        content = md.read_text(encoding="utf-8")
        name_m = re.search(r"^name:\s*(.+)$", content, re.MULTILINE)
        desc_m = re.search(r"^description:\s*(.+)$", content, re.MULTILINE)
        if not name_m:
            continue
        team = md.parent.name if md.parent != AGENTS_DIR else "general"
        agents.append(
            {
                "id": name_m.group(1).strip(),
                "description": desc_m.group(1).strip() if desc_m else "",
                "team": team,
                "file": str(md.relative_to(AGENTS_DIR.parent.parent)),
            }
        )

    return agents
