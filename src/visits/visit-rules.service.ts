import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Companion,
  VisitPriority,
  Visitor,
  VisitorDocument,
  VisitorStatus,
  VisitorType,
} from '../schemas/visitor.schema';
import {
  SiteSettings,
  SiteType,
  isWithinOperatingHours,
} from '../schemas/site-settings';
import {
  COMMERCIAL_VISIT_TYPES,
  RESIDENTIAL_VISIT_TYPES,
  VisitTypeRule,
  allowedVisitTypes,
  visitTypeRule,
} from '../schemas/visit-types';
import { WatchlistHit, WatchlistService } from '../watchlist/watchlist.service';

export interface VisitInput {
  type?: string;
  purpose?: string;
  hostCompany?: string;
  hostPersonName?: string;
  hostPhone?: string;
  idProofType?: string;
  idProofLast4?: string;
  reference?: string;
  vehicleNumber?: string;
  companions?: Companion[];
  guestCount?: number;
  validFrom?: string;
  validUntil?: string;
  consentAccepted?: boolean;
  priority?: string;
  phoneNumber?: string;
  name?: string;
}

export interface ResolvedVisit {
  type: VisitorType;
  rule: VisitTypeRule | null;
  companions: Companion[];
  guestCount: number;
  validFrom?: Date;
  validUntil?: Date;
  afterHours: boolean;
  priority: VisitPriority;
  consentAcceptedAt?: Date;
  reference?: string;
  hostPhone?: string;
}

/**
 * Everything a commercial visit must satisfy, in one place: the type
 * catalogue, per-type required fields, multi-day windows, operating hours,
 * consent, watchlist and capacity. Residential visits pass through mostly
 * untouched (their rules are the resident's approval).
 */
