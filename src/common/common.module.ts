import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CloudinaryService } from './cloudinary.service';
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
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Reminder.name, schema: ReminderSchema },
    ]),
  ],
  providers: [CloudinaryService, EmailService, EscalationService, CacheService, QueueService, LoggerService],
  exports: [CloudinaryService, EmailService, EscalationService, CacheService, QueueService, LoggerService],
})
export class CommonModule {}
