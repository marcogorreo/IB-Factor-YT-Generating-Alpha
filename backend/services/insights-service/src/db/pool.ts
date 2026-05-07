import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL non impostato nel file .env.local");
  }
  pool = new pg.Pool({ connectionString, max: 5 });
  return pool;
}

export async function ensureMraTranscriptSchema(
  client: pg.Pool | pg.PoolClient,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mra_transcripts (
      video_id TEXT PRIMARY KEY,
      transcript TEXT NOT NULL,
      source TEXT NOT NULL,
      language TEXT,
      char_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mra_transcripts_updated
      ON mra_transcripts (updated_at DESC);
  `);
}

export type MraAnalysisArchiveRow = {
  id: number;
  video_id: string;
  video_title: string;
  transcript: string;
  contesto_generale: string;
  previsioni_opinioni: string;
  titoli_coinvolti: string;
  operazioni_inverse: string;
  created_at: string;
};

export async function ensureMraAnalysisArchiveSchema(
  client: pg.Pool | pg.PoolClient,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mra_analysis_archive (
      id BIGSERIAL PRIMARY KEY,
      video_id TEXT NOT NULL,
      video_title TEXT NOT NULL,
      transcript TEXT NOT NULL,
      contesto_generale TEXT NOT NULL,
      previsioni_opinioni TEXT NOT NULL,
      titoli_coinvolti TEXT NOT NULL,
      operazioni_inverse TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mra_analysis_archive_created
      ON mra_analysis_archive (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mra_analysis_archive_video
      ON mra_analysis_archive (video_id);
  `);
}

export async function insertMraAnalysisArchive(
  poolParam: pg.Pool,
  row: Omit<MraAnalysisArchiveRow, "id" | "created_at">,
): Promise<number> {
  const { rows } = await poolParam.query<{ id: string }>(
    `INSERT INTO mra_analysis_archive (
       video_id, video_title, transcript, contesto_generale,
       previsioni_opinioni, titoli_coinvolti, operazioni_inverse
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      row.video_id,
      row.video_title,
      row.transcript,
      row.contesto_generale,
      row.previsioni_opinioni,
      row.titoli_coinvolti,
      row.operazioni_inverse,
    ],
  );
  return Number(rows[0]?.id ?? 0);
}

export type MraArchiveSummary = {
  id: number;
  video_id: string;
  video_title: string;
  created_at: string;
  contesto_preview: string;
  titoli_preview: string;
  previsioni_preview: string;
};

/** Elenco leggero per la dashboard (nessun campo lungo completo). */
export async function listMraAnalysisArchiveSummaries(
  poolParam: pg.Pool,
  limit = 200,
): Promise<MraArchiveSummary[]> {
  const capped = Math.min(Math.max(1, limit), 500);
  const { rows } = await poolParam.query<{
    id: string | number;
    video_id: string;
    video_title: string;
    created_at: string;
    contesto_preview: string | null;
    titoli_preview: string | null;
    previsioni_preview: string | null;
  }>(
    `SELECT id,
            video_id,
            video_title,
            created_at::text AS created_at,
            LEFT(TRIM(contesto_generale), 240) AS contesto_preview,
            LEFT(TRIM(titoli_coinvolti), 160) AS titoli_preview,
            LEFT(TRIM(previsioni_opinioni), 200) AS previsioni_preview
     FROM mra_analysis_archive
     ORDER BY created_at DESC
     LIMIT $1`,
    [capped],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    video_id: r.video_id,
    video_title: r.video_title,
    created_at: r.created_at,
    contesto_preview: r.contesto_preview ?? "",
    titoli_preview: r.titoli_preview ?? "",
    previsioni_preview: r.previsioni_preview ?? "",
  }));
}

export async function getMraAnalysisArchiveById(
  poolParam: pg.Pool,
  id: number,
): Promise<MraAnalysisArchiveRow | null> {
  if (!Number.isFinite(id) || id < 1) return null;
  const { rows } = await poolParam.query<{
    id: string | number;
    video_id: string;
    video_title: string;
    transcript: string;
    contesto_generale: string;
    previsioni_opinioni: string;
    titoli_coinvolti: string;
    operazioni_inverse: string;
    created_at: string;
  }>(
    `SELECT id,
            video_id,
            video_title,
            transcript,
            contesto_generale,
            previsioni_opinioni,
            titoli_coinvolti,
            operazioni_inverse,
            created_at::text
     FROM mra_analysis_archive
     WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    video_id: r.video_id,
    video_title: r.video_title,
    transcript: r.transcript,
    contesto_generale: r.contesto_generale,
    previsioni_opinioni: r.previsioni_opinioni,
    titoli_coinvolti: r.titoli_coinvolti,
    operazioni_inverse: r.operazioni_inverse,
    created_at: r.created_at,
  };
}

/** Elimina una riga archivio. Ritorna true se esisteva ed è stata rimossa. */
export async function deleteMraAnalysisArchiveById(
  poolParam: pg.Pool,
  id: number,
): Promise<boolean> {
  if (!Number.isFinite(id) || id < 1) return false;
  const result = await poolParam.query(
    `DELETE FROM mra_analysis_archive WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function upsertTranscript(
  poolParam: pg.Pool,
  row: {
    video_id: string;
    transcript: string;
    source: string;
    language: string | null;
  },
): Promise<void> {
  const charCount = [...row.transcript].length;
  await poolParam.query(
    `INSERT INTO mra_transcripts (video_id, transcript, source, language, char_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (video_id) DO UPDATE SET
       transcript = EXCLUDED.transcript,
       source = EXCLUDED.source,
       language = EXCLUDED.language,
       char_count = EXCLUDED.char_count,
       updated_at = NOW()`,
    [row.video_id, row.transcript, row.source, row.language, charCount],
  );
}
