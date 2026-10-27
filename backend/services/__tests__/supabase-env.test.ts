import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDatabaseProvider,
  getRedisProvider,
  getSupabaseHealthKey,
  getSupabasePublishableKey,
  isSupabaseConfigured,
} from '../../../shared/lib/providers';
import { shouldUseLocalDatabase } from '../../../shared/lib/db';
import { loadRootEnv } from '../../../shared/lib/load-env';
import { checkSupabaseHealth } from '../../../frontend/utils/supabase/middleware';

describe('Supabase environment detection', () => {
  it('uses server-side Supabase vars when public vars are not set', () => {
    const previousEnv = { ...process.env };

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SECRET_KEY;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_PUBLISHABLE_KEY = 'anon-key';

      expect(isSupabaseConfigured()).toBe(true);
    } finally {
      process.env = previousEnv;
    }
  });

  it('accepts the legacy Supabase anon key for auth and health checks', () => {
    const previousEnv = { ...process.env };

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;

      expect(getSupabasePublishableKey()).toBe('legacy-anon-key');
      expect(getSupabaseHealthKey()).toBe('legacy-anon-key');
      expect(isSupabaseConfigured()).toBe(true);
    } finally {
      process.env = previousEnv;
    }
  });

  it('does not use a secret key as a browser or auth publishable key', () => {
    const previousEnv = { ...process.env };

    try {
      process.env.SUPABASE_SECRET_KEY = 'server-secret-key';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      expect(getSupabasePublishableKey()).toBeUndefined();
      expect(getSupabaseHealthKey()).toBe('server-secret-key');
    } finally {
      process.env = previousEnv;
    }
  });

  it('keeps deployment environment values when loading the root .env file', () => {
    const previousCwd = process.cwd();
    const previousUrl = process.env.SUPABASE_URL;
    const previousFileOnly = process.env.SUPABASE_TEST_FILE_ONLY;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signalflow-env-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, '.env'),
        'SUPABASE_URL=https://local.example.supabase.co\nSUPABASE_TEST_FILE_ONLY=loaded\n'
      );
      process.chdir(tempDir);
      process.env.SUPABASE_URL = 'https://deployment.example.supabase.co';
      delete process.env.SUPABASE_TEST_FILE_ONLY;

      expect(loadRootEnv()).toBe(path.join(tempDir, '.env'));
      expect(process.env.SUPABASE_URL).toBe('https://deployment.example.supabase.co');
      expect(process.env.SUPABASE_TEST_FILE_ONLY).toBe('loaded');
    } finally {
      process.chdir(previousCwd);
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousFileOnly === undefined) delete process.env.SUPABASE_TEST_FILE_ONLY;
      else process.env.SUPABASE_TEST_FILE_ONLY = previousFileOnly;
      fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('recognizes Supabase pooler connection strings', () => {
    const previousEnv = { ...process.env };

    try {
      process.env.DATABASE_URL =
        'postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres';
      delete process.env.USE_LOCAL_DATABASE;

      expect(getDatabaseProvider()).toBe('supabase');
    } finally {
      process.env = previousEnv;
    }
  });

  it('checks Supabase REST using the configured URL and publishable key', async () => {
    const previousEnv = { ...process.env };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    );

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co/';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

      await expect(checkSupabaseHealth()).resolves.toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://example.supabase.co/rest/v1/',
        expect.objectContaining({
          headers: {
            apikey: 'publishable-key',
            Authorization: 'Bearer publishable-key',
          },
          cache: 'no-store',
        })
      );
    } finally {
      fetch.mockRestore();
      process.env = previousEnv;
    }
  });
});
