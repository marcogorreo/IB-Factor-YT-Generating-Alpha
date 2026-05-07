import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.API_GATEWAY_PORT) || 4000;
const insightsBase =
  process.env.INSIGHTS_SERVICE_URL ?? "http://127.0.0.1:4001";

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "api-gateway", status: "ok" }));
    return;
  }

  if (req.method === "GET" && url.startsWith("/insights")) {
    try {
      const target = new URL(url, insightsBase);
      const upstream = await fetch(target, {
        headers: { accept: "application/json" },
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      });
      res.end(body);
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

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[api-gateway] http://127.0.0.1:${port}`);
});
