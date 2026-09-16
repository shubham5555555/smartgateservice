import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompanyDocument = Company & Document;

/** Which account types can exist in the resident/user app. */
export enum AccountType {
  /** A resident of a residential site (everything that existed before). */
  RESIDENT = 'resident',
  /** A member of a company renting an office in a commercial site. */
  COMPANY = 'company',
}

/**
 * A person's standing inside their company. Boss and HR share almost every
 * permission; the one difference is that only a boss may create another
 * boss/HR account.
 */
export enum CompanyRole {
  BOSS = 'boss',
  HR = 'hr',
  EMPLOYEE = 'employee',
}

export const COMPANY_ROLES: string[] = Object.values(CompanyRole);

/** Roles that manage the company (create employees, issue passes, see everyone). */
export const COMPANY_MANAGER_ROLES: string[] = [
  CompanyRole.BOSS,
  CompanyRole.HR,
];

@Schema({ _id: false })
export class CompanySettings {
  /** Employees may invite their own guests. */
  @Prop({ default: true })
  allowEmployeeInvites: boolean;

  /**
   * Force every company invite through the guard desk instead of arriving
   * pre-approved. Off by default: an employee vouching for their guest is the
   * commercial mirror of a resident pre-approving one.
   */
  @Prop({ default: false })
  invitesNeedDesk: boolean;

  /**
   * Optional cap HR cannot exceed (null = unlimited). The type is spelled out
   * because `number | null` is a union Mongoose cannot infer from metadata.
   */
  @Prop({ type: Number, default: null })
  employeeLimit?: number | null;
}

export const CompanySettingsSchema =
  SchemaFactory.createForClass(CompanySettings);

export function defaultCompanySettings(): CompanySettings {
  return {
    allowEmployeeInvites: true,
    invitesNeedDesk: false,
    employeeLimit: null,
  };
}

/**
 * An office tenant of a commercial building. Before this existed a company was
 * only a string typed at the desk (`Visitor.hostCompany`), so nobody inside it
 * could hold an account, be notified or be counted.
 */
@Schema({ timestamps: true })
export class Company {
  /** Builder that owns the building — makes the tenant plugin scope this. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  /** The commercial site this company rents in. */
  @Prop({ type: Types.ObjectId, ref: 'Building', required: true, index: true })
  buildingId: Types.ObjectId;

  @Prop()
  buildingName?: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** Lower-cased `name`; unique per building (see index below). */
  @Prop({ index: true })
  normalizedName?: string;

  /** Prefilled onto every visit to this company. */
  @Prop()
  floor?: string;

  @Prop({ type: [String], default: [] })
  units: string[];

  @Prop()
  logo?: string;

  @Prop()
  contactEmail?: string;

  @Prop()
  contactPhone?: string;

  @Prop()
  gstNumber?: string;

  @Prop({ type: CompanySettingsSchema, default: () => defaultCompanySettings() })
  settings: CompanySettings;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdBy?: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.pre('save', function () {
  if (this.name && typeof this.name === 'string') {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

// One company name per building (names repeat freely across buildings).
CompanySchema.index({ buildingId: 1, normalizedName: 1 }, { unique: true });
CompanySchema.index({ organizationId: 1, isActive: 1 });

/** The floor/unit a visit to this company should carry by default. */
export function companyLocation(company: Pick<Company, 'floor' | 'units'>): {
  floor?: string;
  unit?: string;
} {
  return {
    floor: company.floor || undefined,
    unit: (company.units && company.units[0]) || undefined,
  };
}
