import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";

import {
  deleteMraAnalysisArchiveById,
  ensureMraAnalysisArchiveSchema,
  ensureMraTranscriptSchema,
  getMraAnalysisArchiveById,
  getPool,
  insertMraAnalysisArchive,
  listMraAnalysisArchiveSummaries,
  upsertTranscript,
} from "./db/pool.js";
import {
  anthropicChat,
  getAnthropicStatus,
  parseChatBody,
} from "./llm/anthropic-chat.js";
import { runMraAnalysisFromDb } from "./mra/mra-analyze.js";
import { polishTranscriptText } from "./mra/caption-parse.js";
import { extractYoutubeCaptions } from "./mra/yt-dlp-captions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../../.env.local") });

const port = Number(process.env.INSIGHTS_SERVICE_PORT) || 4001;

let dbReady = false;

async function initDb(): Promise<void> {
  try {
    const pool = getPool();
    await ensureMraTranscriptSchema(pool);
    await ensureMraAnalysisArchiveSchema(pool);
    dbReady = true;
    console.log("[insights-service] schema mra_transcripts + mra_analysis_archive ok");
  } catch (e) {
    console.warn(
      "[insights-service] DATABASE_URL assente o schema fallito — MRA trascrizioni disabilitate:",
      e instanceof Error ? e.message : e,
    );
    dbReady = false;
  }
}

void initDb();

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

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function parseTranscribeBody(raw: unknown): { video_id: string } {
  if (!raw || typeof raw !== "object") {
    const e = new Error("Body JSON con video_id richiesto");
    (e as Error & { statusCode?: number }).statusCode = 400;
    throw e;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.video_id !== "string" || !o.video_id.trim()) {
    const e = new Error('Campo "video_id" stringa obbligatoria');
    (e as Error & { statusCode?: number }).statusCode = 400;
    throw e;
  }
  return { video_id: o.video_id.trim() };
}

