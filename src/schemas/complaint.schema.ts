import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint & Document;

export enum ComplaintPriority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum ComplaintStatus {
  OPEN = 'Open',
  ASSIGNED = 'Assigned',
  RESOLVED = 'Resolved',
}

@Schema({ timestamps: true })
export class Complaint {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: ComplaintPriority, default: ComplaintPriority.MEDIUM })
  priority: ComplaintPriority;

  @Prop({ enum: ComplaintStatus, default: ComplaintStatus.OPEN })
  status: ComplaintStatus;

  @Prop({ required: true })
  flatNo: string;

  @Prop({ required: true })
  block: string;

  @Prop({ type: Types.ObjectId, ref: 'Staff' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Staff' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  notes?: string;

  @Prop({ type: [String], default: [] })
  attachments?: string[]; // URLs to photos/videos

  @Prop()
  category?: string; // Maintenance, Security, Cleaning, etc.
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
