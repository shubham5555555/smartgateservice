import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AmenityDocument = Amenity & Document;

export const AMENITY_ICON_OPTIONS = [
  'pool',
  'fitness_center',
  'home',
  'sports_tennis',
  'sports_basketball',
  'celebration',
  'local_cafe',
  'directions_bike',
  'sports_cricket',
  'sports_volleyball',
  'library_books',
  'meeting_room',
  'park',
  'movie',
  'sports_football',
  'golf_course',
  'hot_tub',
  'sports_esports',
  'music_note',
  'child_care',
] as const;

export type AmenityIcon = (typeof AMENITY_ICON_OPTIONS)[number];

@Schema({ timestamps: true })
export class Amenity {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: 'pool' })
  icon: string;

  @Prop({ default: '#2196F3' })
  color: string;

  @Prop({ required: true, default: 0, min: 0 })
  fee: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 10 })
  maxCapacityPerSlot: number;

  @Prop({
    type: [String],
    default: [
      '6:00 AM - 8:00 AM',
      '8:00 AM - 10:00 AM',
      '10:00 AM - 12:00 PM',
      '12:00 PM - 2:00 PM',
      '2:00 PM - 4:00 PM',
      '4:00 PM - 6:00 PM',
      '6:00 PM - 8:00 PM',
      '8:00 PM - 10:00 PM',
    ],
  })
  availableSlots: string[];

  @Prop()
  rules?: string;
}

export const AmenitySchema = SchemaFactory.createForClass(Amenity);
