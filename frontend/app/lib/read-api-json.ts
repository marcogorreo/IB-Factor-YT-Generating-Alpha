/**
 * Legge il body di una Response come JSON con messaggi utili se il gateway
 * restituisce HTML/testo (es. upstream assente → "Internal Server Error").
 */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `Risposta vuota dal server (HTTP ${res.status}). Avvia api-gateway (porta 4000) e i servizi collegati (insights 4001, youtube 4002), poi riprova.`,
    );
  }
  const first = trimmed[0];
  if (first !== "{" && first !== "[") {
    const hint =
      trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 120)}…`;
    throw new Error(
      `Risposta non JSON (HTTP ${res.status}). Di solito indica che il proxy non raggiunge il gateway o il servizio è spento. Dettaglio: ${hint}`,
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `JSON non valido dal server (HTTP ${res.status}). Controlla i log di api-gateway e del microservizio.`,
    );
  }
}
