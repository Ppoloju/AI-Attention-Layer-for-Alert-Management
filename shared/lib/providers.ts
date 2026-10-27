export type DatabaseProvider = 'supabase' | 'postgres' | 'local';
export type RedisProvider = 'upstash' | 'local';

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}

export function getSupabaseHealthKey(): string | undefined {
  return getSupabasePublishableKey() || process.env.SUPABASE_SECRET_KEY;
}

export function getDatabaseProvider(): DatabaseProvider {
  if (process.env.USE_LOCAL_DATABASE === 'true') return 'local';

  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (/supabase\.(?:co|com)/i.test(databaseUrl)) return 'supabase';
  if (databaseUrl) {
    return /localhost|127\.0\.0\.1/i.test(databaseUrl) ? 'local' : 'postgres';
  }

  if (process.env.USE_SUPABASE_DATABASE === 'true') return 'supabase';

  const supabaseDbHost = process.env.SUPABASE_DB_HOST ?? '';
  if (supabaseDbHost && !/localhost|127\.0\.0\.1/i.test(supabaseDbHost)) {
    return 'supabase';
  }

  const databaseHost = process.env.DB_HOST ?? '';
  if (databaseHost && !/localhost|127\.0\.0\.1/i.test(databaseHost)) {
    return 'postgres';
  }

  return 'local';
}

export function getRedisProvider(): RedisProvider {
  if (process.env.USE_LOCAL_REDIS === 'true') return 'local';

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  return 'local';
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseHealthKey();
  return Boolean(url && key);
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