@Injectable()
export class VisitRulesService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    private watchlist: WatchlistService,
  ) {}

  catalogue(siteType: SiteType, settings: SiteSettings) {
    if (siteType !== SiteType.COMMERCIAL) return null;
    return allowedVisitTypes(settings.allowedVisitTypes);
  }

  /** Validate + normalise a commercial visit. `desk` relaxes nothing but reports differently. */
  resolve(
    input: VisitInput,
    siteType: SiteType,
    settings: SiteSettings,
    opts: { desk: boolean; idProofEnforced: boolean },
  ): ResolvedVisit {
    const companions = (input.companions || [])
      .filter((c) => c && c.name && c.name.trim())
      .map((c) => ({ name: c.name.trim(), phoneNumber: c.phoneNumber, idProofLast4: c.idProofLast4 }));
    const guestCount = Math.max(1, input.guestCount || 1, companions.length + 1);
    const afterHours = !isWithinOperatingHours(settings.operatingHours || null);

    if (siteType !== SiteType.COMMERCIAL) {
      const type = (RESIDENTIAL_VISIT_TYPES as string[]).includes(input.type || '')
        ? (input.type as VisitorType)
        : VisitorType.GUEST;
      return {
        type,
        rule: null,
        companions,
        guestCount,
        afterHours,
        priority: VisitPriority.NORMAL,
        reference: input.reference?.trim() || undefined,
        hostPhone: input.hostPhone?.trim() || undefined,
      };
    }

    // ---- commercial ----
    const catalogue = allowedVisitTypes(settings.allowedVisitTypes);
    const rule =
      catalogue.find((r) => r.type === input.type) ||
      (input.type ? null : catalogue.find((r) => r.type === VisitorType.MEETING) || catalogue[0]);
    if (!rule) {
      throw new BadRequestException(
        `"${input.type}" visits are not accepted at this site. Choose one of: ${catalogue.map((r) => r.label).join(', ')}.`,
      );
    }

    const missing: string[] = [];
    const company = input.hostCompany?.trim();
    const person = input.hostPersonName?.trim();
    if (rule.host === 'companyOrPerson' && !company && !person) missing.push('company or person being visited');
    if (rule.host === 'company' && !company) missing.push('company being visited');
    if (rule.host === 'person' && !person && !company) missing.push('person being visited');
    if (rule.requiresPurpose && !input.purpose?.trim()) missing.push('purpose of visit');
    if (opts.idProofEnforced && rule.requiresId && (!input.idProofType || !input.idProofLast4)) {
      missing.push('ID type and last digits');
    }
    if (settings.requireConsent && !input.consentAccepted) {
      missing.push('acceptance of the site terms');
    }
    if (missing.length) {
      throw new BadRequestException(`Missing: ${missing.join('; ')}.`);
    }

    // After hours
    if (afterHours && settings.afterHoursPolicy === 'block' && !opts.desk) {
      throw new BadRequestException(
        'This site does not accept self-registration outside operating hours. Please contact the security desk.',
      );
    }

    // Validity window
    let validFrom: Date | undefined;
    let validUntil: Date | undefined;
    if (rule.multiDay && (input.validFrom || input.validUntil)) {
      const from = input.validFrom ? new Date(input.validFrom) : new Date();
      const until = input.validUntil ? new Date(input.validUntil) : new Date(from);
      if (isNaN(from.getTime()) || isNaN(until.getTime())) {
        throw new BadRequestException('Invalid pass dates');
      }
      from.setHours(0, 0, 0, 0);
      until.setHours(23, 59, 59, 999);
      const days = Math.round((until.getTime() - from.getTime()) / 86_400_000) + 1;
      const maxDays = settings.maxPassDays || 30;
      if (days < 1) throw new BadRequestException('The pass must end on or after the day it starts');
      if (days > maxDays) throw new BadRequestException(`A pass can cover at most ${maxDays} days at this site`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (until.getTime() < today.getTime()) throw new BadRequestException('The pass end date is in the past');
      validFrom = from;
      validUntil = until;
    }

    const priority = rule.vip || input.priority === 'vip' ? VisitPriority.VIP : VisitPriority.NORMAL;

    return {
      type: rule.type,
      rule,
      companions,
      guestCount,
      validFrom,
      validUntil,
      afterHours,
      priority,
      consentAcceptedAt: input.consentAccepted ? new Date() : undefined,
      reference: input.reference?.trim() || undefined,
      hostPhone: input.hostPhone?.trim() || undefined,
    };
  }

  /** Watchlist lookup for a visitor; `null` when clean. */
  watchlistFor(input: {
    organizationId?: Types.ObjectId | null;
    buildingId?: Types.ObjectId | null;
    phoneNumber?: string;
    idProofLast4?: string;
    vehicleNumber?: string;
    name?: string;
  }): Promise<WatchlistHit | null> {
    return this.watchlist.match(input);
  }

  /** People currently inside a building (group sizes counted). */
  async occupancy(buildingId?: Types.ObjectId | null): Promise<number> {
    if (!buildingId) return 0;
    const rows = await this.visitorModel
      .find({ buildingId, status: VisitorStatus.INSIDE })
      .select('guestCount')
      .lean()
      .exec();
    return rows.reduce((n, r: any) => n + Math.max(1, r.guestCount || 1), 0);
  }

  /** Refuse entry when the site's capacity would be exceeded. */
  async assertCapacity(settings: SiteSettings, buildingId: Types.ObjectId | null | undefined, incoming: number) {
    if (!settings.maxInside || !buildingId) return;
    const inside = await this.occupancy(buildingId);
    if (inside + Math.max(1, incoming) > settings.maxInside) {
      throw new ForbiddenException(
        `Capacity reached: ${inside} of ${settings.maxInside} people are inside. Wait for someone to leave.`,
      );
    }
  }

  /** Entry allowed on this calendar day for a multi-day pass. */
  assertWithinWindow(visitor: VisitorDocument) {
    const now = Date.now();
    if (visitor.validFrom && visitor.validFrom.getTime() > now) {
      throw new BadRequestException(
        `This pass is valid from ${visitor.validFrom.toLocaleDateString('en-IN')}.`,
      );
    }
    if (visitor.validUntil && visitor.validUntil.getTime() < now) {
      throw new BadRequestException('This pass has expired.');
    }
  }

  static readonly ALL_COMMERCIAL_TYPES = COMMERCIAL_VISIT_TYPES;
  static rule = visitTypeRule;
}
