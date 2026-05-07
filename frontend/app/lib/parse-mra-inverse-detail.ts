/**
 * Parsa il blocco testo salvato per ogni ticker (formato da `formatOperazioniInverseForArchive`).
 */
export type ParsedInverseBlocks = {
  orientamento: string;
  operazioni: string;
  motivazione: string;
};

export function parseMraInverseDetail(detail: string): ParsedInverseBlocks {
  const d = detail?.trim() ?? "";
  if (!d) {
    return { orientamento: "", operazioni: "", motivazione: "" };
  }

  const opNeedle = /Operazioni\s+suggerite\s*\(\s*inverso\s+MRA\s*\)\s*:\s*/i;
  const opIdx = d.search(opNeedle);
  if (opIdx === -1) {
    return { orientamento: d, operazioni: "", motivazione: "" };
  }

  const head = d.slice(0, opIdx);
  const orientamento = head
    .replace(/^\s*Orientamento\s+del\s+soggetto\s*:\s*/i, "")
    .trim();

  let rest = d.slice(opIdx).replace(opNeedle, "");
  const motIdx = rest.search(/Motivazione\s*:\s*/i);
  if (motIdx === -1) {
    return {
      orientamento,
      operazioni: rest.trim(),
      motivazione: "",
    };
  }

  const operazioni = rest.slice(0, motIdx).trim();
  const motivazione = rest
    .slice(motIdx)
    .replace(/^\s*Motivazione\s*:\s*/i, "")
    .trim();

  return { orientamento, operazioni, motivazione };
}
