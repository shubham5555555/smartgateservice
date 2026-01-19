import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VehicleEntryDocument = VehicleEntry & Document;

export enum EntryType {
  ENTRY = 'Entry',
  EXIT = 'Exit',
}

@Schema({ timestamps: true })
export class VehicleEntry {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Vehicle' })
  vehicleId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: EntryType })
  entryType: EntryType;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop()
  gateNumber?: string;

  @Prop()
  guardName?: string;

  @Prop()
  notes?: string;
}

export const VehicleEntrySchema = SchemaFactory.createForClass(VehicleEntry);
