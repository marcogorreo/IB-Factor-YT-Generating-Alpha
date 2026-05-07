import type { ParsedVideo } from "./youtube-rss.js";

/**
 * Il pool di video è già preso dalla griglia / playlist / RSS del **canale configurato**
 * (`YOUTUBE_CHANNEL_HANDLE`). Qui escludiamo solo ciò che è chiaramente altro brand
 * (Ingegneria Italia), senza esigere che titolo o byline ripetano «Ingegneri in Borsa»:
 * altrimenti restano fuori i video «normali» del canale e restano solo le collaborazioni
 * (che spesso citano il nome nel titolo).
 */
export function isIngegneriInBorsaVideo(v: ParsedVideo): boolean {
  const ch = (v.channel_title || "").toLowerCase().normalize("NFKC");
  const title = v.title.toLowerCase().normalize("NFKC");

  /** Contenuti esplicitamente del canale / serie Ingegneria Italia (industria) */
  if (ch.includes("ingegneria italia") || title.includes("ingegneria italia")) {
    return false;
  }
  if (title.includes("#ingegneriaindustria")) {
    return false;
  }
  /** Sottotitolo / host comune nei video II */
  if (/\|\s*ingegneria\s+italia\b/i.test(title)) {
    return false;
  }
  if (/\bcon\s+ingegneria\s+italia\b/i.test(title)) {
    return false;
  }

  /** Tutto il resto: upload del canale, live, collaborazioni, ecc. */
  return true;
}
