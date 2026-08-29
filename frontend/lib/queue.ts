import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

const QUEUE_NAME = 'events:queue';

type RedisClient = {
  rpush(key: string, ...args: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<any>;
};

function createRedisClient(): RedisClient {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    const client = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    });

    return {
      async rpush(key: string, ...args: string[]) {
        return client.rpush(key, ...args);
      },
      async lpop(key: string) {
        const result = await client.lpop(key);
        return typeof result === 'string' ? result : null;
      },
      async llen(key: string) {
        return client.llen(key);
      },
      async ping() {
        return client.ping();
      },
      async quit() {
        // No-op for REST client
      },
    };
  }

  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}

class EventQueue {
  private client: RedisClient;

  constructor() {
    this.client = createRedisClient();
  }

  async enqueue(event: any): Promise<void> {
    await this.client.rpush(QUEUE_NAME, JSON.stringify(event));
  }

  async dequeue(): Promise<any | null> {
    const result = await this.client.lpop(QUEUE_NAME);
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to parse event from queue:', error);
      return null;
    }
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
