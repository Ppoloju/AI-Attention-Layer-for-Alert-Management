import { Pool } from 'pg';

// ─── Connection config ───────────────────────────────────────────────────────
//
// Supports two modes:
//   1. DATABASE_URL  — used for Supabase, production, or any hosted PostgreSQL
//   2. Individual vars (DB_HOST, DB_PORT, ...) — used for local Docker
//
// DATABASE_URL takes precedence when set.

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse URL to decide on SSL
    // Local Docker (localhost/127.0.0.1) → no SSL
    // Cloud (Supabase, etc.) → SSL required
    const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);

    return new Pool({
      connectionString: databaseUrl,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
    });
  }

  // Local Docker — use individual env vars
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'signalflow',
    user: process.env.DB_USER || 'signalflow',
    password: process.env.DB_PASSWORD || 'signalflow_password',
  });
}

const pool = createPool();

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        service VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Signals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id VARCHAR(100) PRIMARY KEY,
        service VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        max_severity VARCHAR(20) NOT NULL,
        risk_score INTEGER NOT NULL DEFAULT 0,
        priority VARCHAR(2) NOT NULL DEFAULT 'P3',
        representative_message TEXT NOT NULL,
        event_count INTEGER NOT NULL DEFAULT 0,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Triage columns (added in migration 004)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_hypothesis TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_confidence VARCHAR(10);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_evidence JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_next_steps JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Signal-events junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS signal_events (
        signal_id VARCHAR(100) NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        PRIMARY KEY (signal_id, event_id)
      );
    `);

    // Indexes (IF NOT EXISTS is safe for idempotency)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);
      CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
      CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_signals_service ON signals(service);
      CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
      CREATE INDEX IF NOT EXISTS idx_signals_max_severity ON signals(max_severity);
      CREATE INDEX IF NOT EXISTS idx_signals_priority ON signals(priority);
      CREATE INDEX IF NOT EXISTS idx_signals_risk_score ON signals(risk_score DESC);
      CREATE INDEX IF NOT EXISTS idx_signal_events_event_id ON signal_events(event_id);
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function insertEvent(event: any) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO events (source, event_type, service, severity, message, metadata, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        event.source,
        event.event_type,
        event.service,
        event.severity,
        event.message,
        JSON.stringify(event.metadata || {}),
        event.timestamp,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getEvents(limit = 50) {
  const validatedLimit = Math.min(Math.max(1, limit), 1000);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM events ORDER BY occurred_at DESC LIMIT $1`,
      [validatedLimit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get recent events for a specific service within a time window.
 * Used by the correlation worker.
 */
export async function getRecentEventsForService(
  service: string,
  windowMinutes: number
) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM events
       WHERE service = $1
         AND occurred_at >= NOW() - INTERVAL '1 minute' * $2
       ORDER BY occurred_at ASC`,
      [service, windowMinutes]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export async function insertSignal(signal: {
  id: string;
  service: string;
  title: string;
  maxSeverity: string;
  riskScore: number;
  priority: string;
  representativeMessage: string;
  eventCount: number;
  startTime: string;
  endTime: string;
}) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO signals (id, service, title, max_severity, risk_score, priority, representative_message, event_count, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        signal.id,
        signal.service,
        signal.title,
        signal.maxSeverity,
        signal.riskScore,
        signal.priority,
        signal.representativeMessage,
        signal.eventCount,
        signal.startTime,
        signal.endTime,
      ]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function linkSignalEvents(
  signalId: string,
  eventIds: number[]
) {
  const client = await pool.connect();
  try {
    for (const eventId of eventIds) {
      await client.query(
        `INSERT INTO signal_events (signal_id, event_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [signalId, eventId]
      );
    }
  } finally {
    client.release();
  }
}

export async function updateSignalTriage(
  signalId: string,
  triage: {
    hypothesis: string;
    confidence: string;
    evidence: string[];
    nextSteps: string[];
  }
) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE signals
       SET ai_hypothesis = $1,
           ai_confidence = $2,
           ai_evidence = $3,
           ai_next_steps = $4
       WHERE id = $5`,
      [
        triage.hypothesis,
        triage.confidence,
        JSON.stringify(triage.evidence),
        JSON.stringify(triage.nextSteps),
        signalId,
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get recently created signals, most recent first.
 */
export async function getSignals(limit = 50) {
  const validatedLimit = Math.min(Math.max(1, limit), 1000);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM signals ORDER BY risk_score DESC, created_at DESC LIMIT $1`,
      [validatedLimit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get a single signal by ID, including its correlated events.
 */
export async function getSignalById(signalId: string) {
  const client = await pool.connect();
  try {
    const signalResult = await client.query(
      `SELECT * FROM signals WHERE id = $1`,
      [signalId]
    );

    if (signalResult.rows.length === 0) return null;

    const eventsResult = await client.query(
      `SELECT e.* FROM events e
       JOIN signal_events se ON e.id = se.event_id
       WHERE se.signal_id = $1
       ORDER BY e.occurred_at ASC`,
      [signalId]
    );

    return {
      ...signalResult.rows[0],
      events: eventsResult.rows,
    };
  } finally {
    client.release();
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export default pool;
