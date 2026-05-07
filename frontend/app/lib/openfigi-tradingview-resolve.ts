/**
 * Risolve ticker → simbolo TradingView tramite OpenFIGI (no API key).
 * Usato solo da route handler server.
 */

import { tryTradingViewIndexAliasFromKey } from "./tradingview-index-aliases";
import { toTradingViewSymbol } from "./tradingview-symbol";

const OPENFIGI_MAPPING = "https://api.openfigi.com/v3/mapping";
const OPENFIGI_SEARCH = "https://api.openfigi.com/v3/search";

/** Ordine: borse USA più frequenti (XNYS prima di XNAS per NYSE-listed). */
const US_MIC_PRIORITY: readonly { mic: string; tv: string }[] = [
  { mic: "XNYS", tv: "NYSE" },
  { mic: "XNAS", tv: "NASDAQ" },
  { mic: "XNGS", tv: "NASDAQ" },
  { mic: "XNMS", tv: "NASDAQ" },
  { mic: "XNCM", tv: "NASDAQ" },
  { mic: "ARCX", tv: "NYSEARCA" },
  { mic: "XASE", tv: "AMEX" },
  { mic: "BATS", tv: "BATS" },
];

/**
 * MIC EU + Cina + Euronext + Nordics. Usato se il titolo non matcha le borse USA.
 * Ordine: DE → IT → NL → FR → UK → NO → BE → CN (SSE/SZSE) → HK → altre sedi Euronext / nordiche.
 */
const EU_CH_MIC_PRIORITY: readonly { mic: string; tv: string }[] = [
  { mic: "XETR", tv: "XETR" },
  { mic: "XFRA", tv: "FWB" },
  { mic: "XMIL", tv: "MIL" },
  { mic: "XAMS", tv: "EURONEXT" },
  { mic: "XPAR", tv: "EPA" },
  { mic: "XLON", tv: "LSE" },
  { mic: "XOSL", tv: "OSL" },
  { mic: "XBRU", tv: "EURONEXT" },
  { mic: "XSHG", tv: "SSE" },
  { mic: "XSHE", tv: "SZSE" },
  { mic: "XHKG", tv: "HKEX" },
  { mic: "XLIS", tv: "EURONEXT" },
  { mic: "XDUB", tv: "EURONEXT" },
  { mic: "XSTO", tv: "STO" },
  { mic: "XHEL", tv: "OMXHEX" },
  { mic: "XCSE", tv: "OMXCOP" },
  { mic: "XWAR", tv: "GPW" },
];

/**
 * Codici cambio Bloomberg (campo exchCode in search OpenFIGI) → prefisso TradingView.
 * Non esaustivo: copre USA (UN) ed Europa / Cina / Hong Kong oltre al passaggio MIC.
 */
const BLOOMBERG_EXCH_TO_TV: Record<string, string> = {
  /** Cina / Hong Kong */
  CG: "SSE",
  CR: "SSE",
  C1: "SSE",
  CH: "SSE",
  CS: "SZSE",
  C2: "SZSE",
  DS: "SZSE",
  HK: "HKEX",
  /** Italia */
  IM: "MIL",
  /** Regno Unito */
  LN: "LSE",
  /** Germania */
  GY: "XETR",
  GR: "XETR",
  GF: "XETR",
  SX: "XETR",
  /** Francia */
  FP: "EPA",
  /** Paesi Bassi / Euronext Amsterdam */
  NA: "EURONEXT",
  AN: "EURONEXT",
  /** Belgio */
  BB: "EURONEXT",
  /** Portogallo (Lisbona), Irlanda (Dublin) su Euronext */
  PL: "EURONEXT",
  LS: "EURONEXT",
  ID: "EURONEXT",
  /** Norvegia */
  NO: "OSL",
  OL: "OSL",
  /** Svezia */
  SS: "STO",
  /** Finlandia */
  FH: "OMXHEX",
  /** Danimarca */
  DC: "OMXCOP",
  /** Austria */
  AV: "VIE",
  WV: "VIE",
  VI: "VIE",
  /** Polonia */
  PQ: "GPW",
  PW: "GPW",
  /** Spagna */
  SP: "BME",
  SM: "BME",
  /** Altro */
  JT: "TSE",
  KS: "KRX",
  /** USA: listing più specifici del codice “UN” aggregato (SPY → NYSEARCA, non NYSE) */
  UP: "NYSEARCA",
  UA: "AMEX",
  UW: "OTC",
  UC: "OTC",
};

/**
 * Quando la search ha più listing, ordina per rilevanza geografica (come EU_CH_MIC).
 */
