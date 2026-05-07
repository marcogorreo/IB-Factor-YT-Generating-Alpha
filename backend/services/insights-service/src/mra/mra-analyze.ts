import type { Pool } from "pg";
import { anthropicChat } from "../llm/anthropic-chat.js";
import {
  parseMraAgentReport,
  type MraAgentReport,
} from "./mra-agent-schema.js";
import { polishTranscriptText } from "./caption-parse.js";

const TRANSCRIPT_MAX_CHARS = 120_000;

const MRA_AGENT_SYSTEM = `Sei l'agente MRA (Market Reverse-Analysis) di IB Factor.

Compito: leggere la trascrizione di un video e produrre UN SOLO oggetto JSON valido (UTF-8), senza testo prima o dopo, senza block markdown, senza commenti.

Struttura OBBLIGATORIA del JSON (tutte le chiavi devono esistere; usa array vuoti [] se non applicabile):
{
  "contesto_generale": "<string>",
  "previsioni_principali": ["<string>", ...],
  "titoli_coinvolti": ["<string>", ...],
  "per_ticker": [
    {
      "ticker": "<string>",
      "orientamento_del_soggetto": "<string>",
      "operazioni_suggerite": "<string>",
      "motivazione": "<string>"
    }
  ]
}

Regole di contenuto (tutte le stringhe in italiano):
- contesto_generale: sintesi di cosa tratta il video e tono/posizione comunicativa del soggetto (commentatore).
- previsioni_principali: elenco di opinioni, giudizi o previsioni sul futuro o sui mercati — escludi i soli fatti storici non contestati (dati passivi) salvo quando servono a inquadrare una previsione.
- titoli_coinvolti: simboli di titoli o indici menzionati in connessione con quelle previsioni (forma breve: es. AAPL, MSFT, SPY; per indici anche forma citata tipo S&P 500 se non c'è ticker).
- Per ogni voce in per_ticker:
  - ticker: stesso simbolo usato in titoli_coinvolti (allineato).
  - orientamento_del_soggetto: in cosa consiste la visione del soggetto su quel titolo/mercato (rialzista, ribassista, favorevole, critico, ecc.) desunta dalla trascrizione; se non è chiaro, indicalo esplicitamente.
  - operazioni_suggerite: nel paradigma MRA descrivere qualitativamente l'operatività INVERSA rispetto alla previsione del soggetto (es. visione rialzista del soggetto sul titolo → schema ribassistico o vendita allo scoperto; visione ribassista → schema rialzistico o acquisto). Nessun prezzo, size, leva o ordine eseguibile: solo descrizione concettuale.
  - motivazione: perché l'inverso rispetto al soggetto segue la logica MRA, in base a ciò che dice nel testo.

Vincoli:
- Non inventare ticker non presenti o plausibilmente inferibili dalla trascrizione.
- Se non compaiono titoli, titoli_coinvolti e per_ticker sono [].
- Gli elementi in per_ticker devono coprire (idealmente) tutti i titoli_coinvolti; se per un ticker non c'è abbastanza materiale, ometti quella voce o spiega in orientamento che il testo è insufficiente.

Avvertenza: output solo educativo nel framework MRA, non consulenza finanziaria, non sollecitazione al pubblico risparmio.`;

export async function runMraAnalysisFromDb(
  pool: Pool,
  videoId: string,
): Promise<{
  mra_report: MraAgentReport;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  transcript_truncated: boolean;
}> {
  const { rows } = await pool.query<{ transcript: string }>(
    `SELECT transcript FROM mra_transcripts WHERE video_id = $1`,
    [videoId],
  );
  if (rows.length === 0) {
    const err = new Error(
      "Nessuna trascrizione salvata per questo video. Esegui prima il passo trascrizione.",
    );
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  let text = polishTranscriptText(rows[0].transcript);
  let truncated = false;
  if (text.length > TRANSCRIPT_MAX_CHARS) {
    text = text.slice(0, TRANSCRIPT_MAX_CHARS);
    truncated = true;
  }

  const result = await anthropicChat({
    system: MRA_AGENT_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          "Trascrizione del video (testo inviato, eventualmente troncato se lunghissimo):\n\n" +
          text,
      },
    ],
    max_tokens: 8192,
  });

  let mra_report: MraAgentReport;
  try {
    const parsed = parseMraAgentReport(result.text);
    mra_report = {
      ...parsed,
      video_id: videoId,
      generato_il: new Date().toISOString(),
    };
  } catch (e) {
    const hint =
      e instanceof Error ? e.message : "Parsing della risposta non riuscito.";
    const err = new Error(
      "Il modello non ha restituito un JSON MRA valido. Riprova tra poco. Dettaglio: " +
        hint,
    );
    (err as Error & { statusCode?: number }).statusCode = 502;
    throw err;
  }

  return {
    mra_report,
    model: result.model,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    transcript_truncated: truncated,
  };
}
