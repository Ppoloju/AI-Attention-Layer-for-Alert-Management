// ─── Triage Service ──────────────────────────────────────────────────────────
//
// Orchestrates AI triage for a signal.
// The deterministic risk score remains the source of priority.
// Groq provides supplementary hypothesis, evidence, and next steps.

import { groqTriage, type TriageInput, type TriageResult } from '../lib/ai';

export interface TriageEvent {
  event_type: string;
  severity: string;
  message: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface SignalForTriage {
  id: string;
  service: string;
  title: string;
  maxSeverity: string;
  riskScore: number;
  priority: string;
  eventCount: number;
  startTime: string;
  endTime: string;
  events: TriageEvent[];
}

/**
 * Run AI triage on a signal.
 *
 * Returns the triage result if Groq is available and succeeds,
 * or null if triage is unavailable (API key missing, error, etc.).
 *
 * The caller decides what to do with null — typically skip gracefully.
 */
export async function triageSignal(signal: SignalForTriage): Promise<TriageResult | null> {
  const input: TriageInput = {
    signalId: signal.id,
    service: signal.service,
    title: signal.title,
    maxSeverity: signal.maxSeverity,
    riskScore: signal.riskScore,
    priority: signal.priority,
    eventCount: signal.eventCount,
    startTime: signal.startTime,
    endTime: signal.endTime,
    events: signal.events,
  };

  return groqTriage(input);
}
