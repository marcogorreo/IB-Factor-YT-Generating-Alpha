import type { ParsedVideo } from "./youtube-rss.js";
import { fetchLatestVideosFromRss } from "./youtube-rss.js";
import { BROWSER_HEADERS } from "./youtube-constants.js";

type VrOut = {
  videoId: string;
  title: string;
  thumbnail: string | null;
  channelTitle: string | null;
  publishedLabel: string | null;
  /** Se già ISO (es. da RSS) */
  publishedAtIso?: string | null;
};

/** JSON object bilanciato rispetto a stringhe */
function extractBalancedJsonObject(
  html: string,
  openBraceIndex: number,
): string | null {
  let i = openBraceIndex;
  while (i < html.length && html[i] !== "{") i++;
  if (i >= html.length) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (inString) {
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  return null;
}

/**
 * Estrae ytInitialData — più pattern perché YouTube cambia il markup.
 */
export function extractYtInitialData(html: string): unknown | null {
  const needles = [
    "var ytInitialData = ",
    "var ytInitialData=",
    "ytInitialData = ",
    "ytInitialData=",
    'window["ytInitialData"] = ',
    "window['ytInitialData'] = ",
  ];
  for (const needle of needles) {
    const idx = html.indexOf(needle);
    if (idx === -1) continue;
    const from = idx + needle.length;
    /** Salta eventuale BOM / spazio */
    let braceAt = from;
    while (braceAt < html.length && /[\s\uFEFF]/.test(html[braceAt]!)) braceAt++;
    const jsonStr =
      html[braceAt] === "{"
        ? extractBalancedJsonObject(html, braceAt)
        : extractBalancedJsonObject(html, from);
    if (!jsonStr) continue;
    try {
      return JSON.parse(jsonStr) as unknown;
    } catch {
      continue;
    }
  }
  /** Ultimo tentativo rimosso: regex su JSON enorme dà falsi positivi */
  return null;
}

function textFromRuns(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.simpleText === "string") return n.simpleText;
  const runs = n.runs;
  if (Array.isArray(runs)) {
    return runs
      .map((r) =>
        r && typeof r === "object" && "text" in r
          ? String((r as Record<string, unknown>).text)
          : "",
      )
      .join("");
  }
  return "";
}

function extractThumbnail(vr: Record<string, unknown>): string | null {
  const th = vr.thumbnail as Record<string, unknown> | undefined;
  const thumbs = th?.thumbnails as unknown[] | undefined;
  if (!Array.isArray(thumbs) || thumbs.length === 0) return null;
  const last = thumbs[thumbs.length - 1] as Record<string, unknown>;
  return typeof last?.url === "string" ? last.url : null;
}

function rendererFrom(o: Record<string, unknown>): Record<string, unknown> | null {
  return (
    (o.videoRenderer as Record<string, unknown> | undefined) ??
    (o.gridVideoRenderer as Record<string, unknown> | undefined) ??
    (o.compactVideoRenderer as Record<string, unknown> | undefined) ??
    (o.playlistVideoRenderer as Record<string, unknown> | undefined) ??
    null
  );
}

function collectVideoRenderers(
  node: unknown,
  acc: VrOut[],
  seen: Set<string>,
): void {
  if (node === null || node === undefined) return;
  if (typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) collectVideoRenderers(x, acc, seen);
    return;
  }
  const o = node as Record<string, unknown>;
  const vr = rendererFrom(o);
  if (vr && typeof vr.videoId === "string") {
    const id = vr.videoId;
    if (!seen.has(id) && id.length === 11) {
      seen.add(id);
      const title = textFromRuns(vr.title);
      const channelTitle =
        textFromRuns(vr.longBylineText) ||
        textFromRuns(vr.shortBylineText) ||
        textFromRuns(vr.ownerText);
      const publishedLabel =
        (vr.publishedTimeText &&
        typeof vr.publishedTimeText === "object" &&
        vr.publishedTimeText !== null
          ? String(
              (vr.publishedTimeText as Record<string, unknown>).simpleText ?? "",
            )
          : "") || null;
      acc.push({
        videoId: id,
        title: title || "(senza titolo)",
        thumbnail: extractThumbnail(vr),
        channelTitle: channelTitle || null,
        publishedLabel,
      });
    }
  }
  for (const k of Object.keys(o)) {
    collectVideoRenderers(o[k], acc, seen);
  }
}

