import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured } from '../../../shared/lib/providers';

describe('Supabase environment detection', () => {
  it('uses server-side Supabase vars when public vars are not set', () => {
    const previousEnv = { ...process.env };

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_PUBLISHABLE_KEY = 'anon-key';

      expect(isSupabaseConfigured()).toBe(true);
    } finally {
      process.env = previousEnv;
    }
  });
});
