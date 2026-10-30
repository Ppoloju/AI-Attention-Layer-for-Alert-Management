import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';
import { getRedisProvider } from '../../shared/lib/providers';
import type { Event as SignalEvent } from '../../shared/schemas/event';

const QUEUE_NAME = 'events:queue';

// ─── Client factory ──────────────────────────────────────────────────────────
//
// LOCAL:
//   ioredis + REDIS_URL (default: redis://localhost:6379)
//
// PRODUCTION (Upstash):
//   @upstash/redis + UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//
// Upstash takes precedence when its env vars are set.

type RedisClient = {
  rpush(key: string, ...args: string[]): Promise<number>;
  /**
   * Raw reply. `ioredis` always returns the stored string, while
   * `@upstash/redis` auto-deserializes JSON and returns an object, so callers
   * must handle both shapes.
   */
  lpop(key: string): Promise<unknown>;
  llen(key: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
};

function createRedisClient(): RedisClient {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (getRedisProvider() === 'upstash' && upstashUrl && upstashToken) {
    // Upstash REST client
    console.log('Using Upstash Redis (REST)');
    const client = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    });

    // Wrap to match our interface
    return {
      async rpush(key: string, ...args: string[]) {
        return client.rpush(key, ...args);
      },
      async lpop(key: string) {
        // May already be a deserialized object — do not coerce to string here.
        return client.lpop(key);
      },
      async llen(key: string) {
        return client.llen(key);
      },
      async ping() {
        return client.ping();
      },
      async quit() {
        // Upstash REST client has no persistent connection to close
      },
    };
  }

  // Local Docker — ioredis
  console.log('Using local Redis (ioredis)');
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  client.on('error', (error: Error) => {
    console.error('Redis connection error:', error.message || error.name);
  });
  return client;
}

// ─── EventQueue ──────────────────────────────────────────────────────────────

class EventQueue {
  private client: RedisClient;

  constructor() {
    this.client = createRedisClient();
  }

  async enqueue(event: SignalEvent): Promise<void> {
    await this.client.rpush(QUEUE_NAME, JSON.stringify(event));
  }

  async dequeue(): Promise<SignalEvent | null> {
    const result = await this.client.lpop(QUEUE_NAME);
    if (result === null || result === undefined) return null;

    if (typeof result === 'string') {
      try {
        return JSON.parse(result) as SignalEvent;
      } catch (error) {
        console.error('Failed to parse event from queue:', error);
        return null;
      }
    }

    if (typeof result === 'object') {
      // Upstash already deserialized the JSON payload for us.
      return result as SignalEvent;
    }

    console.error('Unexpected queue payload type:', typeof result);
    return null;
  }

  async size(): Promise<number> {
    return this.client.llen(QUEUE_NAME);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export default EventQueue;
