import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmergencyContactDocument = EmergencyContact & Document;

export enum ContactType {
  SECURITY = 'Security',
  MAINTENANCE = 'Maintenance',
  ADMIN = 'Admin',
  MEDICAL = 'Medical',
  FIRE = 'Fire',
  POLICE = 'Police',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class EmergencyContact {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  alternatePhone?: string;

  @Prop()
  email?: string;

  @Prop({ required: true, enum: ContactType })
  contactType: ContactType;

  @Prop()
  location?: string; // Gate number, building, etc.

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes?: string;
}

export const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);
