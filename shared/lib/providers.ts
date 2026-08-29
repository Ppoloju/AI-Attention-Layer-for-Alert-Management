export type DatabaseProvider = 'supabase' | 'local';
export type RedisProvider = 'upstash' | 'local';

export function getDatabaseProvider(): DatabaseProvider {
  const url = process.env.DATABASE_URL ?? '';
  if (/supabase\.co/i.test(url)) return 'supabase';
  return 'local';
}

export function getRedisProvider(): RedisProvider {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  return 'local';
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
