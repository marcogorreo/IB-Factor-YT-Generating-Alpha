/**
 * Nomi “umani” / Yahoo-style per indici → simboli TradingView `BORSA:SIMBOLO`.
 * @see https://www.tradingview.com/markets/indices/
 */

const INDEX_ALIASES: Record<string, string> = {
  // —— USA ——
  SP500: "SP:SPX",
  SPX500: "SP:SPX",
  SNP500: "SP:SPX",
  SPX: "SP:SPX",
  GSPC: "SP:SPX",
  INX: "SP:SPX",
  US500: "SP:SPX",
  SP500USD: "SP:SPX",
  NASDAQ: "NASDAQ:IXIC",
  IXIC: "NASDAQ:IXIC",
  COMPQ: "NASDAQ:IXIC",
  NASDAQCOMPOSITE: "NASDAQ:IXIC",
  NASDAQ100: "NASDAQ:NDX",
  NDX: "NASDAQ:NDX",
  US100: "NASDAQ:NDX",
  DJI: "DJ:DJI",
  DJIA: "DJ:DJI",
  DOW: "DJ:DJI",
  DOWJONES: "DJ:DJI",
  US30: "DJ:DJI",
  RUT: "TVC:RUT",
  US2000: "TVC:RUT",
  RUSSELL2000: "TVC:RUT",
  RUSSELL: "TVC:RUT",
  VIX: "TVC:VIX",
  US10Y: "TVC:US10Y",
  US02Y: "TVC:US02Y",
  // —— Europa ——
  DAX: "XETR:DAX",
  DAXX: "XETR:DAX",
  GER30: "XETR:DAX",
  GER40: "XETR:DAX",
  DE30: "XETR:DAX",
  DE40: "XETR:DAX",
  MIB: "INDEX:FTSEMIB",
  FTMIB: "INDEX:FTSEMIB",
  FTSEMIB: "INDEX:FTSEMIB",
  IT40: "INDEX:FTSEMIB",
  ITMIB: "INDEX:FTSEMIB",
  STOXX50: "STOXX:SX5E",
  EU50: "STOXX:SX5E",
  EUROSTOXX50: "STOXX:SX5E",
  SX5E: "STOXX:SX5E",
  ESTX50: "STOXX:SX5E",
  CAC40: "EURONEXT:PX1",
  FRA40: "EURONEXT:PX1",
  UK100: "FTSE:UKX",
  FTSE100: "FTSE:UKX",
  UKX: "FTSE:UKX",
  FTSE: "FTSE:UKX",
  IBEX35: "BME:IBC",
  AEX: "EURONEXT:AEX",
  // —— Asia / altri (nomi frequenti) ——
  NIKKEI: "TVC:NI225",
  NIKKEI225: "TVC:NI225",
  N225: "TVC:NI225",
  JP225: "TVC:NI225",
  HSI: "HKEX:HSI",
  HANGSENG: "HKEX:HSI",
  SHCOMP: "SSE:000001",
  SSEC: "SSE:000001",
};

/** Chiave: solo A–Z e 0–9, maiuscolo. */
function normalizeIndexAliasKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/&/g, "")
    .replace(/\s+/g, "")
    .replace(/\.+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Se riconosciuto, restituisce `BORSA:SIMBOLO` per il widget TradingView. */
export function tryTradingViewIndexAliasFromKey(rawOrKey: string): string | null {
  const k = normalizeIndexAliasKey(rawOrKey);
  if (!k) return null;
  return INDEX_ALIASES[k] ?? null;
}
