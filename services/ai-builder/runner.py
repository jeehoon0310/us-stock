"""Claude Code 에이전트 subprocess 실행 + SSE 스트리밍"""
import asyncio
import json
import os
from pathlib import Path
from typing import AsyncGenerator

US_STOCK_DIR = os.environ.get(
    "US_STOCK_DIR", str(Path(__file__).resolve().parents[2])
)


async def stream_agent(agent_id: str, task: str) -> AsyncGenerator[str, None]:
    """claude -p @{agent_id} {task} 실행 후 SSE 이벤트 스트리밍"""
    cmd = [
        "claude",
        "-p",
        f"@{agent_id} {task}",
        "--output-format",
        "stream-json",
        "--allowedTools",
        "Read,Bash,Glob,Grep",
    ]

    env = {
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
    }

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=US_STOCK_DIR,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    assert proc.stdout is not None
    assert proc.stderr is not None

    async def read_stdout() -> AsyncGenerator[str, None]:
        async for raw_line in proc.stdout:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
                if parsed.get("type") == "assistant" and parsed.get("message", {}).get("content"):
                    for block in parsed["message"]["content"]:
                        if block.get("type") == "text":
                            yield f"data: {json.dumps({'type': 'text', 'text': block['text']})}\n\n"
                        elif block.get("type") == "tool_use":
                            yield (
                                f"data: {json.dumps({'type': 'tool_use', 'name': block['name'], 'input': block.get('input', {})})}\n\n"
                            )
                else:
                    yield f"data: {line}\n\n"
            except json.JSONDecodeError:
                yield f"data: {json.dumps({'type': 'text', 'text': line})}\n\n"

    async for event in read_stdout():
        yield event

    await proc.wait()
    yield f"data: {json.dumps({'type': 'done', 'exitCode': proc.returncode})}\n\n"
