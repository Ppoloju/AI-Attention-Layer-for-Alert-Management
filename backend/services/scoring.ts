// ─── Deterministic Risk Scoring ──────────────────────────────────────────────
//
// Pure function: SignalGroup → RiskScore
// No AI, no network calls, no randomness.
// Every score is explainable by its contributing factors.

export interface RiskScore {
  /** 0–100 integer score */
  score: number;
  /** P0 | P1 | P2 | P3 */
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Human-readable breakdown for the UI */
  factors: string[];
}

// ─── Severity base scores ────────────────────────────────────────────────────
//
// Each severity level anchors a score range.  The remaining factors
// push the score up within that range.

const SEVERITY_BASE: Record<string, number> = {
  critical: 75,
  high: 50,
  medium: 25,
  low: 5,
};

// ─── Scoring function ────────────────────────────────────────────────────────

export interface ScoreInput {
  maxSeverity: string;
  eventCount: number;
  /** Number of distinct event types in the signal */
  distinctEventTypes: number;
  /** Time window in seconds from first to last event */
  timeWindowSeconds: number;
}

/**
 * Calculate a deterministic risk score for a signal.
 *
 * Factors:
 *   1. Severity base   — anchors the score range
 *   2. Event count     — more events = more urgency (max +15)
 *   3. Type diversity  — multiple event types = broader blast radius (max +10)
 *   4. Burst factor    — many events in a short window = active incident (max +5)
 *
 * Score is clamped to [0, 100].
 * Priority is derived from the final score.
 */
export function calculateRiskScore(input: ScoreInput): RiskScore {
  const factors: string[] = [];

  // 1. Base score from severity
  const base = SEVERITY_BASE[input.maxSeverity] ?? 5;
  factors.push(`Severity ${input.maxSeverity}: +${base}`);

  let score = base;

  // 2. Event count bonus (diminishing returns, max +15)
  //    2 events → +5, 3 → +8, 5 → +11, 10+ → +15
  const countBonus = Math.min(15, Math.round(5 * Math.log2(Math.max(1, input.eventCount))));
  if (countBonus > 0) {
    score += countBonus;
    factors.push(`Event count (${input.eventCount}): +${countBonus}`);
  }

  // 3. Type diversity bonus (max +10)
  //    1 type → +0, 2 → +4, 3+ → +7, 4+ → +10
  const typeBonus = Math.min(10, (input.distinctEventTypes - 1) * 3.5);
  if (typeBonus > 0) {
    score += Math.round(typeBonus);
    factors.push(`Type diversity (${input.distinctEventTypes} types): +${Math.round(typeBonus)}`);
  }

  // 4. Burst factor — events per minute
  //    If events are packed tightly, the incident is likely active
  if (input.timeWindowSeconds > 0 && input.eventCount >= 2) {
    const eventsPerMinute = (input.eventCount / input.timeWindowSeconds) * 60;
    // 2 events/min → +1, 5+ → +3, 10+ → +5
    const burstBonus = Math.min(5, Math.round(eventsPerMinute * 0.6));
    if (burstBonus > 0) {
      score += burstBonus;
      factors.push(`Burst rate (${eventsPerMinute.toFixed(1)}/min): +${burstBonus}`);
    }
  }

  // Clamp
  score = Math.min(100, Math.max(0, score));

  const priority = scoreToPriority(score);

  return { score, priority, factors };
}

// ─── Priority mapping ────────────────────────────────────────────────────────

function scoreToPriority(score: number): RiskScore['priority'] {
  if (score >= 80) return 'P0';
  if (score >= 60) return 'P1';
  if (score >= 30) return 'P2';
  return 'P3';
}

// ─── Convenience: build ScoreInput from a SignalGroup ────────────────────────

export interface SignalLike {
  maxSeverity: string;
  eventCount: number;
  startTime: string;
  endTime: string;
  events?: Array<{ event_type: string }>;
}

export function scoreFromSignal(signal: SignalLike): RiskScore {
  const distinctTypes = signal.events
    ? new Set(signal.events.map(e => e.event_type)).size
    : 1;

  const startTime = new Date(signal.startTime).getTime();
  const endTime = new Date(signal.endTime).getTime();
  const timeWindowSeconds = Math.max(1, (endTime - startTime) / 1000);

  return calculateRiskScore({
    maxSeverity: signal.maxSeverity,
    eventCount: signal.eventCount,
    distinctEventTypes: distinctTypes,
    timeWindowSeconds,
  });
}
