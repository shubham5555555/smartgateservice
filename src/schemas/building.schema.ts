import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  SiteSettings,
  SiteSettingsSchema,
  SiteType,
  defaultSiteSettings,
  inferSiteType,
} from './site-settings';
import {
  PropertyType,
  UnitModel,
  propertyTypeFromLegacyLabel,
  propertyTypeInfo,
} from './property-types';

export type BuildingDocument = Building & Document;

export enum FlatStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
}

export interface Flat {
  flatNumber: string;
  floor: number;
  status: FlatStatus;
  residentId?: string;
  residentName?: string;
  residentEmail?: string;
  residentPhone?: string;
  area?: number; // in sqft
  bedrooms?: number;
  features?: string[]; // e.g., ['parking', 'balcony', 'garden']
  images?: string[]; // URLs of flat images
}

export interface Floor {
  floorNumber: number;
  flats: Flat[];
}

export interface Gate {
  gateId: string;
  name: string;
}

export function generateGateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

@Schema({ timestamps: true })
export class Building {
  /** Tenant (builder) that owns this building. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  /** Unique within the organization (see compound index below). */
  @Prop({ required: true })
  name: string;
 
  @Prop({ index: true })
  normalizedName?: string;

  @Prop({ required: true })
  address: string;

  /** Display label; derived from `propertyType` when not given. */
  @Prop({ default: 'Apartment' })
  type: string;

  /** What kind of property this is; fixes siteType, unit model and unit label. */
  @Prop({ enum: PropertyType, default: PropertyType.APARTMENT, index: true })
  propertyType: PropertyType;

  /** 'floors' (101, 102…) or 'standalone' (Villa-001, Plot-001…). */
  @Prop({ enum: UnitModel, default: UnitModel.FLOORS })
  unitModel: UnitModel;

  /** "Flat", "Villa", "Plot", "Office"… — what the UI calls one unit. */
  @Prop({ default: 'Flat' })
  unitLabel: string;

  /**
   * Behavioural mode of the site. `type` above is only a display label;
   * this is what the visitor flow branches on.
   */
  @Prop({ enum: SiteType, default: SiteType.RESIDENTIAL, index: true })
  siteType: SiteType;

  @Prop({ type: SiteSettingsSchema, default: () => defaultSiteSettings(SiteType.RESIDENTIAL) })
  settings: SiteSettings;

  /** Opaque token encoded in the QR poster printed at the gate. */
  @Prop({ unique: true, sparse: true })
  gateQrToken?: string;

  @Prop({ type: [{ gateId: String, name: String }], default: [] })
  gates?: Gate[];

  @Prop()
  totalFloors: number;

  @Prop()
  flatsPerFloor: number;

  @Prop({ type: Object })
  floors: Floor[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  amenities: string[]; // e.g., ['gym', 'pool', 'parking', 'security']

  @Prop()
  description: string;

  @Prop()
  image?: string; // Main building image URL

  @Prop({ type: [String], default: [] })
  images?: string[]; // Additional building images

  @Prop({ default: 0 })
  totalFlats: number;

  @Prop({ default: 0 })
  occupiedFlats: number;

  @Prop({ default: 0 })
  availableFlats: number;
}

export const BuildingSchema = SchemaFactory.createForClass(Building);

// Ensure normalized name is stored for case-insensitive lookups
BuildingSchema.pre('save', async function () {
  if (this.name && typeof this.name === 'string') {
    this.normalizedName = this.name.toLowerCase();
  }
  // Property type drives the label, unit model, unit label and site mode.
  if (!this.propertyType) {
    this.propertyType = propertyTypeFromLegacyLabel(this.type);
  }
  const info = propertyTypeInfo(this.propertyType);
  if (!this.type) this.type = info.label;
  if (!this.unitModel) this.unitModel = info.unitModel;
  if (!this.unitLabel) this.unitLabel = info.unitLabel;
  // Infer the mode the first time a building is saved.
  if (!this.siteType) {
    this.siteType = info.siteType || inferSiteType(this.type);
  }
  if (!this.settings) {
    this.settings = defaultSiteSettings(this.siteType);
  }
  if (!this.gateQrToken) {
    this.gateQrToken = generateGateQrToken();
  }
});

// A builder cannot have two buildings with the same name; different builders can.
BuildingSchema.index(
  { organizationId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { normalizedName: { $type: 'string' } } },
);
// Indexes for performance
// Index nested residentId for fast lookups (array index)
BuildingSchema.index({ 'floors.flats.residentId': 1 });
// Index occupiedFlats for sorting/filtering
BuildingSchema.index({ occupiedFlats: 1 });
