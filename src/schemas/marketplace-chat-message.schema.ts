import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketplaceChatMessageDocument = MarketplaceChatMessage & Document;

export enum MarketplaceMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  OFFER = 'offer',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class MarketplaceChatMessage {
  @Prop({ required: true, type: Types.ObjectId, ref: 'MarketplaceChat' })
  chatId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: MarketplaceMessageType, default: MarketplaceMessageType.TEXT })
  type: MarketplaceMessageType;

  @Prop()
  message?: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  offerAmount?: number; // For offer messages

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;
}

export const MarketplaceChatMessageSchema = SchemaFactory.createForClass(MarketplaceChatMessage);
