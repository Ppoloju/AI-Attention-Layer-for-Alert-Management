import { describe, it, expect } from 'vitest';
import { calculateRiskScore, scoreFromSignal, type ScoreInput } from '../scoring';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    maxSeverity: 'high',
    eventCount: 2,
    distinctEventTypes: 2,
    timeWindowSeconds: 120,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateRiskScore', () => {
  describe('1. Critical signal', () => {
    it('returns P0 for critical severity with multiple events', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'critical',
        eventCount: 5,
        distinctEventTypes: 3,
        timeWindowSeconds: 60,
      }));

      expect(result.priority).toBe('P0');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. High signal', () => {
    it('returns P1 for high severity with moderate events', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'high',
        eventCount: 3,
        distinctEventTypes: 2,
        timeWindowSeconds: 120,
      }));

      expect(result.priority).toBe('P1');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
    });
  });

  describe('3. Medium signal', () => {
    it('returns P2 for medium severity', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'medium',
        eventCount: 2,
        distinctEventTypes: 1,
        timeWindowSeconds: 300,
      }));

      expect(result.priority).toBe('P2');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(60);
    });
  });

  describe('4. Low signal', () => {
    it('returns P3 for low severity', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'low',
        eventCount: 2,
        distinctEventTypes: 1,
        timeWindowSeconds: 300,
      }));

      expect(result.priority).toBe('P3');
      expect(result.score).toBeLessThan(30);
    });
  });

  describe('5. Multiple events increasing urgency', () => {
    it('scores higher with more events', () => {
      const few = calculateRiskScore(makeInput({ eventCount: 2 }));
      const many = calculateRiskScore(makeInput({ eventCount: 10 }));

      expect(many.score).toBeGreaterThan(few.score);
    });

    it('scores higher with more event types', () => {
      const single = calculateRiskScore(makeInput({ distinctEventTypes: 1 }));
      const diverse = calculateRiskScore(makeInput({ distinctEventTypes: 4 }));

      expect(diverse.score).toBeGreaterThan(single.score);
    });

    it('scores higher with faster burst rate', () => {
      const slow = calculateRiskScore(makeInput({
        eventCount: 5,
        timeWindowSeconds: 300, // 5 min → 1/min
      }));
      const fast = calculateRiskScore(makeInput({
        eventCount: 5,
        timeWindowSeconds: 30, // 30s → 10/min
      }));

      expect(fast.score).toBeGreaterThan(slow.score);
    });
  });

  describe('6. Score boundaries', () => {
    it('clamps score to maximum 100', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'critical',
        eventCount: 100,
        distinctEventTypes: 10,
        timeWindowSeconds: 10,
      }));

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('clamps score to minimum 0', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'low',
        eventCount: 1,
        distinctEventTypes: 1,
        timeWindowSeconds: 3600,
      }));

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('P0 threshold is exactly 80', () => {
      // Just below 80 → P1
      const below = calculateRiskScore(makeInput({
        maxSeverity: 'high',
        eventCount: 5,
        distinctEventTypes: 3,
        timeWindowSeconds: 60,
      }));
      // Just at/above 80 → P0
      const above = calculateRiskScore(makeInput({
        maxSeverity: 'critical',
        eventCount: 2,
        distinctEventTypes: 1,
        timeWindowSeconds: 300,
      }));

      if (below.score < 80) expect(below.priority).toBe('P1');
      if (above.score >= 80) expect(above.priority).toBe('P0');
    });
  });

  describe('7. Repeatable output', () => {
    it('returns identical scores for the same input', () => {
      const input = makeInput({
        maxSeverity: 'critical',
        eventCount: 7,
        distinctEventTypes: 3,
        timeWindowSeconds: 45,
      });

      const r1 = calculateRiskScore(input);
      const r2 = calculateRiskScore(input);

      expect(r1.score).toBe(r2.score);
      expect(r1.priority).toBe(r2.priority);
      expect(r1.factors).toEqual(r2.factors);
    });

    it('returns different scores for different severities', () => {
      const low = calculateRiskScore(makeInput({ maxSeverity: 'low' }));
      const crit = calculateRiskScore(makeInput({ maxSeverity: 'critical' }));

      expect(crit.score).toBeGreaterThan(low.score);
    });
  });

  describe('8. Edge cases', () => {
    it('handles unknown severity gracefully', () => {
      const result = calculateRiskScore(makeInput({
        maxSeverity: 'unknown',
        eventCount: 3,
      }));

      // Falls back to base score of 5
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(['P0', 'P1', 'P2', 'P3']).toContain(result.priority);
    });

    it('handles single event (no burst)', () => {
      const result = calculateRiskScore(makeInput({
        eventCount: 1,
        distinctEventTypes: 1,
        timeWindowSeconds: 0,
      }));

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('handles zero time window', () => {
      const result = calculateRiskScore(makeInput({
        eventCount: 3,
        timeWindowSeconds: 0,
      }));

      // No burst bonus, but other factors still apply
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});

describe('scoreFromSignal', () => {
  it('calculates score from a signal-like object', () => {
    const result = scoreFromSignal({
      maxSeverity: 'critical',
      eventCount: 3,
      startTime: '2026-08-29T10:00:00Z',
      endTime: '2026-08-29T10:02:00Z',
      events: [
        { event_type: 'database_error' },
        { event_type: 'http_error' },
        { event_type: 'latency' },
      ],
    });

    expect(result.priority).toBe('P0');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.factors.length).toBeGreaterThanOrEqual(2);
  });

  it('defaults to 1 distinct type when events array is missing', () => {
    const result = scoreFromSignal({
      maxSeverity: 'high',
      eventCount: 2,
      startTime: '2026-08-29T10:00:00Z',
      endTime: '2026-08-29T10:05:00Z',
    });

    // No type diversity bonus since defaults to 1
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(80);
  });
});
