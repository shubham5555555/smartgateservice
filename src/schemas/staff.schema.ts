import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StaffDocument = Staff & Document;

export enum StaffStatus {
  INSIDE = 'Inside',
  OUTSIDE = 'Outside',
}

export enum StaffType {
  MAID = 'Maid',
  DRIVER = 'Driver',
  ELECTRICIAN = 'Electrician',
  PLUMBER = 'Plumber',
  COOK = 'Cook',
  SECURITY = 'Security',
  HOUSEKEEPING = 'Housekeeping',
  GARDENER = 'Gardener',
  CARPENTER = 'Carpenter',
  PAINTER = 'Painter',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Staff {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ required: true, enum: StaffType })
  type: StaffType;

  @Prop({ required: true })
  role: string; // Specific role description

  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  email?: string;

  @Prop()
  aadharNumber?: string;

  @Prop()
  address?: string;

  @Prop({ enum: StaffStatus, default: StaffStatus.OUTSIDE })
  status: StaffStatus;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes?: string;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
