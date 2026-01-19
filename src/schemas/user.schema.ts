import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  OWNER = 'Owner',
  TENANT = 'Tenant',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop()
  email?: string;

  @Prop()
  fullName?: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ enum: UserRole })
  role?: UserRole;

  @Prop()
  block?: string;

  @Prop()
  flat?: string;

  @Prop()
  address?: string;

  @Prop()
  building?: string;

  @Prop()
  flatNo?: string;

  @Prop()
  residentType?: string;

  @Prop()
  emergencyContact?: string;

  @Prop()
  emergencyPhone?: string;

  @Prop()
  aadharNumber?: string;

  @Prop()
  panNumber?: string;

  @Prop({ default: false })
  isProfileComplete: boolean;

  @Prop()
  otp?: string;

  @Prop()
  otpExpiresAt?: Date;

  @Prop()
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications
}

export const UserSchema = SchemaFactory.createForClass(User);