const EXCH_SEARCH_RANK: Record<string, number> = {
  GY: 10,
  GR: 10,
  GF: 10,
  SX: 10,
  IM: 20,
  NA: 30,
  AN: 30,
  FP: 40,
  LN: 50,
  NO: 60,
  OL: 60,
  BB: 70,
  PL: 80,
  LS: 80,
  ID: 85,
  CG: 90,
  CR: 90,
  C1: 90,
  CH: 90,
  CS: 95,
  C2: 95,
  DS: 95,
  HK: 100,
  AV: 110,
  WV: 110,
  VI: 110,
  SS: 120,
  FH: 130,
  DC: 140,
  PQ: 150,
  PW: 150,
  SP: 160,
  SM: 160,
  UP: 25,
  UA: 26,
  UW: 200,
  UC: 200,
};

type OpenFigiMappingBlock = {
  data?: Array<Record<string, unknown>>;
  warning?: string;
};

type OpenFigiSearchRow = {
  ticker?: string;
  exchCode?: string | null;
  securityType?: string;
  securityType2?: string;
  marketSector?: string;
  name?: string;
  compositeFIGI?: string | null;
};

const cache = new Map<
  string,
  { symbol: string; exp: number; source: "mic" | "search" | "index_alias" }
>();
const TTL_MS = 1000 * 60 * 60 * 24;

function cleanTicker(q: string): string | null {
  const t = q.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!t || t.length > 32) return null;
  return t;
}

async function openfigiPost<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 429) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type MappingRow = {
  ticker?: string;
  exchCode?: string | null;
};

function symbolFromMappingRow(
  row: MappingRow,
  fallbackTicker: string,
  tvExchange: string,
): string {
  const sym = (row.ticker ?? fallbackTicker).trim().toUpperCase();
  const base = sym.split(/\s+/)[0] ?? sym;
  const clean = base.replace(/[^A-Z0-9._-]/g, "") || fallbackTicker;
  return `${tvExchange}:${clean}`;
}

/**
 * OpenFIGI spesso restituisce `exchCode: "UN"` (US consolidato) anche per ARCA/Amex:
 * il primo MIC con data non è il listino “vero”. Saltiamo UN al 1° passaggio.
 */
async function resolveViaMicList(
  ticker: string,
  list: readonly { mic: string; tv: string }[],
): Promise<string | null> {
  if (!list.length) return null;
  const jobs = list.map(({ mic }) => ({
    idType: "TICKER",
    idValue: ticker,
    micCode: mic,
  }));

  const parsed = await openfigiPost<OpenFigiMappingBlock[]>(
    OPENFIGI_MAPPING,
    jobs,
  );
  if (!Array.isArray(parsed)) return null;

  const hits: { row: MappingRow; tv: string }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const block = parsed[i];
    const row = block?.data?.[0] as MappingRow | undefined;
    if (block?.data?.length && row?.ticker) {
      const tv = list[i]?.tv;
      if (tv) hits.push({ row, tv });
    }
  }

  for (const { row, tv } of hits) {
    const ex = row.exchCode?.trim();
    if (ex === "UN") continue;
    return symbolFromMappingRow(row, ticker, tv);
  }

  const first = hits[0];
  if (first) return symbolFromMappingRow(first.row, ticker, first.tv);
  return null;
}

function mapExchSearchRow(row: OpenFigiSearchRow, ticker: string): string | null {
  const ex = row.exchCode?.trim();
  if (!ex || ex === "UN") return null;
  const tv = BLOOMBERG_EXCH_TO_TV[ex];
  if (tv) return `${tv}:${ticker}`;
  return null;
}

function tickerCellsMatch(rowTicker: string, want: string): boolean {
  const w = want.toUpperCase().trim();
  const t = (rowTicker ?? "").toUpperCase().trim();
  if (t === w) return true;
  const first = t.split(/\s+/)[0]?.replace(/[^A-Z0-9]/g, "") ?? "";
  const wClean = w.replace(/[^A-Z0-9]/g, "");
  return first === wClean;
}

function isEquityLike(r: OpenFigiSearchRow): boolean {
  if (r.marketSector !== "Equity") return false;
  const st = `${r.securityType2 ?? ""} ${r.securityType ?? ""}`.toUpperCase();
  if (st.includes("OPTION") || st.includes("WARRANT")) return false;
  return (
    st.includes("COMMON") ||
    st.includes("STOCK") ||
    st.includes("ETF") ||
    st.includes("ETP") ||
    st.includes("REIT") ||
    st.includes("DEPOSITARY") ||
    st.includes("ADR") ||
    st.includes("MUTUAL FUND")
  );
}

