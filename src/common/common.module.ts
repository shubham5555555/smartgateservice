import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { S3Service } from './s3.service';
import { EmailService } from './email.service';
import { EscalationService } from './escalation.service';
import { CacheService } from './cache.service';
import { QueueService } from '../queues/queue.service';
import { LoggerService } from './logger.service';
import { Complaint, ComplaintSchema } from '../schemas/complaint.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Generous global default; the public gate-QR routes tighten it per-route
    // with @Throttle and opt into ThrottlerGuard explicitly.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Reminder.name, schema: ReminderSchema },
    ]),
  ],
  providers: [S3Service, EmailService, EscalationService, CacheService, QueueService, LoggerService],
  exports: [S3Service, EmailService, EscalationService, CacheService, QueueService, LoggerService],
})
export class CommonModule { }
