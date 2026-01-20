import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketplaceFavoriteDocument = MarketplaceFavorite & Document;

@Schema({ timestamps: true })
export class MarketplaceFavorite {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'MarketplaceListing' })
  listingId: Types.ObjectId;
}

export const MarketplaceFavoriteSchema = SchemaFactory.createForClass(MarketplaceFavorite);

// Create compound index to prevent duplicates
MarketplaceFavoriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });
