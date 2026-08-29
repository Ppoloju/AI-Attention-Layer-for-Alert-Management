-- Add AI triage columns to signals
-- These are nullable: triage is optional and may be unavailable (no Groq key, API error)
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS ai_hypothesis TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence VARCHAR(10),
  ADD COLUMN IF NOT EXISTS ai_evidence JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_next_steps JSONB DEFAULT '[]';
