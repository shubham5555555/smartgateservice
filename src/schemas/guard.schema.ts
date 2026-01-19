import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type GuardDocument = Guard & Document;

@Schema({ timestamps: true })
export class Guard {
  @Prop({ required: true, unique: true })
  guardId: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ required: true })
  password: string; // Hashed password

  @Prop({ required: true })
  name: string;

  @Prop()
  email?: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  shift?: string; // Morning, Evening, Night

  @Prop()
  gateNumber?: string; // Gate 1, Gate 2, etc.

  @Prop({ default: false })
  isOnDuty: boolean;

  @Prop()
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications

  // Method to compare password
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

export const GuardSchema = SchemaFactory.createForClass(Guard);

// Hash password before saving
GuardSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
