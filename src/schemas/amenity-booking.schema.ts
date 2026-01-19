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

@Schema({ timestamps: true })
export class AmenityBooking {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: AmenityType })
  amenityType: AmenityType;

  @Prop({ required: true })
  bookingDate: Date;

  @Prop({ required: true })
  timeSlot: string; // e.g., "6:00 AM - 8:00 AM"

  @Prop({ enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Prop()
  notes?: string;
}

export const AmenityBookingSchema = SchemaFactory.createForClass(AmenityBooking);

// Index for efficient queries
AmenityBookingSchema.index({ userId: 1, bookingDate: 1 });
AmenityBookingSchema.index({ amenityType: 1, bookingDate: 1, timeSlot: 1 });
