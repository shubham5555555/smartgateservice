import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type AdminUserDocument = AdminUser & Document;

export enum AdminRole {
  /** Platform operator: every organization, can create builders. */
  SUPER_ADMIN = 'super_admin',
  /** Everything inside one organization. */
  BUILDER_ADMIN = 'builder_admin',
  /** Only the buildings listed on the account, inside one organization. */
  BUILDING_MANAGER = 'building_manager',
}

export const ADMIN_ROLES: string[] = Object.values(AdminRole);

@Schema({ timestamps: true })
export class AdminUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string; // bcrypt hash

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ enum: AdminRole, required: true, index: true })
  role: AdminRole;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  /** building_manager only: the buildings this account may work on. */
  @Prop({ type: [Types.ObjectId], ref: 'Building', default: [] })
  buildingIds: Types.ObjectId[];

  @Prop()
  phoneNumber?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  createdBy?: string;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

AdminUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) return; // already hashed
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
