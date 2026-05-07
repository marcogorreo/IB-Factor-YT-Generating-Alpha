import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.INSIGHTS_SERVICE_PORT) || 4001;

const server = createServer((req, res) => {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "insights-service", status: "ok" }));
    return;
  }

  if (req.method === "GET" && url === "/insights/ping") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "insights microservizio attivo" }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[insights-service] http://127.0.0.1:${port}`);
});
