import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketplaceListingDocument = MarketplaceListing & Document;

export enum ListingStatus {
  ACTIVE = 'Active',
  SOLD = 'Sold',
  RESERVED = 'Reserved',
  DELETED = 'Deleted',
}

export enum ListingCategory {
  ELECTRONICS = 'Electronics',
  FURNITURE = 'Furniture',
  CLOTHING = 'Clothing',
  BOOKS = 'Books',
  APPLIANCES = 'Appliances',
  VEHICLES = 'Vehicles',
  SPORTS = 'Sports & Fitness',
  TOYS = 'Toys & Games',
  HOME_DECOR = 'Home & Decor',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class MarketplaceListing {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ListingCategory })
  category: ListingCategory;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [String], default: [] })
  images: string[]; // URLs to product images

  @Prop({ enum: ListingStatus, default: ListingStatus.ACTIVE })
  status: ListingStatus;

  @Prop()
  condition?: string; // e.g., "New", "Like New", "Good", "Fair", "Poor"

  @Prop()
  location?: string; // Pickup location

  @Prop({ type: Types.ObjectId, ref: 'User' })
  buyerId?: Types.ObjectId; // When item is sold/reserved

  @Prop()
  soldAt?: Date;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  favoriteCount: number;

  @Prop({ default: false })
  isNegotiable: boolean;

  @Prop()
  contactPhone?: string;

  @Prop()
  contactEmail?: string;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  reportCount: number;
}

export const MarketplaceListingSchema = SchemaFactory.createForClass(MarketplaceListing);
