import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ParkingType } from './parking-slot.schema';

export type ParkingApplicationDocument = ParkingApplication & Document;

export enum ApplicationStatus {
  UNDER_REVIEW = 'Under Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  IN_PROGRESS = 'In Progress',
  CLOSED = 'Closed',
}

@Schema({ timestamps: true })
export class ParkingApplication {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  applicationNumber: string; // #SG-PRK-8821

  @Prop({ required: true })
  description: string; // Permanent Sticker Request, Guest Slot Reservation, etc.

  @Prop({ enum: ApplicationStatus, default: ApplicationStatus.UNDER_REVIEW })
  status: ApplicationStatus;

  @Prop({ enum: ParkingType })
  parkingType?: ParkingType;

  @Prop()
  vehicle?: string;

  @Prop()
  block?: string;

  @Prop()
  licensePlate?: string;

  @Prop()
  notes?: string;
}

export const ParkingApplicationSchema = SchemaFactory.createForClass(ParkingApplication);
