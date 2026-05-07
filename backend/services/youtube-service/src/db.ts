import pg from "pg";

export type YoutubeVideoRow = {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  channel_id: string;
  channel_title: string | null;
  video_url: string;
  updated_at: string;
};

export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL non impostato nel file .env.local");
  }
  return new pg.Pool({ connectionString, max: 10 });
}

export async function ensureSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_videos (
      video_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      published_at TIMESTAMPTZ NOT NULL,
      channel_id TEXT NOT NULL,
      channel_title TEXT,
      video_url TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel
      ON youtube_videos (channel_id);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published
      ON youtube_videos (published_at DESC);
  `);
}

export async function listVideos(
  pool: pg.Pool,
  channelId: string,
): Promise<YoutubeVideoRow[]> {
  const { rows } = await pool.query<YoutubeVideoRow>(
    `SELECT video_id, title, thumbnail_url, published_at::text, channel_id, channel_title, video_url, updated_at::text
     FROM youtube_videos
     WHERE channel_id = $1
     ORDER BY published_at DESC`,
    [channelId],
  );
  return rows;
}

export async function replaceChannelVideos(
  pool: pg.Pool,
  channelId: string,
  videos: Omit<YoutubeVideoRow, "updated_at">[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM youtube_videos WHERE channel_id = $1", [
      channelId,
    ]);
    for (const v of videos) {
      await client.query(
        `INSERT INTO youtube_videos
          (video_id, title, thumbnail_url, published_at, channel_id, channel_title, video_url, updated_at)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, NOW())`,
        [
          v.video_id,
          v.title,
          v.thumbnail_url,
          v.published_at,
          v.channel_id,
          v.channel_title,
          v.video_url,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
