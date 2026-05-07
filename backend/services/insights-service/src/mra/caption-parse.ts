/** Tag inline (WebVTT / karaoke YouTube: `<c>`, `<00:00:00.000>`, ecc.) */
export function stripCaptionMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_BLOCK_WORDS = 5;
const MAX_BLOCK_WORDS = 72;

function blocksEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Le auto-caption YouTube spesso ripetono la stessa frase (o segmento) 2–3+ volte di seguito.
 * Collassa ripetizioni consecutive dello stesso blocco di parole (da MIN a MAX parole).
 */
export function collapseConsecutiveRepeatedBlocks(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_BLOCK_WORDS * 2) {
    return text.trim();
  }

  const out: string[] = [];
  let i = 0;

  while (i < words.length) {
    let consumed = false;
    const upper = Math.min(MAX_BLOCK_WORDS, words.length - i);

    for (let blockLen = upper; blockLen >= MIN_BLOCK_WORDS; blockLen--) {
      const block = words.slice(i, i + blockLen);
      let repeatCount = 1;
      let j = i + blockLen;
      while (j + blockLen <= words.length) {
        const next = words.slice(j, j + blockLen);
        if (!blocksEqual(block, next)) break;
        repeatCount++;
        j += blockLen;
      }
      if (repeatCount >= 2) {
        out.push(...block);
        i = j;
        consumed = true;
        break;
      }
    }

    if (!consumed) {
      out.push(words[i]);
      i++;
    }
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** Post-process completo per sottotitoli salvati o letti da DB. */
export function polishTranscriptText(text: string): string {
  const stripped = stripCaptionMarkup(text);
  return collapseConsecutiveRepeatedBlocks(stripped);
}

/** Converte SRT in testo continuo (senza timestamp / indici). */
export function srtToPlain(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  const timeRe = /^\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s+-->/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^\d+$/.test(t)) continue;
    if (timeRe.test(t)) continue;
    out.push(t);
  }
  const joined = out.join(" ").replace(/\s+/g, " ").trim();
  return polishTranscriptText(joined);
}

/** Converte WebVTT in testo continuo. */
export function vttToPlain(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  const timeOrNote =
    /^\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s+-->|^NOTE\b|^STYLE\b|^REGION\b|^Kind:/i;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("WEBVTT")) continue;
    if (timeOrNote.test(t)) continue;
    if (/^\d+$/.test(t)) continue;
    if (t.startsWith("{")) continue;
    out.push(t);
  }
  const joined = out.join(" ").replace(/\s+/g, " ").trim();
  return polishTranscriptText(joined);
}
