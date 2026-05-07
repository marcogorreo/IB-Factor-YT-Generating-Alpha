/**
 * Converte un ticker testuale (come salvato nell’analisi MRA) in un simbolo
 * TradingView `EXCHANGE:SYMBOL`. Best-effort: l’utente può modificare il simbolo
 * dal grafico se non corrisponde alla borsa corretta.
 * @see https://www.tradingview.com/widget-docs/widgets/charts/charts/
 *
 * Simboli “nudi” (senza suffisso / senza EXCHANGE:) possono essere risolti lato
 * server via OpenFIGI — vedi `shouldResolveTradingViewSymbol` e
 * `/api/tradingview/resolve`.
 */
import { tryTradingViewIndexAliasFromKey } from "./tradingview-index-aliases";

const KNOWN_SUFFIXES = [
  ".MI",
  ".L",
  ".DE",
  ".PA",
  ".AS",
  ".SW",
  ".SWI",
  ".BR",
  ".MC",
  ".LS",
  ".VI",
  ".ST",
  ".OL",
  ".HE",
  ".SS",
  ".SZ",
  ".HK",
  ".T",
  ".CO",
  ".TA",
] as const;

export function shouldResolveTradingViewSymbol(tickerRaw: string): boolean {
  const t = tickerRaw.trim();
  if (!t || t.includes(":")) return false;
  const u = t.toUpperCase();
  for (const suf of KNOWN_SUFFIXES) {
    if (u.endsWith(suf)) return false;
  }
  return true;
}

export function toTradingViewSymbol(tickerRaw: string): string {
  const t = tickerRaw.trim();
  if (!t) return "NASDAQ:AAPL";

  if (t.includes(":")) return t;

  const u = t.toUpperCase();

  if (u.endsWith(".MI")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `MIL:${sym}` : "MIL:ISP";
  }
  if (u.endsWith(".L")) {
    const sym = u.slice(0, -2).replace(/[^A-Z0-9]/g, "");
    return sym ? `LSE:${sym}` : "LSE:VOD";
  }
  if (u.endsWith(".DE")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `XETR:${sym}` : "XETR:SIE";
  }
  if (u.endsWith(".PA")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `EPA:${sym}` : "EPA:TTE";
  }
  if (u.endsWith(".AS")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `EURONEXT:${sym}` : "EURONEXT:ASML";
  }
  if (u.endsWith(".SWI")) {
    const sym = u.slice(0, -4).replace(/[^A-Z0-9]/g, "");
    return sym ? `SIX:${sym}` : "SIX:NESTLE";
  }
  if (u.endsWith(".SW")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `SIX:${sym}` : "SIX:NESTLE";
  }
  if (u.endsWith(".BR")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `EURONEXT:${sym}` : "EURONEXT:ABI";
  }
  if (u.endsWith(".LS")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `EURONEXT:${sym}` : "EURONEXT:GALP";
  }
  if (u.endsWith(".MC")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `BME:${sym}` : "BME:SAN";
  }
  if (u.endsWith(".VI")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `VIE:${sym}` : "VIE:VOE";
  }
  if (u.endsWith(".ST")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `STO:${sym}` : "STO:ERIC-B";
  }
  if (u.endsWith(".OL")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `OSL:${sym}` : "OSL:EQNR";
  }
  if (u.endsWith(".HE")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `OMXHEX:${sym}` : "OMXHEX:NOKIA";
  }
  if (u.endsWith(".SS")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `SSE:${sym}` : "SSE:600519";
  }
  if (u.endsWith(".SZ")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `SZSE:${sym}` : "SZSE:000001";
  }
  if (u.endsWith(".HK")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `HKEX:${sym}` : "HKEX:700";
  }
  if (u.endsWith(".T")) {
    const sym = u.slice(0, -2).replace(/[^A-Z0-9]/g, "");
    return sym ? `TSE:${sym}` : "TSE:7203";
  }
  if (u.endsWith(".CO")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `OMXCOP:${sym}` : "OMXCOP:NOVO-B";
  }
  if (u.endsWith(".TA")) {
    const sym = u.slice(0, -3).replace(/[^A-Z0-9]/g, "");
    return sym ? `TASE:${sym}` : "TASE:TEVA";
  }

  const clean = u.replace(/[^A-Z0-9.-]/g, "");
  if (!clean) return "NASDAQ:AAPL";

  const indexSym = tryTradingViewIndexAliasFromKey(clean);
  if (indexSym) return indexSym;

  return `NASDAQ:${clean}`;
}
