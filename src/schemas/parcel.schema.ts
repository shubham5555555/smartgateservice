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
  /** Tenant (builder / property company) this record belongs to. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  // ---- Site / commercial recipient (no resident account) ----
  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  @Prop()
  buildingName?: string;

  @Prop()
  siteType?: string; // residential | commercial

  @Prop()
  recipientCompany?: string;

  @Prop()
  recipientFloor?: string;

  @Prop()
  recipientUnit?: string;

  /** Where it is kept at the desk (shelf / locker). */
  @Prop()
  storageLocation?: string;

  @Prop({ default: false })
  isPerishable?: boolean;

  /** Courier visit that dropped it (commercial). */
  @Prop({ type: Types.ObjectId, ref: 'Visitor' })
  visitorId?: Types.ObjectId;

  @Prop()
  collectedByPhone?: string;

  @Prop()
  collectedByIdLast4?: string;

  @Prop()
  notifiedAt?: Date;

  @Prop({ required: true })
  trackingNumber: string;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: false, default: '' })
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
