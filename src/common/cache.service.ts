import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private client: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new Redis(redisUrl);
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async get(key: string) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttlSeconds = 60) {
    const str = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, str, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, str);
    }
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async flush() {
    await this.client.flushdb();
  }
}

