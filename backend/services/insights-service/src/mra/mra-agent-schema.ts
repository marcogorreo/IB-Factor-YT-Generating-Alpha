/**
 * Output dell'agent MRA: un unico oggetto JSON (analisi strutturata dalla trascrizione).
 */

export type MraTickerBlock = {
  /** Simbolo normalizzato (es. AAPL, SPY, ^GSPC se citato come indice) */
  ticker: string;
  /** Come il soggetto si posiziona su quel titolo/mercato (rialzista, ribassista, ecc.) */
  orientamento_del_soggetto: string;
  /**
   * Nel paradigma MRA: operatività concettualmente inversa alla previsione del soggetto
   * (es. se rialzista → schema di vendita allo scoperto; se ribassista → schema long).
   * Descrizione qualitativa, non ordine di trading.
   */
  operazioni_suggerite: string;
  /** Perché l’inverso rispetto alla previsione, in termini MRA */
  motivazione: string;
};

export type MraAgentReport = {
  /** Impostato dal server al completamento dell’agent */
  video_id?: string;
  generato_il?: string;
  contesto_generale: string;
  /** Opinion, giudizi, previsioni — non meri dati di fatto */
  previsioni_principali: string[];
  /** Ticker o indici citati in relazione a tali previsioni */
  titoli_coinvolti: string[];
  per_ticker: MraTickerBlock[];
};

const REQUIRED_TOP = [
  "contesto_generale",
  "previsioni_principali",
  "titoli_coinvolti",
  "per_ticker",
] as const;

/** Estrae il primo oggetto JSON dalla risposta (gestisce ```json ... ```). */
export function extractJsonObject(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```/i.exec(t);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Nessun oggetto JSON trovato nella risposta del modello.");
  }
  return t.slice(start, end + 1);
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTickerBlock(o: unknown, index: number): MraTickerBlock {
  if (!o || typeof o !== "object") {
    throw new Error(`per_ticker[${index}] deve essere un oggetto.`);
  }
  const r = o as Record<string, unknown>;
  const ticker = typeof r.ticker === "string" ? r.ticker.trim() : "";
  const operazioni =
    typeof r.operazioni_suggerite === "string" ? r.operazioni_suggerite.trim() : "";
  const motivazione =
    typeof r.motivazione === "string" ? r.motivazione.trim() : "";
  const orientamentoRaw =
    typeof r.orientamento_del_soggetto === "string"
      ? r.orientamento_del_soggetto.trim()
      : typeof (r as { orientamento_soggetto?: string }).orientamento_soggetto ===
          "string"
        ? (r as { orientamento_soggetto: string }).orientamento_soggetto.trim()
        : "";

  if (!ticker || !operazioni || !motivazione) {
    throw new Error(
      `per_ticker[${index}]: «ticker», «operazioni_suggerite» e «motivazione» sono obbligatori e non vuoti.`,
    );
  }
  return {
    ticker,
    orientamento_del_soggetto:
      orientamentoRaw || "Non esplicitato nella trascrizione.",
    operazioni_suggerite: operazioni,
    motivazione,
  };
}

export function parseMraAgentReport(raw: string): MraAgentReport {
  const jsonStr = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse fallito";
    throw new Error(`JSON non valido: ${msg}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Il JSON radice deve essere un oggetto.");
  }
  const root = parsed as Record<string, unknown>;

  for (const k of REQUIRED_TOP) {
    if (!(k in root)) {
      throw new Error(`Campo obbligatorio mancante: «${k}».`);
    }
  }

  const contesto =
    typeof root.contesto_generale === "string"
      ? root.contesto_generale.trim()
      : "";
  if (!contesto) {
    throw new Error("«contesto_generale» deve essere una stringa non vuota.");
  }

  const previsioni = asStrings(root.previsioni_principali);
  const titoli = asStrings(root.titoli_coinvolti);

  if (!Array.isArray(root.per_ticker)) {
    throw new Error("«per_ticker» deve essere un array.");
  }
  const per_ticker: MraTickerBlock[] = [];
  let i = 0;
  for (const item of root.per_ticker) {
    per_ticker.push(parseTickerBlock(item, i));
    i++;
  }

  return {
    contesto_generale: contesto,
    previsioni_principali: previsioni,
    titoli_coinvolti: titoli,
    per_ticker,
  };
}
