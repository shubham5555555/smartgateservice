import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as crypto from 'crypto';
import { SiteType } from './site-settings';

export type VisitorDocument = Visitor & Document;

export enum VisitorType {
  GUEST = 'Guest',
  FAMILY = 'Family',
  FRIEND = 'Friend',
  DELIVERY = 'Delivery',
  CAB = 'Cab/Taxi',
  HOUSE_HELP = 'House Help',
  SERVICE = 'Service',
  DOCTOR = 'Doctor',
  SPOUSE = 'Spouse',
  STAFF = 'Staff',
  // Commercial-oriented purposes
  MEETING = 'Meeting',
  INTERVIEW = 'Interview',
  VENDOR = 'Vendor',
  CLIENT = 'Client',
  CONTRACTOR = 'Contractor',
  MAINTENANCE = 'Maintenance',
  FOOD_DELIVERY = 'Food Delivery',
  INSPECTION = 'Inspection',
  EVENT = 'Event',
  TEMP_STAFF = 'Temporary Staff',
  VIP = 'VIP',
  OTHER = 'Other',
}

export enum VisitPriority {
  NORMAL = 'normal',
  VIP = 'vip',
}

export interface Companion {
  name: string;
  phoneNumber?: string;
  idProofLast4?: string;
}

export enum VisitorStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  INSIDE = 'Inside',
  LEFT = 'Left',
}

/**
 * Who has to act on a Pending visitor. Kept separate from `status` so that
 * every existing status filter in the apps keeps working unchanged.
 */
export enum ApprovalMode {
  RESIDENT = 'resident',
  GUARD = 'guard',
  NONE = 'none',
}

export enum VisitorSource {
  RESIDENT = 'resident',
  GUARD = 'guard',
  ADMIN = 'admin',
  GATE_QR = 'gate_qr',
  INVITE = 'invite',
}

export enum ActorKind {
  RESIDENT = 'resident',
  GUARD = 'guard',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export interface Actor {
  kind: ActorKind;
  id?: string;
  name?: string;
}

const ActorProp = {
  type: { kind: String, id: String, name: String },
  _id: false,
};

/** Unguessable token used as the QR v2 payload and the public pass link. */
export function generatePassToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

/** Short human-typeable fallback the guard can key in when the camera fails. */
export function generatePassCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I
  return Array.from(
    crypto.randomBytes(6),
    (b) => alphabet[b % alphabet.length],
  ).join('');
}

@Schema({ timestamps: true })
export class Visitor {
  /** Host resident. Optional: commercial visits are guard-approved, hostless. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', index: true })
  buildingId?: Types.ObjectId;

  /** Denormalised — residents store their building as a plain name string. */
  @Prop()
  buildingName?: string;

  @Prop({ enum: SiteType, default: SiteType.RESIDENTIAL })
  siteType?: SiteType;

  @Prop({ required: true })
  name: string;

  @Prop()
  profilePhoto?: string;

  @Prop({ enum: VisitorType, required: true })
  type: VisitorType;

  @Prop({ enum: VisitorStatus, default: VisitorStatus.PENDING })
  status: VisitorStatus;

  @Prop({ enum: ApprovalMode, default: ApprovalMode.RESIDENT })
  approvalMode: ApprovalMode;

  @Prop({ enum: VisitorSource, default: VisitorSource.RESIDENT })
  source: VisitorSource;

  @Prop()
  phoneNumber?: string;

  @Prop()
  entryTime?: Date;

  @Prop()
  exitTime?: Date;

  @Prop({ default: false })
  isPreApproved: boolean;

  @Prop()
  expectedDate?: Date;

  @Prop()
  purpose?: string;

  @Prop()
  vehicleNumber?: string;

  @Prop({ default: 1 })
  guestCount?: number;

  // ---- Industry fields (commercial) ----
  /** Crew / group members accompanying the visitor. */
  @Prop({ type: [{ name: String, phoneNumber: String, idProofLast4: String, _id: false }], default: [] })
  companions?: Companion[];

  /** Work order / PO / tracking / audit number. */
  @Prop({ index: true })
  reference?: string;

  /** Phone of the person being visited (no host account in commercial). */
  @Prop()
  hostPhone?: string;

  @Prop({ enum: VisitPriority, default: VisitPriority.NORMAL })
  priority?: VisitPriority;

  /** Multi-day passes: entry allowed any day inside this window. */
  @Prop()
  validFrom?: Date;

  @Prop()
  validUntil?: Date;

  /** Registered outside the site's operating hours. */
  @Prop({ default: false })
  afterHours?: boolean;

  /** Visitor accepted the site's terms / NDA. */
  @Prop()
  consentAcceptedAt?: Date;

  /** Guards were alerted about an overstay (once per visit). */
  @Prop()
  overstayNotifiedAt?: Date;

  /** Watchlist match at registration / entry (kind: warn|block). */
  @Prop({ type: { kind: String, reason: String, _id: false } })
  watchlistHit?: { kind: string; reason?: string };

  /** Parcel logged by a courier visit at the desk. */
  @Prop({ type: Types.ObjectId, ref: 'Parcel' })
  parcelId?: Types.ObjectId;

  // ---- Commercial "whom to meet": free text, no company/employee records ----
  @Prop()
  hostCompany?: string;

  @Prop()
  hostPersonName?: string;

  @Prop()
  hostFloor?: string;

  @Prop()
  hostUnit?: string;

  // ---- Pass ----
  @Prop()
  qrCode?: string; // legacy v1 payload, still written for older clients

  @Prop({ unique: true, sparse: true })
  passToken?: string;

  @Prop({ index: true })
  passCode?: string;

  @Prop()
  expiresAt?: Date;

  // ---- ID capture (commercial) ----
  @Prop()
  idProofType?: string;

  @Prop()
  idProofLast4?: string;

  @Prop()
  idProofPhoto?: string;

  // ---- Audit ----
  @Prop(ActorProp)
  approvedBy?: Actor;

  @Prop()
  approvedAt?: Date;

  @Prop()
  rejectionReason?: string;

  @Prop(ActorProp)
  checkInBy?: Actor;

  @Prop()
  checkInGate?: string;

  @Prop()
  checkOutGate?: string;

  @Prop({ default: false })
  autoClosed?: boolean;
}

export const VisitorSchema = SchemaFactory.createForClass(Visitor);

// Index phoneNumber for fast public lookup
VisitorSchema.index({ phoneNumber: 1 });
// Site-scoped listings (guard queues, admin filters)
VisitorSchema.index({ buildingId: 1, status: 1, createdAt: -1 });
// Guard approval queue
VisitorSchema.index({ status: 1, approvalMode: 1 });
