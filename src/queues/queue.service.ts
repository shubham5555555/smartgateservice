import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Record<string, Queue> = {};

  constructor() {
    const imageWorker = new Worker(
      'imageQueue',
      async (job) => {
        this.logger.log(`Processing image job ${job.id} type=${job.name}`);
        return { ok: true };
      },
      { connection },
    );

    imageWorker.on('failed', (job, err) => {
      this.logger.error(`Image job failed ${job?.id}`, err);
    });
  }

  getQueue(name: string) {
    if (!this.queues[name]) {
      this.queues[name] = new Queue(name, { connection });
    }
    return this.queues[name];
  }

  async add(name: string, data: any, opts?: any) {
    const q = this.getQueue(name);
    return q.add(name, data, opts || {});
  }
}

