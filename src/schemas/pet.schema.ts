import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PetDocument = Pet & Document;

export enum PetType {
  DOG = 'Dog',
  CAT = 'Cat',
  BIRD = 'Bird',
  FISH = 'Fish',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Pet {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: PetType })
  type: PetType;

  @Prop()
  breed: string;

  @Prop()
  color: string;

  @Prop()
  age: number;

  @Prop()
  weight: number;

  @Prop()
  photo: string;

  @Prop()
  vaccinationRecords: string[]; // Array of vaccination record URLs

  @Prop()
  medicalNotes: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  registrationNumber: string; // Pet registration/license number

  @Prop()
  microchipNumber: string;

  @Prop()
  lastVaccinationDate: Date;

  @Prop()
  nextVaccinationDate: Date;
}

export const PetSchema = SchemaFactory.createForClass(Pet);
