import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper. The cache is an optimisation, never a dependency: if
 * Redis is down or unreachable every method degrades to a cache miss instead
 * of failing the request.
 */
@Injectable()
export class CacheService {
  private client: Redis;
  private readonly logger = new Logger(CacheService.name);
  private available = false;
  private warned = false;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://127.0.0.1:6379',
    );
    this.client = new Redis(redisUrl, {
      // Fail fast instead of queueing commands for a server that is not there.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
      retryStrategy: (times) => Math.min(times * 1_000, 30_000),
    });
    this.client.on('ready', () => {
      this.available = true;
      this.warned = false;
      this.logger.log('Redis connected');
    });
    this.client.on('end', () => (this.available = false));
    this.client.on('error', (err) => {
      this.available = false;
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          `Redis unavailable (${err?.message || err}); running without cache`,
        );
      }
    });
  }

  get isAvailable(): boolean {
    return this.available;
  }

  async get(key: string) {
    if (!this.available) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 60) {
    if (!this.available) return;
    try {
      const str = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, str, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, str);
      }
    } catch {
      /* cache write failures are not the caller's problem */
    }
  }

  async del(key: string) {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }

  async flush() {
    if (!this.available) return;
    try {
      await this.client.flushdb();
    } catch {
      /* ignore */
    }
  }
}
