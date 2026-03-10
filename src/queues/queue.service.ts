import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Record<string, Queue> = {};
  private readonly connection: IORedis;

  constructor(private readonly configService: ConfigService) {
    this.connection = new IORedis(
      this.configService.get<string>('REDIS_URL', 'redis://default:TlGMWaK369Vl7xgiAhvmRzYx2VHeGP19@redis-14058.crce281.ap-south-1-3.ec2.cloud.redislabs.com:14058'),
      { maxRetriesPerRequest: null },
    );

    const imageWorker = new Worker(
      'imageQueue',
      async (job) => {
        this.logger.log(`Processing image job ${job.id} type=${job.name}`);
        return { ok: true };
      },
      { connection: this.connection },
    );

    imageWorker.on('failed', (job, err) => {
      this.logger.error(`Image job failed ${job?.id}`, err);
    });
  }

  getQueue(name: string) {
    if (!this.queues[name]) {
      this.queues[name] = new Queue(name, { connection: this.connection });
    }
    return this.queues[name];
  }

  async add(name: string, data: any, opts?: any) {
    const q = this.getQueue(name);
    return q.add(name, data, opts || {});
  }
}

