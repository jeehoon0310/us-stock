import { spawn } from "child_process";
import path from "path";

const US_STOCK_DIR =
  process.env.US_STOCK_DIR ?? path.resolve(process.cwd(), "..");

export async function POST(req: Request) {
  let agentId: string;
  let task: string;

  try {
    const body = await req.json();
    agentId = String(body.agentId ?? "");
    task = String(body.task ?? "");
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!agentId || !task) {
    return new Response("agentId and task are required", { status: 400 });
  }

  // agentId는 영숫자·하이픈만 허용 (injection 방지)
  if (!/^[a-z0-9-]+$/.test(agentId)) {
    return new Response("Invalid agentId", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: object) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      const proc = spawn(
        "claude",
        [
          "-p",
          `@${agentId} ${task}`,
          "--output-format",
          "stream-json",
          "--allowedTools",
          "Read,Bash,Glob,Grep",
        ],
        {
          cwd: US_STOCK_DIR,
          env: { ...process.env },
        }
      );

      proc.stdout.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            // stream-json 포맷 정규화
            if (parsed.type === "assistant" && parsed.message?.content) {
              for (const block of parsed.message.content) {
                if (block.type === "text") {
                  send({ type: "text", text: block.text });
                } else if (block.type === "tool_use") {
                  send({ type: "tool_use", name: block.name, input: block.input });
                }
              }
            } else if (parsed.type === "tool_result") {
              send({ type: "tool_result", content: parsed.content?.[0]?.text?.slice(0, 200) });
            } else {
              send(parsed);
            }
          } catch {
            send({ type: "text", text: trimmed });
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        // 일반 진행 로그는 무시, 에러만 전달
        if (text.includes("Error") || text.includes("error")) {
          send({ type: "error", text });
        }
      });

      proc.on("close", (code) => {
        send({ type: "done", exitCode: code });
        controller.close();
      });

      proc.on("error", (err) => {
        send({
          type: "error",
          text: `claude CLI를 실행할 수 없습니다: ${err.message}. 서버에 Claude Code가 설치되어 있는지 확인하세요.`,
        });
        send({ type: "done", exitCode: -1 });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
