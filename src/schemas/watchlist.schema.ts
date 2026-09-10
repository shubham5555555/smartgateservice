import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WatchlistEntryDocument = WatchlistEntry & Document;

export enum WatchlistKind {
  /** Refuse registration and entry. */
  BLOCK = 'block',
  /** Allow, but warn the guard prominently. */
  WARN = 'warn',
}

/** Per-builder blacklist / watchlist. Matched on phone, ID digits or name. */
@Schema({ timestamps: true })
export class WatchlistEntry {
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  /** Restrict to specific buildings (empty = every building of the builder). */
  @Prop({ type: [Types.ObjectId], ref: 'Building', default: [] })
  buildingIds: Types.ObjectId[];

  @Prop({ enum: WatchlistKind, default: WatchlistKind.WARN, index: true })
  kind: WatchlistKind;

  @Prop({ trim: true })
  name?: string;

  /** Digits only, compared on the trailing 10 digits. */
  @Prop({ index: true })
  phoneNumber?: string;

  @Prop()
  idProofLast4?: string;

  @Prop()
  vehicleNumber?: string;

  @Prop({ required: true })
  reason: string;

  @Prop()
  addedBy?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  expiresAt?: Date;
}

export const WatchlistEntrySchema = SchemaFactory.createForClass(WatchlistEntry);
