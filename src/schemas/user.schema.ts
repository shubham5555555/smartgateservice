import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AccountType, CompanyRole } from './company.schema';

export type UserDocument = User & Document;

export enum UserRole {
  OWNER = 'Owner',
  TENANT = 'Tenant',
  FAMILY_MEMBER = 'Family Member',
}

@Schema({ timestamps: true })
export class User {
  /** Tenant (builder) the resident belongs to — derived from the building. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  /** Resolved building reference; `building` below stays as the display name. */
  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  @Prop()
  phoneNumber?: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ index: true })
  normalizedEmail?: string;

  @Prop()
  password?: string; // Hashed password

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isApprovedByAdmin: boolean;

  @Prop()
  emailOtp?: string;

  @Prop()
  emailOtpExpiresAt?: Date;

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
  otp?: string; // Phone OTP (legacy)

  @Prop()
  otpExpiresAt?: Date; // Phone OTP expiry (legacy)

  @Prop()
  passwordResetOtp?: string;

  @Prop()
  passwordResetOtpExpiresAt?: Date;

  @Prop()
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications

  @Prop()
  parentUserId?: string; // Who created this account (owner for a sub-user, HR for an employee)

  @Prop()
  relation?: string; // Relationship to the owner (e.g. Son, Daughter, Renter)

  // ---- Company accounts (commercial offices) ----------------------------
  // Everything below is empty on a resident. `accountType` is what the apps
  // branch on; it defaults to `resident` so every existing row keeps working.

  @Prop({ type: String, enum: AccountType, default: AccountType.RESIDENT, index: true })
  accountType: AccountType;

  /** The office tenant this person belongs to. */
  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  companyId?: Types.ObjectId;

  @Prop({ type: String, enum: CompanyRole })
  companyRole?: CompanyRole;

  @Prop()
  employeeCode?: string;

  @Prop()
  designation?: string;

  @Prop()
  department?: string;

  /** Overrides the company's floor/unit for this person. */
  @Prop()
  workFloor?: string;

  @Prop()
  workUnit?: string;

  /** Set by an admin/HR-issued password; cleared once the person changes it. */
  @Prop({ default: false })
  mustChangePassword?: boolean;

  // ---- Employee gate pass ----------------------------------------------
  // Same primitive as a visitor pass, but it does not expire: it is valid
  // while the account is active and the pass has not been revoked.

  @Prop({ unique: true, sparse: true })
  passToken?: string;

  @Prop({ index: true })
  passCode?: string;

  @Prop()
  passIssuedAt?: Date;

  @Prop()
  passRevokedAt?: Date;

  @Prop({ default: true })
  isActive?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Team listings and the guard's employee lookup.
UserSchema.index({ companyId: 1, companyRole: 1, isActive: 1 });
UserSchema.index({ accountType: 1, buildingId: 1 });

// Add a pre-hook to prevent "pending" from being cast to ObjectId
// This hook intercepts ALL find operations and cleans invalid _id values
UserSchema.pre(/^find/, function (this: any) {
  // Check if this is a Query object (has getQuery method)
  if (!this || typeof this.getQuery !== 'function') {
    return;
  }

  const query = this.getQuery();

  if (!query || typeof query !== 'object') {
    return;
  }

  // If _id is "pending" or other invalid values, remove it from the query
  if (
    query._id === 'pending' ||
    query._id === 'null' ||
    query._id === 'undefined' ||
    query._id === ''
  ) {
    delete query._id;
  }

  // Check all query fields for invalid ObjectId values
  for (const key in query) {
    const value = query[key];

    // Check if this is an _id field or contains "Id" in the name
    if (
      key === '_id' ||
      (key.toLowerCase().includes('id') && typeof value === 'string')
    ) {
      // If value is "pending" or other invalid strings, remove it
      if (
        value === 'pending' ||
        value === 'null' ||
        value === 'undefined' ||
        value === ''
      ) {
        delete query[key];
      }
    }

    // Also check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nestedKey in value) {
        if (nestedKey === '_id' || nestedKey.toLowerCase().includes('id')) {
          const nestedValue = value[nestedKey];
          if (
            nestedValue === 'pending' ||
            nestedValue === 'null' ||
            nestedValue === 'undefined' ||
            nestedValue === ''
          ) {
            delete value[nestedKey];
          }
        }
      }
    }
  }
});
// Add useful indexes
// sparse: true so multiple users with null phoneNumber don't conflict
UserSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
// Keep normalizedEmail for case-insensitive lookups if needed
UserSchema.pre('save', async function () {
  if (this.email && typeof this.email === 'string') {
    this.normalizedEmail = this.email.toLowerCase();
  }
});
