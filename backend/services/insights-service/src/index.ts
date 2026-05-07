import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";

import {
  anthropicChat,
  getAnthropicStatus,
  parseChatBody,
} from "./llm/anthropic-chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.INSIGHTS_SERVICE_PORT) || 4001;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(buf.toString("utf8")) as unknown);
      } catch {
        reject(new SyntaxError("JSON non valido"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        service: "insights-service",
        status: "ok",
      }),
    );
    return;
  }

  if (req.method === "GET" && url === "/insights/ping") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "insights microservizio attivo" }));
    return;
  }

  if (req.method === "GET" && url === "/insights/llm/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(getAnthropicStatus()));
    return;
  }

  if (req.method === "POST" && url === "/insights/llm/chat") {
    try {
      const raw = await readJsonBody(req);
      const parsed = parseChatBody(raw);
      const result = await anthropicChat(parsed);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          reply: result.text,
          model: result.model,
          usage: {
            input_tokens: result.input_tokens,
            output_tokens: result.output_tokens,
          },
        }),
      );
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ ok: false, error: "invalid_json", message: e.message }),
        );
        return;
      }
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode ?? 500;
      res.writeHead(code, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: code === 502 ? "upstream_error" : "llm_error",
          message: err.message,
        }),
      );
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[insights-service] http://127.0.0.1:${port}`);
});
