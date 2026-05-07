import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";
import type pg from "pg";
import {
  createPool,
  ensureSchema,
  listVideos,
  replaceChannelVideos,
  type YoutubeVideoRow,
} from "./db.js";
import { fetchVideosFromChannelVideosTab } from "./youtube-browse-grid.js";
import { enrichDatesAndChannelAndExcludeIi } from "./youtube-enrich.js";
import { isIngegneriInBorsaVideo } from "./video-filter.js";
import { getTargetChannelId, getTargetHandle } from "./target-channel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.YOUTUBE_SERVICE_PORT) || 4002;

/** Quanti video scaricare dalla griglia prima del filtro (default 50) */
const FETCH_CANDIDATES = Number(process.env.YOUTUBE_FETCH_CANDIDATES) || 50;
/** Quanti video salvare dopo il filtro (default 10) */
const SAVE_TOTAL = Number(process.env.YOUTUBE_SAVE_COUNT) || 10;

let pool!: pg.Pool;

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function refreshFromYoutube(): Promise<{
  channel_id: string;
  videos: YoutubeVideoRow[];
}> {
  const channelId = await getTargetChannelId();
  const handle = getTargetHandle();

  const raw = await fetchVideosFromChannelVideosTab(
    handle,
    channelId,
    FETCH_CANDIDATES,
  );
  const textFiltered = raw.filter(isIngegneriInBorsaVideo);
  const roughSorted = [...textFiltered].sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
  const enrichCap = Math.min(roughSorted.length, 50);
  const filtered = await enrichDatesAndChannelAndExcludeIi(
    roughSorted.slice(0, enrichCap),
  );
  filtered.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
  const picked = filtered.slice(0, SAVE_TOTAL);

  if (picked.length === 0) {
    throw new Error(
      "Nessun video ha superato il filtro «Ingegneri in Borsa» nel pool analizzato. " +
        "Verifica l'handle del canale o allenta i criteri in video-filter.ts.",
    );
  }

  const rows: Omit<YoutubeVideoRow, "updated_at">[] = picked.map((p) => ({
    video_id: p.video_id,
    title: p.title,
    thumbnail_url: p.thumbnail_url,
    published_at: p.published_at,
    channel_id: p.channel_id,
    channel_title: p.channel_title,
    video_url: p.video_url,
  }));

  await replaceChannelVideos(pool, channelId, rows);
  const videos = await listVideos(pool, channelId);
  return { channel_id: channelId, videos };
}

async function start() {
  pool = createPool();
  await ensureSchema(pool);

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";

    try {
      if (req.method === "GET" && url === "/health") {
        json(res, 200, { service: "youtube-service", status: "ok" });
        return;
      }

      if (req.method === "GET" && url === "/youtube/videos") {
        const channelId = await getTargetChannelId();
        const videos = await listVideos(pool, channelId);
        json(res, 200, { videos });
        return;
      }

      if (req.method === "POST" && url === "/youtube/refresh") {
        await readBody(req);
        const result = await refreshFromYoutube();
        json(res, 200, {
          ok: true,
          channel_id: result.channel_id,
          count: result.videos.length,
          videos: result.videos,
        });
        return;
      }

      json(res, 404, { error: "not_found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(res, 500, { error: "youtube_service_error", message });
    }
  });

  server.listen(port, () => {
    console.log(`[youtube-service] http://127.0.0.1:${port}`);
  });

  const shutdown = () => {
    pool.end().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
