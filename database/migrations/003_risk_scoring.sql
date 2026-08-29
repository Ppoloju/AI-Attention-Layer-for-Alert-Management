-- Add deterministic risk scoring columns to signals
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(2) NOT NULL DEFAULT 'P3';

-- Index for sorting by priority in the dashboard
CREATE INDEX IF NOT EXISTS idx_signals_priority ON signals(priority);
CREATE INDEX IF NOT EXISTS idx_signals_risk_score ON signals(risk_score DESC);