function isIndexLike(r: OpenFigiSearchRow): boolean {
  const ms = (r.marketSector ?? "").toUpperCase();
  const st = `${r.securityType2 ?? ""} ${r.securityType ?? ""}`.toUpperCase();
  if (st.includes("OPTION") && !st.includes("INDEX")) return false;
  if (st.includes("FUTURE") || st.includes("FUT ")) return false;
  if (ms.includes("INDEX")) return true;
  if (st.includes("INDEX")) return true;
  return false;
}

function isSearchInstrument(r: OpenFigiSearchRow): boolean {
  return isEquityLike(r) || isIndexLike(r);
}

/** OpenFIGI /v3/search: niente `num_results` — si pagina con `next` / `start`. */
async function fetchSearchAllPages(
  query: string,
  maxPages = 4,
): Promise<OpenFigiSearchRow[]> {
  const out: OpenFigiSearchRow[] = [];
  let start: string | undefined;

  for (let p = 0; p < maxPages; p++) {
    const body: Record<string, string> = { query };
    if (start) body.start = start;

    const parsed = await openfigiPost<{
      data?: OpenFigiSearchRow[];
      error?: string;
      next?: string;
    }>(OPENFIGI_SEARCH, body);

    if (!parsed || parsed.error) break;
    if (Array.isArray(parsed.data) && parsed.data.length) {
      out.push(...parsed.data);
    }
    if (!parsed.next) break;
    start = parsed.next;
  }
  return out;
}

async function resolveViaSearch(ticker: string): Promise<string | null> {
  const rows = await fetchSearchAllPages(ticker);
  if (!rows.length) return null;

  const candidates = rows.filter((r) => {
    if (!tickerCellsMatch(r.ticker ?? "", ticker)) return false;
    return isSearchInstrument(r);
  });

  /** Preferisci match con exchCode mappabile e non-UN. */
  const scored = candidates
    .map((r) => ({
      row: r,
      sym: mapExchSearchRow(r, ticker),
    }))
    .filter((x) => x.sym != null) as { row: OpenFigiSearchRow; sym: string }[];

  /** Preferisci listing con exchCode ordinato (Europa / Cina come da richiesta). */
  scored.sort((a, b) => {
    const exA = a.row.exchCode?.trim() ?? "";
    const exB = b.row.exchCode?.trim() ?? "";
    const ra = EXCH_SEARCH_RANK[exA] ?? 500;
    const rb = EXCH_SEARCH_RANK[exB] ?? 500;
    if (ra !== rb) return ra - rb;
    return 0;
  });

  if (scored.length) return scored[0].sym;

  return null;
}

export type ResolveTradingViewSymbolResult = {
  symbol: string;
  source: "mic" | "search" | "fallback" | "index_alias";
};

export async function resolveTradingViewSymbolLoose(
  q: string,
): Promise<ResolveTradingViewSymbolResult> {
  const ticker = cleanTicker(q);
  if (!ticker) {
    return { symbol: toTradingViewSymbol(q), source: "fallback" };
  }

  const now = Date.now();
  const hit = cache.get(ticker);
  if (hit && hit.exp > now) {
    return { symbol: hit.symbol, source: hit.source };
  }

  const fromIndexAlias = tryTradingViewIndexAliasFromKey(ticker);
  if (fromIndexAlias) {
    cache.set(ticker, {
      symbol: fromIndexAlias,
      exp: now + TTL_MS,
      source: "index_alias",
    });
    return { symbol: fromIndexAlias, source: "index_alias" };
  }

  const fromUs = await resolveViaMicList(ticker, US_MIC_PRIORITY);
  if (fromUs) {
    cache.set(ticker, { symbol: fromUs, exp: now + TTL_MS, source: "mic" });
    return { symbol: fromUs, source: "mic" };
  }

  const fromEuCh = await resolveViaMicList(ticker, EU_CH_MIC_PRIORITY);
  if (fromEuCh) {
    cache.set(ticker, {
      symbol: fromEuCh,
      exp: now + TTL_MS,
      source: "mic",
    });
    return { symbol: fromEuCh, source: "mic" };
  }

  const fromSearch = await resolveViaSearch(ticker);
  if (fromSearch) {
    cache.set(ticker, {
      symbol: fromSearch,
      exp: now + TTL_MS,
      source: "search",
    });
    return { symbol: fromSearch, source: "search" };
  }

  const fb = toTradingViewSymbol(ticker);
  return { symbol: fb, source: "fallback" };
}
