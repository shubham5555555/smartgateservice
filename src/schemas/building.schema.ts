import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

@Schema({ timestamps: true })
export class Building {
  @Prop({ required: true, unique: true })
  name: string;
 
  @Prop({ index: true })
  normalizedName?: string;

  @Prop({ required: true })
  address: string;

  @Prop({ default: 'Apartment' })
  type: string; // Apartment, Tower, Individual Home, Commercial, Villa

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
});

// Indexes for performance
// Index nested residentId for fast lookups (array index)
BuildingSchema.index({ 'floors.flats.residentId': 1 });
// Index occupiedFlats for sorting/filtering
BuildingSchema.index({ occupiedFlats: 1 });
