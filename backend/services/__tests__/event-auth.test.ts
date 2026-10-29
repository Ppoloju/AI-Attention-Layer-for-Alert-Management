import { describe, expect, it } from 'vitest';
import { isValidEventIngestionKey } from '../../../frontend/lib/event-auth';

describe('isValidEventIngestionKey', () => {
  it('accepts a matching Bearer token', () => {
    expect(isValidEventIngestionKey('Bearer local-test-token', 'local-test-token')).toBe(true);
  });

  it('rejects missing, malformed, and incorrect tokens', () => {
    expect(isValidEventIngestionKey(null, 'local-test-token')).toBe(false);
    expect(isValidEventIngestionKey('local-test-token', 'local-test-token')).toBe(false);
    expect(isValidEventIngestionKey('Bearer wrong-token', 'local-test-token')).toBe(false);
    expect(isValidEventIngestionKey('Bearer local-test-token', '')).toBe(false);
  });
});
