import { describe, it, expect } from 'vitest';
import {
  getDatabaseProvider,
  getRedisProvider,
  isSupabaseConfigured,
} from '../../../shared/lib/providers';
import { shouldUseLocalDatabase } from '../../../shared/lib/db';

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

  it('prefers DATABASE_URL over default local database settings', () => {
    const previousEnv = { ...process.env };

    try {
      process.env.DATABASE_URL = 'postgresql://user:password@db.example.com:5432/app';
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'signalflow';
      process.env.DB_USER = 'signalflow';
      process.env.DB_PASSWORD = 'signalflow_password';
      delete process.env.USE_LOCAL_DATABASE;
      delete process.env.USE_SUPABASE_DATABASE;

      expect(shouldUseLocalDatabase()).toBe(false);
      expect(getDatabaseProvider()).toBe('postgres');

      process.env.USE_LOCAL_DATABASE = 'true';
      expect(shouldUseLocalDatabase()).toBe(true);
    } finally {
      process.env = previousEnv;
    }
  });

  it('prefers local Redis when explicitly requested over Upstash credentials', () => {
    const previousEnv = { ...process.env };

    try {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      process.env.USE_LOCAL_REDIS = 'true';

      expect(getRedisProvider()).toBe('local');

      delete process.env.USE_LOCAL_REDIS;
      expect(getRedisProvider()).toBe('upstash');
    } finally {
      process.env = previousEnv;
    }
  });

  it('prefers a configured Supabase host over default local database settings', () => {
    const previousEnv = { ...process.env };

    try {
      delete process.env.DATABASE_URL;
      delete process.env.USE_LOCAL_DATABASE;
      delete process.env.USE_SUPABASE_DATABASE;
      process.env.SUPABASE_DB_HOST = 'db.example.supabase.co';
      process.env.DB_HOST = 'localhost';

      expect(shouldUseLocalDatabase()).toBe(false);
      expect(getDatabaseProvider()).toBe('supabase');
    } finally {
      process.env = previousEnv;
    }
  });
});
