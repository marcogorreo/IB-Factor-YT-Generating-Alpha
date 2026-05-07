import type { Pool } from "pg";
import { polishTranscriptText } from "./caption-parse.js";
import { anthropicChat } from "../llm/anthropic-chat.js";

const TRANSCRIPT_MAX_CHARS = 120_000;

const MRA_ANALYSIS_SYSTEM = `Sei un assistente per la Market Reverse-Analysis (MRA) del progetto IB Factor.
Contesto: si osserva un "Soggetto Cramer" (personaggio/commentatore di mercato, riferimento ironico) e si ragiona su possibili operatività speculative il cui payoff tende a essere inversamente correlato al verificarsi delle sue previsioni — solo come framework concettuale, senza istruzioni operative definite o promesse di risultati.

Leggi la trascrizione del video YouTube fornita dall'utente e restituisci in italiano:
1) Sintesi del sentiment e delle tesi principali espresse.
2) Elenco delle previsioni o giudizi espliciti che puoi ricavare dal testo (anche approssimativi).
3) Spunto per un'analisi MRA: come potrebbe essere impostato un ragionamento "reverse" rispetto a tali previsioni (solo livello ideativo, nessun consiglio di investimento né ticker).

Sii chiaro, strutturato con titoletti brevi. Non inventare contenuti non presenti nella trascrizione.`;

export async function runMraAnalysisFromDb(
  pool: Pool,
  videoId: string,
): Promise<{
  analysis: string;
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
    system: MRA_ANALYSIS_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          "Trascrizione del video (testo integrale inviato, eventualmente troncato se lunghissimo):\n\n" +
          text,
      },
    ],
    max_tokens: 8192,
  });

  return {
    analysis: result.text,
    model: result.model,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    transcript_truncated: truncated,
  };
}
