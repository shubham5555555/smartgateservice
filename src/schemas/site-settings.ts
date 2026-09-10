import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A site is a Building. Residential sites are gated by the resident (host)
 * approving each visitor; commercial sites are gated by the guard, who takes
 * the visitor's details at the desk and approves on the spot.
 */
export enum SiteType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
}

@Schema({ _id: false })
export class SiteSettings {
  /** Guard may approve a pending visitor without the host. */
  @Prop({ default: false })
  guardCanApprove: boolean;

  /** A pending visitor must be accepted by the resident/host before entry. */
  @Prop({ default: true })
  requireHostApproval: boolean;

  @Prop({ default: false })
  requireVisitorPhoto: boolean;

  @Prop({ default: false })
  requireIdProof: boolean;

  @Prop({ default: true })
  collectVehicleNumber: boolean;

  /** Whether the printed gate QR opens a working self-registration form. */
  @Prop({ default: true })
  allowGateQrSelfRegister: boolean;

  /** How long an approved pass stays usable. */
  @Prop({ default: 24 })
  passValidityHours: number;

  /** Auto-mark still-inside visitors as Left after this many hours (null = never). */
  @Prop({ default: null, type: Number })
  autoCheckoutHours?: number | null;

  // ---- Industry rules (mainly commercial) ----
  /** Subset of the visit-type catalogue offered at this site (empty = all). */
  @Prop({ type: [String], default: [] })
  allowedVisitTypes?: string[];

  /** Operating hours; days 0 (Sun) … 6 (Sat). null = always open. */
  @Prop({ type: { open: String, close: String, days: [Number], _id: false }, default: null })
  operatingHours?: { open: string; close: string; days: number[] } | null;

  /** What happens to a self-registration outside operating hours. */
  @Prop({ default: 'allow' })
  afterHoursPolicy?: 'allow' | 'guard_approval' | 'block';

  /** Maximum people inside at once (null = unlimited). */
  @Prop({ default: null, type: Number })
  maxInside?: number | null;

  /** Visitor must accept the site's terms / NDA before registering. */
  @Prop({ default: false })
  requireConsent?: boolean;

  @Prop({ default: '' })
  termsText?: string;

  /** Cap for multi-day passes. */
  @Prop({ default: 30 })
  maxPassDays?: number;

  /** Push to guards when a visitor is inside past their pass validity. */
  @Prop({ default: true })
  notifyOverstay?: boolean;
}

export const SiteSettingsSchema = SchemaFactory.createForClass(SiteSettings);

export function defaultSiteSettings(siteType: SiteType): SiteSettings {
  if (siteType === SiteType.COMMERCIAL) {
    return {
      guardCanApprove: true,
      requireHostApproval: false,
      requireVisitorPhoto: true,
      requireIdProof: true,
      collectVehicleNumber: true,
      allowGateQrSelfRegister: true,
      passValidityHours: 12,
      autoCheckoutHours: 12,
      allowedVisitTypes: [],
      operatingHours: null,
      afterHoursPolicy: 'guard_approval',
      maxInside: null,
      requireConsent: false,
      termsText: '',
      maxPassDays: 30,
      notifyOverstay: true,
    };
  }
  return {
    guardCanApprove: false,
    requireHostApproval: true,
    requireVisitorPhoto: false,
    requireIdProof: false,
    collectVehicleNumber: true,
    allowGateQrSelfRegister: true,
    passValidityHours: 24,
    autoCheckoutHours: null,
    allowedVisitTypes: [],
    operatingHours: null,
    afterHoursPolicy: 'allow',
    maxInside: null,
    requireConsent: false,
    termsText: '',
    maxPassDays: 30,
    notifyOverstay: false,
  };
}

/** True when `at` falls inside the site's operating hours (or no hours are set). */
export function isWithinOperatingHours(
  hours: SiteSettings['operatingHours'],
  at: Date = new Date(),
): boolean {
  if (!hours || !hours.open || !hours.close) return true;
  if (Array.isArray(hours.days) && hours.days.length && !hours.days.includes(at.getDay())) {
    return false;
  }
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map((x) => parseInt(x, 10) || 0);
    return h * 60 + m;
  };
  const now = at.getHours() * 60 + at.getMinutes();
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  // Overnight windows (e.g. 20:00 → 06:00) wrap around midnight.
  return open <= close ? now >= open && now < close : now >= open || now < close;
}

/**
 * Mongoose sub-documents expose their fields through prototype getters, so a
 * plain spread (`{ ...building.settings }`) copies only internal bookkeeping
 * and none of the flags. Always go through `toObject()` first.
 */
export function toPlainSettings(
  settings?: Partial<SiteSettings> | null,
): Partial<SiteSettings> {
  if (!settings) return {};
  const anySettings = settings as any;
  const plain =
    typeof anySettings.toObject === 'function'
      ? anySettings.toObject()
      : settings;
  // Drop undefined values so they do not shadow the defaults.
  return Object.fromEntries(
    Object.entries(plain).filter(
      ([key, value]) => value !== undefined && !key.startsWith('$') && key !== '_id',
    ),
  ) as Partial<SiteSettings>;
}

/** Merge a partial override onto the defaults for the given site type. */
export function resolveSiteSettings(
  siteType: SiteType,
  overrides?: Partial<SiteSettings> | null,
): SiteSettings {
  const settings = { ...defaultSiteSettings(siteType), ...toPlainSettings(overrides) };
  if (siteType === SiteType.COMMERCIAL) {
    // A commercial visit has no host resident: the guard is the approver,
    // always. These two flags cannot be turned off for a commercial site.
    settings.guardCanApprove = true;
    settings.requireHostApproval = false;
  }
  return settings;
}

/** Infer a site type from the legacy free-text `Building.type` label. */
export function inferSiteType(buildingType?: string): SiteType {
  return /commercial|office|business|corporate|retail|mall/i.test(
    buildingType || '',
  )
    ? SiteType.COMMERCIAL
    : SiteType.RESIDENTIAL;
}
