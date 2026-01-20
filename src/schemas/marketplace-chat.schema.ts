import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketplaceChatDocument = MarketplaceChat & Document;

@Schema({ timestamps: true })
export class MarketplaceChat {
  @Prop({ required: true, type: Types.ObjectId, ref: 'MarketplaceListing' })
  listingId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  sellerId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  buyerId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'MarketplaceChatMessage' }], default: [] })
  messages: Types.ObjectId[];

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  lastMessageAt?: Date;
}

export const MarketplaceChatSchema = SchemaFactory.createForClass(MarketplaceChat);

// Create compound index to ensure one chat per listing-buyer pair
MarketplaceChatSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
