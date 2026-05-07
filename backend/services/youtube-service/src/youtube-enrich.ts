import type { ParsedVideo } from "./youtube-rss.js";
import {
  fetchOembedAuthorName,
  looksIngegneriaItaliaUploader,
} from "./youtube-oembed.js";
import { fetchWatchPageMeta } from "./youtube-watch-meta.js";

const DEFAULT_CHANNEL_DISPLAY = "Ingegneri in Borsa";

/**
 * Per ogni video: legge /watch per **data di pubblicazione reale** e **nome canale uploader**;
 * scarta se l’uploader è Ingegneria Italia. Fallback oEmbed solo sul nome se la pagina non ha ownerChannelName.
 */
export async function enrichDatesAndChannelAndExcludeIi(
  videos: ParsedVideo[],
): Promise<ParsedVideo[]> {
  const out: ParsedVideo[] = [];
  for (const v of videos) {
    const meta = await fetchWatchPageMeta(v.video_id);
    if (meta.isIngegneriaItaliaUploader) {
      continue;
    }

    let channelTitle = meta.channelTitle ?? v.channel_title ?? null;
    if (!channelTitle?.trim()) {
      channelTitle = (await fetchOembedAuthorName(v.video_id)) ?? null;
      if (channelTitle && looksIngegneriaItaliaUploader(channelTitle)) {
        continue;
      }
    }

    let publishedAt = meta.publishedAtIso ?? v.published_at;
    if (!publishedAt || Number.isNaN(new Date(publishedAt).getTime())) {
      publishedAt = v.published_at;
    }

    out.push({
      ...v,
      published_at: publishedAt,
      channel_title: channelTitle?.trim() || DEFAULT_CHANNEL_DISPLAY,
    });
    await new Promise((r) => setTimeout(r, 55));
  }
  return out;
}

export { DEFAULT_CHANNEL_DISPLAY };
