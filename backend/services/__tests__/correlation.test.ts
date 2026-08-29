import { describe, it, expect } from 'vitest';
import {
  correlateEvents,
  extractKeywords,
  type EventRow,
} from '../correlation';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<EventRow> & { id: number }): EventRow {
  return {
    source: 'prometheus',
    event_type: 'error',
    service: 'payment-api',
    severity: 'high',
    message: 'Something went wrong',
    metadata: {},
    timestamp: '2026-08-29T10:00:00Z',
    created_at: '2026-08-29T10:00:01Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('extracts meaningful words from a message', () => {
    const keywords = extractKeywords('database connection pool exhausted');
    expect(keywords).toContain('database');
    expect(keywords).toContain('connection');
    expect(keywords).toContain('pool');
    expect(keywords).toContain('exhausted');
  });

  it('filters out stop words', () => {
    const keywords = extractKeywords('the database has been restarted');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('has');
    expect(keywords).not.toContain('been');
    expect(keywords).toContain('database');
    expect(keywords).toContain('restarted');
  });

  it('deduplicates words', () => {
    const keywords = extractKeywords('error error error in the system');
    const errorCount = keywords.filter(k => k === 'error').length;
    expect(errorCount).toBe(1);
  });

  it('returns empty array for short messages', () => {
    const keywords = extractKeywords('ok');
    expect(keywords).toHaveLength(0);
  });
});

