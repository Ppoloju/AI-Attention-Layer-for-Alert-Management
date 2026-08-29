-- Signals table: one row per correlated group of events
CREATE TABLE IF NOT EXISTS signals (
  id VARCHAR(100) PRIMARY KEY,
  service VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  max_severity VARCHAR(20) NOT NULL,
  representative_message TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: maps signals to their constituent events
CREATE TABLE IF NOT EXISTS signal_events (
  signal_id VARCHAR(100) NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (signal_id, event_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_signals_service ON signals(service);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
CREATE INDEX IF NOT EXISTS idx_signals_max_severity ON signals(max_severity);
CREATE INDEX IF NOT EXISTS idx_signal_events_event_id ON signal_events(event_id);
