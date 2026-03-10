import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ParcelDocument = Parcel & Document;

export enum ParcelStatus {
  PENDING = 'Pending',
  COLLECTED = 'Collected',
  RETURNED = 'Returned',
}

export enum ParcelType {
  PACKAGE = 'Package',
  DOCUMENT = 'Document',
  FRAGILE = 'Fragile',
  MEDICINE = 'Medicine',
  FOOD = 'Food',
  COURIER = 'Courier',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Parcel {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  trackingNumber: string;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: true })
  recipientPhone: string;

  @Prop()
  flatNumber?: string;

  @Prop({ enum: ParcelType, default: ParcelType.PACKAGE })
  parcelType?: ParcelType;

  @Prop()
  deliveryCompany?: string;

  @Prop()
  deliveryPersonName?: string;

  @Prop()
  deliveryPersonPhone?: string;

  @Prop({ type: [String], default: [] })
  photos?: string[];

  @Prop({ enum: ParcelStatus, default: ParcelStatus.PENDING })
  status: ParcelStatus;

  @Prop()
  collectedBy?: string;

  @Prop()
  collectedAt?: Date;

  @Prop()
  loggedBy?: string;

  @Prop()
  returnedAt?: Date;

  @Prop()
  notes?: string;
}

export const ParcelSchema = SchemaFactory.createForClass(Parcel);
