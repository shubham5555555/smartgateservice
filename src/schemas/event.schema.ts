import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document;

export enum EventStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
}

export enum EventType {
  FESTIVAL = 'Festival',
  MEETING = 'Meeting',
  CELEBRATION = 'Celebration',
  SPORTS = 'Sports',
  CULTURAL = 'Cultural',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, type: String, enum: Object.values(EventType) })
  type: EventType;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop()
  startTime: string; // e.g., "10:00 AM"

  @Prop()
  endTime: string; // e.g., "2:00 PM"

  @Prop()
  location: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(EventStatus), default: EventStatus.DRAFT })
  status: EventStatus;

  @Prop({ default: 0 })
  maxAttendees: number; // 0 means unlimited

  @Prop({ default: 0 })
  currentAttendees: number;

  @Prop({ type: [{ userId: Types.ObjectId, userName: String, rsvpDate: Date }], default: [] })
  rsvps: Array<{
    userId: Types.ObjectId;
    userName: string;
    rsvpDate: Date;
  }>;

  @Prop({ default: false })
  isReminderSent: boolean;

  @Prop()
  reminderSentAt: Date;

  @Prop({ default: true })
  isPublic: boolean; // Public events visible to all residents

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  invitedUsers: Types.ObjectId[]; // For private events

  @Prop({ default: 0 })
  viewCount: number;
}

export const EventSchema = SchemaFactory.createForClass(Event);
