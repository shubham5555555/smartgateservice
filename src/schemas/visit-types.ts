import { VisitorType } from './visitor.schema';

export type VisitCategory =
  | 'guest'
  | 'supplier'
  | 'works'
  | 'delivery'
  | 'transit'
  | 'official'
  | 'event'
  | 'staff';

export interface VisitTypeRule {
  type: VisitorType;
  label: string;
  category: VisitCategory;
  description: string;
  /** 'companyOrPerson' | 'company' | 'person' | 'none' */
  host: 'companyOrPerson' | 'company' | 'person' | 'none';
  requiresId: boolean;
  requiresPurpose: boolean;
  /** Default pass validity in hours (single-day types). */
  validityHours: number;
  /** May be issued for a date range (contractors, temporary staff). */
  multiDay: boolean;
  /** Ask for a reference (work order, PO, tracking, audit number). */
  reference?: string;
  /** Ask for crew / group member names. */
  companions: boolean;
  /** Ask for the vehicle number by default. */
  vehicle: boolean;
  /** Courier types may log a parcel at the desk in the same step. */
  parcel: boolean;
  /** Fast-track: shown prominently to guards. */
  vip: boolean;
}

/** Commercial visit catalogue — the single source of truth for every client. */
export const COMMERCIAL_VISIT_TYPES: VisitTypeRule[] = [
  { type: VisitorType.MEETING, label: 'Meeting', category: 'guest', description: 'Business meeting with a tenant company', host: 'companyOrPerson', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: false, companions: false, vehicle: false, parcel: false, vip: false },
  { type: VisitorType.INTERVIEW, label: 'Interview', category: 'guest', description: 'Job interview candidate', host: 'companyOrPerson', requiresId: true, requiresPurpose: false, validityHours: 8, multiDay: false, companions: false, vehicle: false, parcel: false, vip: false },
  { type: VisitorType.CLIENT, label: 'Client', category: 'guest', description: 'Customer / client visit', host: 'companyOrPerson', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: false, companions: false, vehicle: false, parcel: false, vip: false },
  { type: VisitorType.VIP, label: 'VIP', category: 'guest', description: 'Fast-track guest; guards are alerted', host: 'companyOrPerson', requiresId: false, requiresPurpose: false, validityHours: 12, multiDay: false, companions: true, vehicle: true, parcel: false, vip: true },
  { type: VisitorType.VENDOR, label: 'Vendor', category: 'supplier', description: 'Supplier / vendor representative', host: 'company', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: false, reference: 'PO / reference number', companions: false, vehicle: true, parcel: false, vip: false },
  { type: VisitorType.CONTRACTOR, label: 'Contractor', category: 'works', description: 'Works crew on a multi-day pass', host: 'company', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: true, reference: 'Work order / permit number', companions: true, vehicle: true, parcel: false, vip: false },
  { type: VisitorType.MAINTENANCE, label: 'Maintenance / Service', category: 'works', description: 'AMC / repair technician', host: 'company', requiresId: true, requiresPurpose: true, validityHours: 8, multiDay: false, reference: 'Work order / ticket number', companions: true, vehicle: true, parcel: false, vip: false },
  { type: VisitorType.DELIVERY, label: 'Delivery (courier)', category: 'delivery', description: 'Courier / logistics — can leave a parcel at the desk', host: 'company', requiresId: false, requiresPurpose: false, validityHours: 2, multiDay: false, reference: 'Tracking / AWB number', companions: false, vehicle: true, parcel: true, vip: false },
  { type: VisitorType.FOOD_DELIVERY, label: 'Food delivery', category: 'delivery', description: 'Food / grocery hand-over at the desk', host: 'companyOrPerson', requiresId: false, requiresPurpose: false, validityHours: 1, multiDay: false, reference: 'Order number', companions: false, vehicle: false, parcel: true, vip: false },
  { type: VisitorType.CAB, label: 'Cab / Pickup', category: 'transit', description: 'Taxi or pickup waiting at the lobby', host: 'person', requiresId: false, requiresPurpose: false, validityHours: 1, multiDay: false, companions: false, vehicle: true, parcel: false, vip: false },
  { type: VisitorType.INSPECTION, label: 'Inspection / Audit', category: 'official', description: 'Government, fire, safety or financial audit', host: 'company', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: false, reference: 'Audit / notice number', companions: true, vehicle: true, parcel: false, vip: false },
  { type: VisitorType.EVENT, label: 'Event / Group', category: 'event', description: 'Seminar, training or group visit', host: 'company', requiresId: false, requiresPurpose: true, validityHours: 12, multiDay: false, companions: true, vehicle: false, parcel: false, vip: false },
  { type: VisitorType.TEMP_STAFF, label: 'Temporary staff', category: 'staff', description: 'Temp / agency staff without an access card', host: 'company', requiresId: true, requiresPurpose: false, validityHours: 12, multiDay: true, companions: false, vehicle: false, parcel: false, vip: false },
  { type: VisitorType.OTHER, label: 'Other', category: 'guest', description: 'Anything else', host: 'companyOrPerson', requiresId: true, requiresPurpose: true, validityHours: 12, multiDay: false, companions: false, vehicle: false, parcel: false, vip: false },
];

export const RESIDENTIAL_VISIT_TYPES: VisitorType[] = [
  VisitorType.GUEST,
  VisitorType.FAMILY,
  VisitorType.FRIEND,
  VisitorType.DELIVERY,
  VisitorType.FOOD_DELIVERY,
  VisitorType.CAB,
  VisitorType.HOUSE_HELP,
  VisitorType.SERVICE,
  VisitorType.DOCTOR,
  VisitorType.OTHER,
];

export function visitTypeRule(type?: string | null): VisitTypeRule {
  return (
    COMMERCIAL_VISIT_TYPES.find((r) => r.type === type) ||
    COMMERCIAL_VISIT_TYPES[0]
  );
}

/** Catalogue narrowed by the site's allow-list (empty = everything). */
export function allowedVisitTypes(allowed?: string[] | null): VisitTypeRule[] {
  if (!allowed || allowed.length === 0) return COMMERCIAL_VISIT_TYPES;
  const set = new Set(allowed);
  const list = COMMERCIAL_VISIT_TYPES.filter((r) => set.has(r.type));
  return list.length ? list : COMMERCIAL_VISIT_TYPES;
}
