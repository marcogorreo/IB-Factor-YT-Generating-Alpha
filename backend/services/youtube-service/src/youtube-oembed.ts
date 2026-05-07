import type { ParsedVideo } from "./youtube-rss.js";
import { BROWSER_HEADERS } from "./youtube-constants.js";

type OembedPayload = {
  author_name?: string;
};

/**
 * Nome canale (autore) dal oEmbed pubblico di YouTube — leggero, utile come fallback.
 */
export async function fetchOembedAuthorName(
  videoId: string,
): Promise<string | null> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as OembedPayload;
    return typeof j.author_name === "string" ? j.author_name : null;
  } catch {
    return null;
  }
}

/** Interno: usato dopo enrich per eccezioni */
export function looksIngegneriaItaliaUploader(name: string): boolean {
  return name.toLowerCase().normalize("NFKC").includes("ingegneria italia");
}
