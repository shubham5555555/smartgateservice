import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VisitorDocument = Visitor & Document;

export enum VisitorType {
  GUEST = 'Guest',
  DELIVERY = 'Delivery',
  SPOUSE = 'Spouse',
  STAFF = 'Staff',
}

export enum VisitorStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  INSIDE = 'Inside',
  LEFT = 'Left',
}

@Schema({ timestamps: true })
export class Visitor {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ enum: VisitorType, required: true })
  type: VisitorType;

  @Prop({ enum: VisitorStatus, default: VisitorStatus.PENDING })
  status: VisitorStatus;

  @Prop()
  phoneNumber?: string;

  @Prop()
  entryTime?: Date;

  @Prop()
  exitTime?: Date;

  @Prop({ default: false })
  isPreApproved: boolean;

  @Prop()
  expectedDate?: Date;

  @Prop()
  qrCode?: string; // QR code data for visitor verification
}

export const VisitorSchema = SchemaFactory.createForClass(Visitor);
