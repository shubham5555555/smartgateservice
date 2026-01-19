import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PackageDocument = Package & Document;

export enum PackageStatus {
  PENDING = 'Pending',
  COLLECTED = 'Collected',
  RETURNED = 'Returned',
}

@Schema({ timestamps: true })
export class Package {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  trackingNumber: string;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: true })
  recipientPhone: string;

  @Prop()
  deliveryCompany?: string;

  @Prop()
  deliveryPersonName?: string;

  @Prop()
  deliveryPersonPhone?: string;

  @Prop({ type: [String], default: [] })
  photos?: string[]; // URLs to package photos

  @Prop({ enum: PackageStatus, default: PackageStatus.PENDING })
  status: PackageStatus;

  @Prop()
  collectedBy?: string; // Name of person who collected

  @Prop()
  collectedAt?: Date;

  @Prop()
  notes?: string;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
