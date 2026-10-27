-- Initial schema for SignalFlow events, signals, and their relationships.
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  service VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  ai_hypothesis TEXT,
  ai_confidence VARCHAR(10),
  ai_evidence JSONB DEFAULT '[]',
  ai_next_steps JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS signal_events (
  signal_id VARCHAR(100) NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (signal_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_service ON signals(service);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
CREATE INDEX IF NOT EXISTS idx_signals_max_severity ON signals(max_severity);
CREATE INDEX IF NOT EXISTS idx_signals_priority ON signals(priority);
CREATE INDEX IF NOT EXISTS idx_signals_risk_score ON signals(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_signal_events_event_id ON signal_events(event_id);
