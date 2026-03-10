import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReminderDocument = Reminder & Document;

export enum ReminderPriority {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum ReminderStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  SNOOZED = 'Snoozed',
}

export enum ReminderCategory {
  COMPLAINT_FOLLOWUP = 'Complaint Follow-up',
  MAINTENANCE_DUE = 'Maintenance Due',
  INSPECTION = 'Inspection',
  MEETING = 'Meeting',
  PAYMENT_FOLLOWUP = 'Payment Follow-up',
  DOCUMENT_RENEWAL = 'Document Renewal',
  EVENT = 'Event',
  GENERAL = 'General',
}

export enum EscalationLevel {
  LEVEL_1 = 'Level 1 - Maintenance Team',
  LEVEL_2 = 'Level 2 - Society Manager',
  LEVEL_3 = 'Level 3 - Admin/Committee',
}

@Schema({ timestamps: true })
export class Reminder {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ enum: ReminderPriority, default: ReminderPriority.MEDIUM })
  priority: ReminderPriority;

  @Prop({ enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus;

  @Prop({ enum: ReminderCategory, required: true })
  category: ReminderCategory;

  @Prop({ type: Types.ObjectId, ref: 'Staff', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Staff', default: [] })
  assignedTo: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Complaint' })
  relatedComplaint?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Maintenance' })
  relatedMaintenance?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event' })
  relatedEvent?: Types.ObjectId;

  @Prop()
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Staff' })
  completedBy?: Types.ObjectId;

  @Prop()
  notes?: string;

  @Prop({
    type: [
      {
        snoozedUntil: Date,
        reason: String,
        timestamp: Date,
      },
    ],
    default: [],
  })
  snoozeHistory?: Array<{
    snoozedUntil: Date;
    reason?: string;
    timestamp: Date;
  }>;

  @Prop({ default: false })
  notificationSent?: boolean;

  // Escalation Matrix Fields
  @Prop({ enum: EscalationLevel, default: EscalationLevel.LEVEL_1 })
  escalationLevel: EscalationLevel;

  @Prop()
  escalationDeadline?: Date;

  @Prop({
    type: [
      {
        fromLevel: String,
        toLevel: String,
        reason: String,
        escalatedAt: { type: Date, default: Date.now },
        escalatedBy: String,
      },
    ],
    default: [],
  })
  escalationHistory?: Array<{
    fromLevel: string;
    toLevel: string;
    reason: string;
    escalatedAt: Date;
    escalatedBy: string;
  }>;

  @Prop({ default: false })
  escalated?: boolean;
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
