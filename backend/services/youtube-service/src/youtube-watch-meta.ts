import { BROWSER_HEADERS } from "./youtube-constants.js";

/**
 * Estrazione oggetto JSON con parentesi graffe bilanciate (stringhe `"` rispettate).
 */
function extractBalancedJsonObject(html: string, openBraceIndex: number): string | null {
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

export function extractYtInitialPlayerResponse(html: string): unknown | null {
  const needles = [
    "var ytInitialPlayerResponse = ",
    "var ytInitialPlayerResponse=",
    "ytInitialPlayerResponse = ",
  ];
  for (const needle of needles) {
    const idx = html.indexOf(needle);
    if (idx === -1) continue;
    const from = idx + needle.length;
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
  return null;
}

function toIsoUtc(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

type Findings = { publishDate?: string; ownerChannelName?: string };

function walkFindPlayerMeta(
  node: unknown,
  acc: Findings,
  depth = 0,
): void {
  if (depth > 40 || node === null || node === undefined) return;
  if (typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkFindPlayerMeta(x, acc, depth + 1);
    return;
  }
  const r = node as Record<string, unknown>;
  if (typeof r.publishDate === "string" && /T\d{2}:|\d{4}-\d{2}-\d{2}/.test(r.publishDate)) {
    if (!acc.publishDate) acc.publishDate = r.publishDate;
  }
  if (
    typeof r.ownerChannelName === "string" &&
    r.ownerChannelName.length > 0 &&
    !acc.ownerChannelName
  ) {
    acc.ownerChannelName = r.ownerChannelName;
  }
  for (const k of Object.keys(r)) {
    walkFindPlayerMeta(r[k], acc, depth + 1);
  }
}

export type WatchPageMeta = {
  publishedAtIso: string | null;
  channelTitle: string | null;
  isIngegneriaItaliaUploader: boolean;
};

/**
 * Un GET su /watch — contiene publishDate e ownerChannelName affidabili.
 */
export async function fetchWatchPageMeta(videoId: string): Promise<WatchPageMeta> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!res.ok) {
      return {
        publishedAtIso: null,
        channelTitle: null,
        isIngegneriaItaliaUploader: false,
      };
    }
    const html = await res.text();

    const metaTag = html.match(
      /<meta[^>]+itemprop="datePublished"[^>]+content="([^"]+)"/i,
    );
    let publishedIso: string | null = null;
    if (metaTag?.[1]) {
      publishedIso = toIsoUtc(metaTag[1]!);
    }

    const pr = extractYtInitialPlayerResponse(html);
    const acc: Findings = {};
    if (pr && typeof pr === "object") {
      const prRec = pr as Record<string, unknown>;
      const mf = prRec.microformat as Record<string, unknown> | undefined;
      const pmr = mf?.playerMicroformatRenderer as
        | Record<string, unknown>
        | undefined;
      if (typeof pmr?.publishDate === "string") {
        acc.publishDate = pmr.publishDate;
      }
      if (typeof pmr?.ownerChannelName === "string") {
        acc.ownerChannelName = pmr.ownerChannelName;
      }
      if (!acc.publishDate || !acc.ownerChannelName) {
        walkFindPlayerMeta(pr, acc);
      }
    }
    if (acc.publishDate) {
      publishedIso = toIsoUtc(acc.publishDate) ?? publishedIso;
    }

    const channelTitle = acc.ownerChannelName?.trim() || null;
    const ii =
      channelTitle?.toLowerCase().includes("ingegneria italia") ?? false;

    return {
      publishedAtIso: publishedIso,
      channelTitle,
      isIngegneriaItaliaUploader: ii,
    };
  } catch {
    return {
      publishedAtIso: null,
      channelTitle: null,
      isIngegneriaItaliaUploader: false,
    };
  }
}