describe('correlateEvents', () => {
  describe('Test 1: Same service + close timestamps → same signal', () => {
    it('groups events from the same service within the time window', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'database_error',
          message: 'database connection pool exhausted',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'http_error',
          message: 'HTTP 500 responses increasing',
          timestamp: '2026-08-29T10:01:00Z',
        }),
        makeEvent({
          id: 3,
          event_type: 'latency',
          message: 'p95 latency increased',
          timestamp: '2026-08-29T10:02:00Z',
        }),
      ];

      const signals = correlateEvents(events);

      expect(signals).toHaveLength(1);
      expect(signals[0].eventIds).toEqual([1, 2, 3]);
      expect(signals[0].service).toBe('payment-api');
      expect(signals[0].eventCount).toBe(3);
    });
  });

  describe('Test 2: Different service → different signal', () => {
    it('separates events from different services into separate signals', () => {
      const events = [
        makeEvent({
          id: 1,
          service: 'payment-api',
          event_type: 'error',
          message: 'database connection failed',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          service: 'payment-api',
          event_type: 'latency',
          message: 'response times degraded',
          timestamp: '2026-08-29T10:01:00Z',
        }),
        makeEvent({
          id: 3,
          service: 'auth-service',
          event_type: 'error',
          message: 'authentication timeout occurred',
          timestamp: '2026-08-29T10:00:30Z',
        }),
        makeEvent({
          id: 4,
          service: 'auth-service',
          event_type: 'warning',
          message: 'slow token validation',
          timestamp: '2026-08-29T10:01:30Z',
        }),
      ];

      const signals = correlateEvents(events);

      expect(signals).toHaveLength(2);
      const services = signals.map(s => s.service).sort();
      expect(services).toEqual(['auth-service', 'payment-api']);
    });
  });

  describe('Test 3: Same service + very distant timestamps → different signal', () => {
    it('separates events outside the time window', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'connection failed',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'error',
          message: 'connection failed again',
          timestamp: '2026-08-29T11:00:00Z', // 1 hour later
        }),
      ];

      const signals = correlateEvents(events);

      // Each event is alone → below minEventsForSignal (2) → no signals
      expect(signals).toHaveLength(0);
    });
  });

  describe('Test 4: Related event messages → candidate for same signal', () => {
    it('groups events with compatible types even without keyword overlap', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'payment gateway unreachable',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'latency',
          message: 'response times spiking',
          timestamp: '2026-08-29T10:02:00Z',
        }),
      ];

      const signals = correlateEvents(events);

      // error and latency are compatible types
      expect(signals).toHaveLength(1);
      expect(signals[0].eventIds).toEqual([1, 2]);
    });
  });

  describe('Test 5: Unrelated events → separate signals', () => {
    it('separates events with incompatible types and no keyword overlap', () => {
      const events = [
        makeEvent({
          id: 1,
          service: 'payment-api',
          event_type: 'deployment',
          message: 'deployment started',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          service: 'payment-api',
          event_type: 'info',
          message: 'user signed up',
          timestamp: '2026-08-29T10:01:00Z',
        }),
      ];

      const signals = correlateEvents(events);

      // deployment and info are not compatible, no shared keywords
      // Each alone → below minEventsForSignal → no signals
      expect(signals).toHaveLength(0);
    });
  });

  describe('Test 6: Empty input', () => {
    it('returns empty array for no events', () => {
      const signals = correlateEvents([]);
      expect(signals).toHaveLength(0);
    });
  });

  describe('Test 7: Single event', () => {
    it('returns empty array for a single event with default config', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'something failed',
          timestamp: '2026-08-29T10:00:00Z',
        }),
      ];

      const signals = correlateEvents(events);
      expect(signals).toHaveLength(0);
    });

    it('returns one signal when minEventsForSignal is 1', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'something failed',
          timestamp: '2026-08-29T10:00:00Z',
        }),
      ];

      const signals = correlateEvents(events, { minEventsForSignal: 1 });
      expect(signals).toHaveLength(1);
      expect(signals[0].eventIds).toEqual([1]);
    });
  });

  describe('Edge cases', () => {
    it('handles events at exactly the time window boundary', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'first error',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'error',
          message: 'second error',
          timestamp: '2026-08-29T10:05:00Z', // Exactly 5 minutes
        }),
      ];

      const signals = correlateEvents(events);
      expect(signals).toHaveLength(1);
      expect(signals[0].eventIds).toEqual([1, 2]);
    });

    it('separates events just beyond the time window', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'error',
          message: 'first error',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'error',
          message: 'second error',
          timestamp: '2026-08-29T10:05:01Z', // 5 minutes 1 second
        }),
      ];

      const signals = correlateEvents(events);
      // Both are alone → below minEventsForSignal → no signals
      expect(signals).toHaveLength(0);
    });

    it('handles multiple services correctly', () => {
      const events = [
        makeEvent({
          id: 1,
          service: 'payment-api',
          event_type: 'error',
          message: 'database connection pool exhausted',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          service: 'payment-api',
          event_type: 'latency',
          message: 'response times increasing',
          timestamp: '2026-08-29T10:01:00Z',
        }),
        makeEvent({
          id: 3,
          service: 'auth-service',
          event_type: 'error',
          message: 'authentication timeout',
          timestamp: '2026-08-29T10:00:30Z',
        }),
        makeEvent({
          id: 4,
          service: 'auth-service',
          event_type: 'warning',
          message: 'slow token validation',
          timestamp: '2026-08-29T10:01:30Z',
        }),
      ];

      const signals = correlateEvents(events);

      expect(signals).toHaveLength(2);

      const paymentSignal = signals.find(s => s.service === 'payment-api');
      const authSignal = signals.find(s => s.service === 'auth-service');

      expect(paymentSignal?.eventIds).toEqual([1, 2]);
      expect(authSignal?.eventIds).toEqual([3, 4]);
    });

    it('generates correct signal metadata', () => {
      const events = [
        makeEvent({
          id: 1,
          event_type: 'database_error',
          severity: 'medium',
          message: 'database connection pool exhausted',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          event_type: 'http_error',
          severity: 'critical',
          message: 'HTTP 500 responses increasing',
          timestamp: '2026-08-29T10:02:00Z',
        }),
      ];

      const signals = correlateEvents(events);

      expect(signals).toHaveLength(1);
      expect(signals[0].maxSeverity).toBe('critical');
      expect(signals[0].startTime).toBe('2026-08-29T10:00:00.000Z');
      expect(signals[0].endTime).toBe('2026-08-29T10:02:00.000Z');
      expect(signals[0].title).toContain('payment-api');
      expect(signals[0].title).toContain('database_error');
      expect(signals[0].title).toContain('http_error');
    });
  });

  describe('Integration scenario: 5 events → 2 signals', () => {
    it('groups related events and separates unrelated ones', () => {
      const events = [
        // Group 1: payment-api database/latency incident
        makeEvent({
          id: 1,
          service: 'payment-api',
          event_type: 'database_error',
          severity: 'high',
          message: 'database connection pool exhausted',
          timestamp: '2026-08-29T10:00:00Z',
        }),
        makeEvent({
          id: 2,
          service: 'payment-api',
          event_type: 'http_error',
          severity: 'critical',
          message: 'HTTP 500 responses increasing',
          timestamp: '2026-08-29T10:01:00Z',
        }),
        makeEvent({
          id: 3,
          service: 'payment-api',
          event_type: 'latency',
          severity: 'high',
          message: 'p95 latency increased',
          timestamp: '2026-08-29T10:02:00Z',
        }),
        // Group 2: auth-service timeout
        makeEvent({
          id: 4,
          service: 'auth-service',
          event_type: 'error',
          severity: 'medium',
          message: 'authentication service timeout',
          timestamp: '2026-08-29T10:00:30Z',
        }),
        makeEvent({
          id: 5,
          service: 'auth-service',
          event_type: 'warning',
          severity: 'low',
          message: 'slow response from auth provider',
          timestamp: '2026-08-29T10:01:30Z',
        }),
      ];

      const signals = correlateEvents(events);

      expect(signals).toHaveLength(2);

      const paymentSignal = signals.find(s => s.service === 'payment-api');
      const authSignal = signals.find(s => s.service === 'auth-service');

      expect(paymentSignal).toBeDefined();
      expect(paymentSignal!.eventIds).toEqual([1, 2, 3]);
      expect(paymentSignal!.eventCount).toBe(3);
      expect(paymentSignal!.maxSeverity).toBe('critical');

      expect(authSignal).toBeDefined();
      expect(authSignal!.eventIds).toEqual([4, 5]);
      expect(authSignal!.eventCount).toBe(2);
    });
  });
});
