import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ParkingSlotDocument = ParkingSlot & Document;

export enum SlotStatus {
  OCCUPIED = 'Occupied',
  VACANT = 'Vacant',
}

export enum SlotType {
  MAIN = 'Main',
  GUEST = 'Guest',
}

export enum ParkingType {
  PERMANENT = 'Permanent',
  GUEST = 'Guest',
  EV_CHARGER = 'EV Charger',
}

@Schema({ timestamps: true })
export class ParkingSlot {
  @Prop({ required: true })
  slotNumber: string; // B-204, G-105, etc.

  @Prop({ required: true })
  floor: string; // Basement 2, Ground Floor, etc.

  @Prop({ enum: SlotStatus, default: SlotStatus.VACANT })
  status: SlotStatus;

  @Prop({ enum: SlotType })
  slotType: SlotType;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop()
  licensePlate?: string;

  @Prop()
  vehicleName?: string;
}

export const ParkingSlotSchema = SchemaFactory.createForClass(ParkingSlot);
