import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AmenityBookingDocument = AmenityBooking & Document;

export enum AmenityType {
  SWIMMING_POOL = 'Swimming Pool',
  GYM = 'Gym',
  CLUBHOUSE = 'Clubhouse',
  TENNIS_COURT = 'Tennis Court',
  BASKETBALL_COURT = 'Basketball Court',
  PARTY_HALL = 'Party Hall',
}

export enum BookingStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
}

export enum PaymentStatus {
  FREE = 'Free',
  PENDING = 'Payment Pending',
  PAID = 'Paid',
}

// Per-amenity fee configuration (in ₹ per 2-hour slot)
export const AMENITY_FEES: Record<AmenityType, number> = {
  [AmenityType.SWIMMING_POOL]: 200,
  [AmenityType.GYM]: 0,
  [AmenityType.CLUBHOUSE]: 1500,
  [AmenityType.TENNIS_COURT]: 300,
  [AmenityType.BASKETBALL_COURT]: 150,
  [AmenityType.PARTY_HALL]: 3000,
};

@Schema({ timestamps: true })
export class AmenityBooking {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amenityType: string;

  @Prop({ required: true })
  bookingDate: Date;

  @Prop({ required: true })
  timeSlot: string;

  @Prop({ enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Prop({ default: 0 })
  fee: number;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.FREE })
  paymentStatus: PaymentStatus;

  @Prop()
  paymentMethod?: string;

  @Prop()
  transactionId?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  notes?: string;
}

export const AmenityBookingSchema =
  SchemaFactory.createForClass(AmenityBooking);

// Index for efficient queries
AmenityBookingSchema.index({ userId: 1, bookingDate: 1 });
AmenityBookingSchema.index({ amenityType: 1, bookingDate: 1, timeSlot: 1 });
