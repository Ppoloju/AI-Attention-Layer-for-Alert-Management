import { NextResponse } from 'next/server';
import EventQueue from '../../../lib/queue';
import { healthCheck } from '../../../../shared/lib/db';

export async function GET() {
  const queue = new EventQueue();

  try {
    const [redisHealthy, dbHealthy] = await Promise.all([
      queue.healthCheck(),
      healthCheck(),
    ]);

    const status = redisHealthy && dbHealthy ? 'ok' : 'degraded';

    return NextResponse.json({
      status,
      services: {
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        database: dbHealthy ? 'healthy' : 'unhealthy',
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
