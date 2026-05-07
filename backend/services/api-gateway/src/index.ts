import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.API_GATEWAY_PORT) || 4000;
const insightsBase =
  process.env.INSIGHTS_SERVICE_URL ?? "http://127.0.0.1:4001";
const youtubeBase =
  process.env.YOUTUBE_SERVICE_URL ?? "http://127.0.0.1:4002";

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "api-gateway", status: "ok" }));
    return;
  }

  if (url.startsWith("/insights")) {
    const method = req.method ?? "GET";
    if (
      method !== "GET" &&
      method !== "POST" &&
      method !== "OPTIONS"
    ) {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      });
      res.end();
      return;
    }
    try {
      const target = new URL(url, insightsBase);
      const hasBody = method === "POST";
      const postBuf = hasBody
        ? await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c as Buffer));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          })
        : undefined;
      const upstream = await fetch(target, {
        method,
        headers: {
          accept: "application/json",
          ...(hasBody ? { "content-type": "application/json" } : {}),
        },
        body:
          hasBody && postBuf && postBuf.length > 0
            ? new Uint8Array(postBuf)
            : undefined,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(text);
    } catch {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "upstream_unavailable",
          hint: "Avvia il servizio insights-service",
        }),
      );
    }
    return;
  }

  if (url.startsWith("/youtube")) {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "POST" && method !== "OPTIONS") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      });
      res.end();
      return;
    }
    try {
      const target = new URL(url, youtubeBase);
      const hasBody = method === "POST";
      const body = hasBody
        ? await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c as Buffer));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          })
        : undefined;
      const upstream = await fetch(target, {
        method,
        headers: {
          accept: "application/json",
          ...(hasBody ? { "content-type": "application/json" } : {}),
        },
        body:
          hasBody && body && body.length > 0
            ? new Uint8Array(body)
            : undefined,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(text);
    } catch {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "upstream_unavailable",
          hint: "Avvia youtube-service e Postgres (vedi docker-compose.yml)",
        }),
      );
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[api-gateway] http://127.0.0.1:${port}`);
});
