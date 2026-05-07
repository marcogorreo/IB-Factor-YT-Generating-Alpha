import { XMLParser } from "fast-xml-parser";
import { BROWSER_HEADERS } from "./youtube-constants.js";

export type ParsedVideo = {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  channel_id: string;
  channel_title: string | null;
  video_url: string;
};

function extractChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /"channelId":"(UC[a-zA-Z0-9_-]{22})"/,
    /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
    /"browseId":"(UC[a-zA-Z0-9_-]{22})".*"browseEndpoint"/,
    /channel_id=([a-zA-Z0-9_-]{22})/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.startsWith("UC") && m[1].length === 24) {
      return m[1];
    }
  }
  return null;
}

/**
 * Risolve l'ID canale (UC…) dall'handle @nome usando la pagina pubblica.
 */
export async function resolveChannelId(handle: string): Promise<string> {
  const clean = handle.replace(/^@/, "").trim();
  const url = `https://www.youtube.com/@${clean}`;
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new Error(
      `Impossibile caricare il canale (${res.status}): ${url}`,
    );
  }
  const html = await res.text();
  const id = extractChannelIdFromHtml(html);
  if (!id) {
    throw new Error(
      "Channel ID non trovato nella pagina YouTube. Imposta YOUTUBE_CHANNEL_ID in .env.local.",
    );
  }
  return id;
}

function pickText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "#text" in v) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return String(v);
}

function normalizeEntry(raw: Record<string, unknown>): ParsedVideo | null {
  let videoId =
    pickText(raw["yt:videoId"]) ||
    pickText(raw["videoId"]) ||
    (typeof raw["id"] === "string" ? raw["id"] : pickText(raw["id"]));

  if (videoId.includes("yt:video:")) {
    videoId = videoId.split("yt:video:").pop() ?? videoId;
  }
  videoId = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    const link =
      raw.link ??
      (Array.isArray(raw.link) ? raw.link[0] : undefined) as
        | Record<string, unknown>
        | undefined;
    const href =
      link && typeof link === "object" && link !== null && "@_href" in link
        ? String(link["@_href"])
        : "";
    const fromWatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (fromWatch) {
      videoId = fromWatch[1]!;
    }
  }

  const title = pickText(raw["title"]);
  const published = pickText(raw["published"] || raw["updated"]);
  const authorName = raw["author"];
  let channel_title: string | null = null;
  if (
    authorName &&
    typeof authorName === "object" &&
    authorName !== null &&
    "name" in authorName
  ) {
    channel_title = pickText((authorName as Record<string, unknown>)["name"]);
  }

  const mediaGroup = raw["media:group"] || raw["group"];
  let thumbnail_url: string | null = null;
  if (mediaGroup && typeof mediaGroup === "object") {
    const mg = mediaGroup as Record<string, unknown>;
    const thumb = mg["media:thumbnail"] ?? mg["thumbnail"];
    const t =
      Array.isArray(thumb) && thumb[0]
        ? (thumb[0] as Record<string, unknown>)
        : (thumb as Record<string, unknown> | undefined);
    if (t && "@_url" in t) {
      thumbnail_url = String(t["@_url"]);
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId) || !title || !published) {
    return null;
  }

  const channelFromFeed =
    pickText(raw["yt:channelId"]) || pickText(raw["channelId"]);
  const channel_id =
    channelFromFeed && /^UC[a-zA-Z0-9_-]{22}$/.test(channelFromFeed)
      ? channelFromFeed
      : "";

  return {
    video_id: videoId,
    title,
    thumbnail_url,
    published_at: new Date(published).toISOString(),
    channel_id,
    channel_title,
    video_url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/**
 * Ultimi N video dal feed Atom ufficiale del canale.
 */
export async function fetchLatestVideosFromRss(
  channelId: string,
  limit: number,
): Promise<ParsedVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(feedUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new Error(`Feed RSS non disponibile (${res.status})`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) =>
      name === "entry" || name === "link" || name === "media:thumbnail",
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const feed = (doc.feed ?? doc) as Record<string, unknown>;
  const entriesRaw = feed.entry;
  const entries: Record<string, unknown>[] = Array.isArray(entriesRaw)
    ? entriesRaw
    : entriesRaw
      ? [entriesRaw as Record<string, unknown>]
      : [];

  const out: ParsedVideo[] = [];
  for (const e of entries) {
    const v = normalizeEntry(e);
    if (!v) continue;
    if (!v.channel_id) {
      v.channel_id = channelId;
    }
    out.push(v);
    if (out.length >= limit) break;
  }

  if (out.length === 0) {
    throw new Error("Nessun video trovato nel feed RSS");
  }

  return out;
}
