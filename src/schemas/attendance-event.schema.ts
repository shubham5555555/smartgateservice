import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { Actor } from './visitor.schema';
import { ActorProp } from './visitor.schema';

export type AttendanceEventDocument = AttendanceEvent & Document;

export enum AttendanceStatus {
  INSIDE = 'Inside',
  LEFT = 'Left',
}

/** Midnight of the day a timestamp falls in — one attendance row per person per day. */
export function attendanceDay(at: Date = new Date()): Date {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * One employee's presence in the building for one day. The company equivalent
 * of `StaffActivity`, written by the guard app when an employee pass is
 * scanned in or out.
 */
@Schema({ timestamps: true })
export class AttendanceEvent {
  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** Denormalised so the guard and the export never need a join. */
  @Prop()
  userName?: string;

  @Prop()
  companyName?: string;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop()
  entryTime?: Date;

  @Prop()
  exitTime?: Date;

  @Prop()
  entryGate?: string;

  @Prop()
  exitGate?: string;

  @Prop(ActorProp)
  checkInBy?: Actor;

  @Prop(ActorProp)
  checkOutBy?: Actor;

  @Prop({ enum: AttendanceStatus, default: AttendanceStatus.INSIDE, index: true })
  status: AttendanceStatus;

  /** Closed by the nightly job rather than by a scan on the way out. */
  @Prop({ default: false })
  autoClosed: boolean;
}

export const AttendanceEventSchema =
  SchemaFactory.createForClass(AttendanceEvent);

// One row per person per day; also the lookup the check-in path uses.
AttendanceEventSchema.index({ userId: 1, date: -1 }, { unique: true });
AttendanceEventSchema.index({ companyId: 1, date: -1 });
AttendanceEventSchema.index({ buildingId: 1, status: 1 });
