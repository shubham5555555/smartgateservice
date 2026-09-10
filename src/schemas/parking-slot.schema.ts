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
  /** Tenant (builder / property company) this record belongs to. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building' })
  building?: Types.ObjectId;

  @Prop()
  buildingName?: string;

  @Prop({ required: true })
  slotNumber: string; // B-204, G-105, etc.

  @Prop({ required: true })
  floor: string; // Basement 2, Ground Floor, etc.

  @Prop({ enum: SlotStatus, default: SlotStatus.VACANT })
  status: SlotStatus;

  @Prop({ enum: SlotType })
  slotType: SlotType;

  @Prop()
  parkingType?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop()
  licensePlate?: string;

  @Prop()
  vehicleName?: string;
}

export const ParkingSlotSchema = SchemaFactory.createForClass(ParkingSlot);
