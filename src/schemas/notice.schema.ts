import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NoticeDocument = Notice & Document;

export enum NoticeStatus {
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
}

@Schema({ timestamps: true })
export class Notice {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  expiryDate: Date;

  @Prop({ enum: NoticeStatus, default: NoticeStatus.ACTIVE })
  status: NoticeStatus;

  @Prop({ type: [String], default: [] })
  attachments: string[];
}

export const NoticeSchema = SchemaFactory.createForClass(Notice);
