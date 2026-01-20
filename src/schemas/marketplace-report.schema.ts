import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketplaceReportDocument = MarketplaceReport & Document;

export enum ReportReason {
  SPAM = 'Spam',
  FAKE = 'Fake Listing',
  INAPPROPRIATE = 'Inappropriate Content',
  WRONG_CATEGORY = 'Wrong Category',
  DUPLICATE = 'Duplicate Listing',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class MarketplaceReport {
  @Prop({ required: true, type: Types.ObjectId, ref: 'MarketplaceListing' })
  listingId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reportedBy: Types.ObjectId;

  @Prop({ required: true, enum: ReportReason })
  reason: ReportReason;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isResolved: boolean;
}

export const MarketplaceReportSchema = SchemaFactory.createForClass(MarketplaceReport);
