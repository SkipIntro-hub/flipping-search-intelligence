import pg from 'pg';

const { Pool } = pg;

export interface PostgisStatus {
  connected: boolean;
  postgisVersion: string | null;
  databaseUrlConfigured: boolean;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (pool) return pool;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 3500,
  });
  return pool;
}

export async function checkPostgisConnection(): Promise<PostgisStatus> {
  const p = getPool();
  if (!p) {
    return {
      connected: false,
      postgisVersion: null,
      databaseUrlConfigured: false,
    };
  }
  try {
    const res = await p.query('SELECT PostGIS_Version() AS v');
    return {
      connected: true,
      postgisVersion: res.rows?.[0]?.v ?? '3.4',
      databaseUrlConfigured: true,
    };
  } catch {
    return {
      connected: false,
      postgisVersion: null,
      databaseUrlConfigured: true,
    };
  }
}

export async function initAppStateTable(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS app_state_snapshots (
        id VARCHAR(64) PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {
    // Fallback to disk persistence if DB is still warming up
  }
}

export async function loadStateFromPostgis<T>(): Promise<T | null> {
  const p = getPool();
  if (!p) return null;
  try {
    await initAppStateTable();
    const res = await p.query(
      `SELECT payload FROM app_state_snapshots WHERE id = 'main_state' LIMIT 1`
    );
    if (res.rows.length > 0 && res.rows[0].payload) {
      return res.rows[0].payload as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveStateToPostgis(payload: unknown): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await initAppStateTable();
    await p.query(
      `INSERT INTO app_state_snapshots (id, payload, updated_at)
       VALUES ('main_state', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(payload)]
    );
    return true;
  } catch {
    return false;
  }
}
