import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VehicleDocument = Vehicle & Document;

export enum VehicleType {
  CAR = 'Car',
  BIKE = 'Bike',
  SCOOTER = 'Scooter',
  CYCLE = 'Cycle',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true, enum: VehicleType })
  vehicleType: VehicleType;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  model: string;

  @Prop()
  color?: string;

  @Prop()
  rcNumber?: string;

  @Prop()
  insuranceNumber?: string;

  @Prop()
  insuranceExpiry?: Date;

  @Prop()
  rcDocument?: string; // URL to RC document

  @Prop()
  insuranceDocument?: string; // URL to insurance document

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes?: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