function relativeLabelToApproxIso(label: string | null): string {
  if (!label) return new Date().toISOString();
  const t = label.toLowerCase();
  const now = Date.now();
  const n = (m: RegExpMatchArray | null) =>
    m ? Number.parseInt(m[1]!, 10) : 0;
  if (/(second|sec|secondo)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 1000).toISOString();
  }
  if (/(minute|min|minuti|minuto)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 60_000).toISOString();
  }
  if (/(hour|ora|ore)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 3_600_000).toISOString();
  }
  if (/(day|giorni|giorno)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 86_400_000).toISOString();
  }
  if (/(week|settiman)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 7 * 86_400_000).toISOString();
  }
  if (/(month|mes)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 30 * 86_400_000).toISOString();
  }
  if (/(year|ann)/i.test(t)) {
    const x = n(t.match(/(\d+)/));
    return new Date(now - x * 365 * 86_400_000).toISOString();
  }
  return new Date().toISOString();
}

function rowsToParsed(
  rows: VrOut[],
  channelId: string,
  limit: number,
): ParsedVideo[] {
  return rows.slice(0, limit).map((row) => ({
    video_id: row.videoId,
    title: row.title,
    thumbnail_url: row.thumbnail,
    published_at:
      row.publishedAtIso ?? relativeLabelToApproxIso(row.publishedLabel),
    channel_id: channelId,
    channel_title: row.channelTitle,
    video_url: `https://www.youtube.com/watch?v=${row.videoId}`,
  }));
}

function uploadsPlaylistId(channelId: string): string {
  if (!channelId.startsWith("UC") || channelId.length < 4) return "";
  return `UU${channelId.slice(2)}`;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function ingestHtml(
  html: string,
  acc: VrOut[],
  seen: Set<string>,
): void {
  const data = extractYtInitialData(html);
  if (data) {
    collectVideoRenderers(data, acc, seen);
  }
}

/**
 * Scarica candidati: più URL + playlist + RSS (niente regex su tutta la pagina:
 * includerebbe anche i consigliati di altri canali, es. Ingegneria Italia).
 */
export async function fetchVideosFromChannelVideosTab(
  handle: string,
  channelId: string,
  targetCount: number,
): Promise<ParsedVideo[]> {
  const clean = handle.replace(/^@/, "").trim();
  const acc: VrOut[] = [];
  const seen = new Set<string>();

  const urls = [
    `https://www.youtube.com/@${encodeURIComponent(clean)}/videos`,
    `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/videos`,
    `https://m.youtube.com/@${encodeURIComponent(clean)}/videos`,
  ];

  for (const u of urls) {
    const html = await fetchText(u);
    if (html) {
      ingestHtml(html, acc, seen);
      if (acc.length >= targetCount) break;
    }
  }

  if (acc.length < targetCount) {
    const listId = uploadsPlaylistId(channelId);
    if (listId) {
      const pUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
      const html = await fetchText(pUrl);
      if (html) {
        ingestHtml(html, acc, seen);
      }
    }
  }

  /** Feed Atom: in genere ~15 video ma sempre coerente (antibot minimo) */
  if (acc.length === 0) {
    try {
      const rss = await fetchLatestVideosFromRss(
        channelId,
        Math.min(targetCount, 50),
      );
      return rss;
    } catch {
      /* continua */
    }
  } else if (acc.length < targetCount) {
    try {
      const rss = await fetchLatestVideosFromRss(channelId, 50);
      for (const v of rss) {
        if (seen.has(v.video_id)) continue;
        seen.add(v.video_id);
        acc.push({
          videoId: v.video_id,
          title: v.title,
          thumbnail: v.thumbnail_url,
          channelTitle: v.channel_title,
          publishedLabel: null,
          publishedAtIso: v.published_at,
        });
        if (acc.length >= targetCount) break;
      }
    } catch {
      /* ok */
    }
  }

  if (acc.length === 0) {
    throw new Error(
      "Impossibile ottenere l’elenco video da YouTube (HTML senza ytInitialData, RSS non disponibile o blocco rete). " +
        "Prova da un’altra rete/VPN, controlla YOUTUBE_CHANNEL_HANDLE / YOUTUBE_CHANNEL_ID, o riprova più tardi.",
    );
  }

  return rowsToParsed(acc, channelId, targetCount);
}
