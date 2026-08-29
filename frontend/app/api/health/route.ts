import { NextResponse } from 'next/server';
import EventQueue from '../../../lib/queue';
import { healthCheck } from '../../../../shared/lib/db';
import {
  getDatabaseProvider,
  getRedisProvider,
  isGroqConfigured,
  isSupabaseConfigured,
} from '../../../../shared/lib/providers';
import { checkSupabaseHealth } from '../../../utils/supabase/middleware';

export async function GET() {
  const queue = new EventQueue();

  try {
    const [redisHealthy, dbHealthy, supabaseHealthy, queueSize] = await Promise.all([
      queue.healthCheck(),
      healthCheck(),
      isSupabaseConfigured() ? checkSupabaseHealth() : Promise.resolve(null),
      queue.size().catch(() => null),
    ]);

    const services = {
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      database: dbHealthy ? 'healthy' : 'unhealthy',
      supabase: isSupabaseConfigured()
        ? supabaseHealthy
          ? 'healthy'
          : 'unhealthy'
        : 'not_configured',
    };

    const allHealthy =
      redisHealthy &&
      dbHealthy &&
      (!isSupabaseConfigured() || supabaseHealthy === true);

    return NextResponse.json({
      status: allHealthy ? 'ok' : 'degraded',
      version: '1.0.0',
      providers: {
        database: getDatabaseProvider(),
        redis: getRedisProvider(),
        groq: isGroqConfigured() ? 'configured' : 'not_configured',
        supabase: isSupabaseConfigured() ? 'configured' : 'not_configured',
      },
      services,
      queue: {
        pending: queueSize,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
