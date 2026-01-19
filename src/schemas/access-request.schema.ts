import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccessRequestDocument = AccessRequest & Document;

export enum AccessRequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

@Schema({ timestamps: true })
export class AccessRequest {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  flatNo: string;

  @Prop({ required: true })
  block: string;

  @Prop()
  documentImage?: string;

  @Prop({ enum: AccessRequestStatus, default: AccessRequestStatus.PENDING })
  status: AccessRequestStatus;
}

export const AccessRequestSchema = SchemaFactory.createForClass(AccessRequest);
