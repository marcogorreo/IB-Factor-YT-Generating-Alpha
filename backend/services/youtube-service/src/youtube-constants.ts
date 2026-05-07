export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  /** Evita Brotli se la runtime Node non decomprime (di solito ok con fetch undici) */
  "Accept-Encoding": "gzip, deflate",
  Referer: "https://www.youtube.com/",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  /**
   * Consenso base (EU): senza di questo YouTube può rispondere con shell senza dati.
   */
  Cookie: "CONSENT=YES+cb; PREF=hl=it&tz=Europe.Rome&f4=4000000",
};
