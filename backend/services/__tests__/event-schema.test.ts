import { describe, expect, it } from 'vitest';
import { EventSchema } from '../../../shared/schemas/event';

const validEvent = {
  source: 'custom',
  event_type: 'alert',
  service: 'api',
  severity: 'high',
  timestamp: '2026-10-29T12:00:00.000Z',
  message: 'A test alert',
  metadata: {},
};

describe('EventSchema', () => {
  it('accepts valid events and trims identifying strings', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      event_type: ' alert ',
      service: ' api ',
      message: ' alert message ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe('alert');
      expect(result.data.service).toBe('api');
      expect(result.data.message).toBe('alert message');
    }
  });

  it('rejects empty or database-incompatible identifying fields', () => {
    expect(EventSchema.safeParse({ ...validEvent, event_type: ' ' }).success).toBe(false);
    expect(EventSchema.safeParse({ ...validEvent, event_type: 'x'.repeat(101) }).success).toBe(false);
    expect(EventSchema.safeParse({ ...validEvent, service: 'x'.repeat(101) }).success).toBe(false);
    expect(EventSchema.safeParse({ ...validEvent, message: '' }).success).toBe(false);
  });

  it('bounds metadata size and key count', () => {
    expect(
      EventSchema.safeParse({
        ...validEvent,
        metadata: { payload: 'x'.repeat(32 * 1024) },
      }).success
    ).toBe(false);

    expect(
      EventSchema.safeParse({
        ...validEvent,
        metadata: Object.fromEntries(
          Array.from({ length: 51 }, (_, index) => [`key-${index}`, index])
        ),
      }).success
    ).toBe(false);
  });

  it('rejects metadata that cannot be represented as JSON', () => {
    expect(EventSchema.safeParse({ ...validEvent, metadata: { value: 1n } }).success).toBe(false);
  });
});
