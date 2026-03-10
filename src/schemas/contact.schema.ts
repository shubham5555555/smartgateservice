import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactDocument = Contact & Document;

export enum ContactType {
  EMERGENCY = 'Emergency',
  VENDOR = 'Vendor',
}

export enum ContactCategory {
  // Emergency categories
  POLICE = 'Police',
  FIRE = 'Fire',
  AMBULANCE = 'Ambulance',
  HOSPITAL = 'Hospital',

  // Vendor categories
  PLUMBER = 'Plumber',
  ELECTRICIAN = 'Electrician',
  CARPENTER = 'Carpenter',
  PAINTER = 'Painter',
  SECURITY = 'Security',
  CLEANER = 'Cleaner',
  GARDENER = 'Gardener',
  PEST_CONTROL = 'Pest Control',
  AC_REPAIR = 'AC Repair',
  APPLIANCE_REPAIR = 'Appliance Repair',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true, enum: ContactType })
  type: ContactType;

  @Prop({ required: true, enum: ContactCategory })
  category: ContactCategory;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  alternatePhone?: string;

  @Prop()
  email?: string;

  @Prop()
  address?: string;

  @Prop()
  description?: string;

  @Prop()
  availability?: string; // e.g., "24/7", "9 AM - 6 PM"

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes?: string;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
