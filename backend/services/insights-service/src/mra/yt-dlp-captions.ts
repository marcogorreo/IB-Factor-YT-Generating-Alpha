import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { srtToPlain, vttToPlain } from "./caption-parse.js";

const WATCH_URL = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/**
 * Risolve il comando yt-dlp:
 * - senza env → "yt-dlp" (deve essere nel PATH)
 * - YTDLP_PATH deve puntare a yt-dlp.exe (o .cmd), NON a …/site-packages/yt_dlp
 * - se l’utente ha messo per sbaglio la cartella del pacchetto, proviamo …/Scripts/yt-dlp.exe
 */
export function resolveYtDlpExecutable(): string {
  const raw = (process.env.YTDLP_PATH ?? "").trim();
  if (!raw) return "yt-dlp";

  let normalized = path.normalize(raw);
  try {
    normalized = path.resolve(normalized);
  } catch {
    return raw;
  }

  if (existsSync(normalized)) {
    try {
      const st = statSync(normalized);
      if (st.isFile()) return normalized;
    } catch {
      return raw;
    }
  }

  // Cartella modulo: …/site-packages/yt_dlp → cercare Scripts accanto a "Python3x"
  const asPosix = normalized.replace(/\\/g, "/");
  if (
    asPosix.toLowerCase().includes("site-packages/yt_dlp") ||
    /[/\\]yt_dlp[/\\]?$/i.test(normalized)
  ) {
    let sitePackages = normalized;
    try {
      const st = statSync(normalized);
      if (st.isDirectory() && /yt_dlp$/i.test(normalized)) {
        sitePackages = path.dirname(normalized);
      } else if (!st.isDirectory()) {
        sitePackages = path.dirname(path.dirname(normalized));
      }
    } catch {
      sitePackages = path.dirname(normalized);
    }
    const pythonRoot = (() => {
      const parent = path.dirname(sitePackages);
      if (path.basename(parent).toLowerCase() === "lib") {
        return path.dirname(parent);
      }
      return parent;
    })();
    const candidates = [
      path.join(pythonRoot, "Scripts", "yt-dlp.exe"),
      path.join(pythonRoot, "Scripts", "yt-dlp.cmd"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }

  return normalized;
}

function ytDlpBin(): string {
  return resolveYtDlpExecutable();
}

function runYtDlp(
  cwd: string,
  videoUrl: string,
): Promise<{ code: number | null; stderr: string }> {
  const bin = ytDlpBin();
  const args = [
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    "it,en",
    "--convert-subs",
    "srt",
    "-o",
    "%(id)s",
    videoUrl,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: process.env,
    });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

/** Priorità: italiano prima, poi inglese, poi altro. */
function pickSubtitleFile(
  names: string[],
  videoId: string,
): { file: string; language: string } | null {
  const subs = names.filter(
    (n) =>
      /\.(srt|vtt)$/i.test(n) && !n.endsWith(".jpg") && !n.endsWith(".webp"),
  );
  if (subs.length === 0) return null;

  const scored = subs.map((file) => {
    const lower = file.toLowerCase();
    let lang = "unknown";
    let score = 0;
    if (lower.includes(".it.") || lower.includes("_it.")) {
      lang = "it";
      score = 100;
    } else if (lower.includes("italian")) {
      lang = "it";
      score = 95;
    } else if (lower.includes(".en.") || lower.includes("_en.")) {
      lang = "en";
      score = 50;
    } else if (lower.includes("english")) {
      lang = "en";
      score = 45;
    } else {
      score = 10;
    }
    if (file.includes(videoId)) score += 1;
    return { file, language: lang, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { file: best.file, language: best.language };
}

export type YoutubeCaptionResult = {
  transcript: string;
  language: string;
  subtitle_file: string;
};

/**
 * Sottotitoli YouTube via yt-dlp (manuali o automatici): niente costo API.
 * Richiede `yt-dlp` nel PATH o `YTDLP_PATH` nel .env.local.
 */
export async function extractYoutubeCaptions(
  videoId: string,
): Promise<YoutubeCaptionResult> {
  const id = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    throw Object.assign(new Error("video_id YouTube non valido"), {
      statusCode: 400,
    });
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mra-cap-"));
  try {
    const url = WATCH_URL(id);
    let result: { code: number | null; stderr: string };
    try {
      result = await runYtDlp(tmpDir, url);
    } catch (e: unknown) {
      const tried = resolveYtDlpExecutable();
      const hint =
        "Imposta YTDLP_PATH sull’eseguibile (es. C:\\…\\Python310\\Scripts\\yt-dlp.exe), " +
        "non sulla cartella site-packages\\yt_dlp. In Powershell: " +
        "(Get-Command yt-dlp).Source — oppure lascia YTDLP_PATH vuoto e aggiungi Scripts al PATH.";
      const msg =
        e instanceof Error
          ? `${e.message} (comando usato: ${tried})`
          : "Impossibile eseguire yt-dlp";
      const err = new Error(`${msg} ${hint}`);
      (err as Error & { statusCode?: number }).statusCode = 503;
      throw err;
    }

    const names = await readdir(tmpDir);
    const picked = pickSubtitleFile(names, id);
    if (!picked) {
      const hint =
        result.code !== 0
          ? ` (yt-dlp exit ${result.code}: ${result.stderr.slice(0, 400)})`
          : "";
      const err = new Error(
        "Nessun sottotitolo trovato per questo video (it/en). " +
          "YouTube potrebbe non offrire tracce scaricabili per questo contenuto." +
          hint,
      );
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const fullPath = path.join(tmpDir, picked.file);
    const raw = await readFile(fullPath, "utf8");
    const transcript = picked.file.toLowerCase().endsWith(".vtt")
      ? vttToPlain(raw)
      : srtToPlain(raw);

    if (!transcript || transcript.length < 20) {
      const err = new Error(
        "Sottotitolo trovato ma testo troppo corto o vuoto dopo la conversione.",
      );
      (err as Error & { statusCode?: number }).statusCode = 422;
      throw err;
    }

    return {
      transcript,
      language: picked.language,
      subtitle_file: picked.file,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
