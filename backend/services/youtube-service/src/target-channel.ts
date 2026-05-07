import { resolveChannelId } from "./youtube-rss.js";

let cachedId: string | null = null;

export function getTargetHandle(): string {
  return process.env.YOUTUBE_CHANNEL_HANDLE?.trim() || "Ingegneriinborsa";
}

/**
 * ID canale (UC…) usato per import e lista. Cache in memoria fino al restart.
 *
 * - `YOUTUBE_CHANNEL_ID` in .env se già noto
 * - altrimenti risoluzione da `YOUTUBE_CHANNEL_HANDLE` (default: Ingegneri in Borsa)
 */
export async function getTargetChannelId(): Promise<string> {
  if (cachedId) {
    return cachedId;
  }
  const forced = process.env.YOUTUBE_CHANNEL_ID?.trim();
  if (forced) {
    cachedId = forced;
    return forced;
  }
  cachedId = await resolveChannelId(getTargetHandle());
  return cachedId;
}