function parseArchiveBody(
  raw: unknown,
): {
  video_id: string;
  video_title: string;
  transcript: string;
  contesto_generale: string;
  previsioni_opinioni: string;
  titoli_coinvolti: string;
  operazioni_inverse: string;
} {
  if (!raw || typeof raw !== "object") {
    const e = new Error("Body JSON richiesto");
    (e as Error & { statusCode?: number }).statusCode = 400;
    throw e;
  }
  const o = raw as Record<string, unknown>;
  const need = [
    "video_id",
    "video_title",
    "transcript",
    "contesto_generale",
    "previsioni_opinioni",
    "titoli_coinvolti",
    "operazioni_inverse",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of need) {
    const v = o[k];
    if (typeof v !== "string") {
      const e = new Error(`Campo "${k}" deve essere una stringa`);
      (e as Error & { statusCode?: number }).statusCode = 400;
      throw e;
    }
    out[k] = v;
  }
  if (!out.video_id.trim()) {
    const e = new Error('Campo "video_id" non può essere vuoto');
    (e as Error & { statusCode?: number }).statusCode = 400;
    throw e;
  }
  return {
    video_id: out.video_id.trim(),
    video_title: out.video_title,
    transcript: out.transcript,
    contesto_generale: out.contesto_generale,
    previsioni_opinioni: out.previsioni_opinioni,
    titoli_coinvolti: out.titoli_coinvolti,
    operazioni_inverse: out.operazioni_inverse,
  };
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  const pathname = url.split("?")[0].replace(/\/+$/, "") || "/";

  if (req.method === "GET" && url === "/health") {
    json(res, 200, {
      service: "insights-service",
      status: "ok",
      mra_transcripts_db: dbReady,
    });
    return;
  }

  if (req.method === "GET" && url === "/insights/ping") {
    json(res, 200, { message: "insights microservizio attivo" });
    return;
  }

  if (req.method === "GET" && url === "/insights/llm/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(getAnthropicStatus()));
    return;
  }

  if (req.method === "POST" && url === "/insights/mra/transcribe") {
    if (!dbReady) {
      json(res, 503, {
        ok: false,
        error: "database_unavailable",
        message:
          "Database non configurato o schema MRA non inizializzato. Verifica DATABASE_URL.",
      });
      return;
    }
    try {
      const raw = await readJsonBody(req);
      const { video_id } = parseTranscribeBody(raw);
      const cap = await extractYoutubeCaptions(video_id);
      const pool = getPool();
      await upsertTranscript(pool, {
        video_id,
        transcript: cap.transcript,
        source: "youtube_captions_ytdlp",
        language: cap.language,
      });
      json(res, 200, {
        ok: true,
        video_id,
        source: "youtube_captions_ytdlp",
        language: cap.language,
        subtitle_file: cap.subtitle_file,
        characters: [...cap.transcript].length,
        message:
          "Trascrizione salvata (sottotitoli YouTube). Passo 1 MRA completato.",
      });
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        json(res, 400, { ok: false, error: "invalid_json", message: e.message });
        return;
      }
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode ?? 500;
      json(res, code, {
        ok: false,
        error:
          code === 404
            ? "no_subtitles"
            : code === 400
              ? "bad_request"
              : code === 503
                ? "ytdlp_unavailable"
                : "transcribe_error",
        message: err.message,
      });
    }
    return;
  }

  if (req.method === "GET" && url.startsWith("/insights/mra/transcript/")) {
    if (!dbReady) {
      json(res, 503, { ok: false, error: "database_unavailable" });
      return;
    }
    const id = decodeURIComponent(url.slice("/insights/mra/transcript/".length));
    if (!id || id.includes("..")) {
      json(res, 400, { ok: false, error: "invalid_video_id" });
      return;
    }
    try {
      const pool = getPool();
      const { rows } = await pool.query<{
        video_id: string;
        transcript: string;
        language: string | null;
        char_count: number;
        updated_at: string;
      }>(
        `SELECT video_id, transcript, language, char_count, updated_at::text
         FROM mra_transcripts WHERE video_id = $1`,
        [id],
      );
      if (rows.length === 0) {
        json(res, 404, { ok: false, error: "not_found" });
        return;
      }
      const row = rows[0];
      const transcript = polishTranscriptText(row.transcript);
      json(res, 200, {
        ok: true,
        video_id: row.video_id,
        transcript,
        language: row.language,
        char_count: [...transcript].length,
        updated_at: row.updated_at,
      });
    } catch (e: unknown) {
      json(res, 500, {
        ok: false,
        message: e instanceof Error ? e.message : "Errore lettura DB",
      });
    }
    return;
  }

  if (req.method === "POST" && url === "/insights/mra/analyze") {
    if (!dbReady) {
      json(res, 503, {
        ok: false,
        error: "database_unavailable",
        message: "Database non disponibile.",
      });
      return;
    }
    try {
      const raw = await readJsonBody(req);
      const { video_id } = parseTranscribeBody(raw);
      const pool = getPool();
      const result = await runMraAnalysisFromDb(pool, video_id);
      json(res, 200, {
        ok: true,
        video_id,
        mra_report: result.mra_report,
        model: result.model,
        usage: {
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        },
        transcript_truncated: result.transcript_truncated,
      });
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        json(res, 400, { ok: false, error: "invalid_json", message: e.message });
        return;
      }
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode ?? 500;
      json(res, code, {
        ok: false,
        error:
          code === 404
            ? "no_transcript"
            : code === 503
              ? "llm_unavailable"
              : code === 502
                ? "llm_upstream"
                : "analyze_error",
        message: err.message,
      });
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/insights/mra/archive")) {
    if (!dbReady) {
      json(res, 503, {
        ok: false,
        error: "database_unavailable",
        message: "Database non disponibile.",
      });
      return;
    }
    try {
      const pool = getPool();
      const listRe = /^\/insights\/mra\/archive$/;
      const itemRe = /^\/insights\/mra\/archive\/(\d+)$/;
      if (listRe.test(pathname)) {
        const items = await listMraAnalysisArchiveSummaries(pool);
        json(res, 200, { ok: true, items });
        return;
      }
      const detailMatch = pathname.match(itemRe);
      if (detailMatch) {
        const idNum = Number(detailMatch[1]);
        const item = await getMraAnalysisArchiveById(pool, idNum);
        if (!item) {
          json(res, 404, {
            ok: false,
            error: "not_found",
            message: "Analisi non trovata.",
          });
          return;
        }
        json(res, 200, { ok: true, item });
        return;
      }
      json(res, 400, { ok: false, error: "invalid_path" });
    } catch (e: unknown) {
      json(res, 500, {
        ok: false,
        message: e instanceof Error ? e.message : "Errore lettura archivio",
      });
    }
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/insights/mra/archive/")) {
    if (!dbReady) {
      json(res, 503, {
        ok: false,
        error: "database_unavailable",
        message: "Database non disponibile.",
      });
      return;
    }
    const itemRe = /^\/insights\/mra\/archive\/(\d+)$/;
    const delMatch = pathname.match(itemRe);
    if (!delMatch) {
      json(res, 400, { ok: false, error: "invalid_path" });
      return;
    }
    try {
      const idNum = Number(delMatch[1]);
      const pool = getPool();
      const removed = await deleteMraAnalysisArchiveById(pool, idNum);
      if (!removed) {
        json(res, 404, {
          ok: false,
          error: "not_found",
          message: "Analisi non trovata o già eliminata.",
        });
        return;
      }
      json(res, 200, { ok: true, id: idNum });
    } catch (e: unknown) {
      json(res, 500, {
        ok: false,
        message:
          e instanceof Error ? e.message : "Errore durante l'eliminazione.",
      });
    }
    return;
  }

  if (req.method === "POST" && url === "/insights/mra/archive") {
    if (!dbReady) {
      json(res, 503, {
        ok: false,
        error: "database_unavailable",
        message: "Database non disponibile.",
      });
      return;
    }
    try {
      const raw = await readJsonBody(req);
      const row = parseArchiveBody(raw);
      const pool = getPool();
      const id = await insertMraAnalysisArchive(pool, row);
      json(res, 200, { ok: true, id });
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        json(res, 400, { ok: false, error: "invalid_json", message: e.message });
        return;
      }
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode ?? 500;
      json(res, code, {
        ok: false,
        message: err.message,
      });
    }
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

  json(res, 404, { error: "not_found" });
});

server.listen(port, () => {
  console.log(`[insights-service] http://127.0.0.1:${port}`);
});
