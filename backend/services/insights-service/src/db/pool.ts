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
