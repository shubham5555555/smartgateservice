import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MaintenanceDocument = Maintenance & Document;

export enum PaymentStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  OVERDUE = 'Overdue',
  RESOLVED = 'Resolved',
}

@Schema({ timestamps: true })
export class Maintenance {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string; // Monthly Maintenance Fee

  @Prop({ required: true })
  month: string; // November 2023

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop()
  dueDate?: Date;

  @Prop()
  paidDate?: Date;

  @Prop()
  paymentMethod?: string;

  @Prop()
  transactionId?: string;
}

export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
