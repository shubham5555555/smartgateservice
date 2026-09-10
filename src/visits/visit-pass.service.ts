import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Actor,
  ActorKind,
  ApprovalMode,
  Visitor,
  VisitorDocument,
  VisitorStatus,
  generatePassCode,
  generatePassToken,
} from '../schemas/visitor.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  SiteSettings,
  SiteType,
  inferSiteType,
  resolveSiteSettings,
} from '../schemas/site-settings';
import { visitTypeRule } from '../schemas/visit-types';

export interface SiteContext {
  organizationId?: Types.ObjectId;
  buildingId?: Types.ObjectId;
  buildingName?: string;
  siteType: SiteType;
  settings: SiteSettings;
}

/**
 * Everything that is shared between the three ways a visit can be created:
 * the resident app, the guard app, and the public gate-QR form.
 */
@Injectable()
export class VisitPassService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Default residential context, used when no building can be resolved. */
  private residentialFallback(): SiteContext {
    return {
      siteType: SiteType.RESIDENTIAL,
      settings: resolveSiteSettings(SiteType.RESIDENTIAL),
    };
  }

  contextFromBuilding(building: BuildingDocument): SiteContext {
    const siteType = building.siteType || inferSiteType(building.type);
    return {
      organizationId: building.organizationId as Types.ObjectId | undefined,
      buildingId: building._id as Types.ObjectId,
      buildingName: building.name,
      siteType,
      settings: resolveSiteSettings(siteType, building.settings),
    };
  }

  async contextFromBuildingId(buildingId?: string | Types.ObjectId | null) {
    if (!buildingId || !Types.ObjectId.isValid(String(buildingId))) {
      return this.residentialFallback();
    }
    const building = await this.buildingModel.findById(buildingId).exec();
    return building
      ? this.contextFromBuilding(building)
      : this.residentialFallback();
  }

  /** Residents store their building as a plain name string on the profile. */
  async contextFromBuildingName(
    name?: string,
    organizationId?: Types.ObjectId | null,
  ): Promise<SiteContext> {
    if (!name) return this.residentialFallback();
    const orgFilter = organizationId ? { organizationId } : {};
    const building =
      (await this.buildingModel
        .findOne({ ...orgFilter, normalizedName: name.toLowerCase() })
        .exec()) ||
      (await this.buildingModel
        .findOne({
          ...orgFilter,
          name: new RegExp(
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i',
          ),
        })
        .exec());
    return building
      ? this.contextFromBuilding(building)
      : { ...this.residentialFallback(), buildingName: name };
  }

  async contextForUser(userId?: string | Types.ObjectId | null) {
    if (!userId) return this.residentialFallback();
    const user = await this.userModel.findById(userId).exec();
    if (!user) return this.residentialFallback();
    // Resolved reference first; name string (scoped to the resident's builder) as fallback.
    if (user.buildingId) {
      const ctx = await this.contextFromBuildingId(user.buildingId);
      if (ctx.buildingId) return ctx;
    }
    return this.contextFromBuildingName(user.building, user.organizationId || null);
  }

  /** False when nobody could ever approve this visit (commercial site, no host, guard approval off). */
  canBeApproved(settings: SiteSettings, hasHost: boolean): boolean {
    return hasHost || settings.guardCanApprove;
  }

  /** Who must act on this visit, given the site's rules. */
  approvalModeFor(
    settings: SiteSettings,
    hasHost: boolean,
    preApproved = false,
  ): ApprovalMode {
    if (preApproved) return ApprovalMode.NONE;
    if (settings.requireHostApproval && hasHost) return ApprovalMode.RESIDENT;
    if (settings.guardCanApprove) return ApprovalMode.GUARD;
    return hasHost ? ApprovalMode.RESIDENT : ApprovalMode.GUARD;
  }

  /**
   * Stamp the pass fields on a visitor. `qrCode` keeps the legacy v1 payload so
   * that older resident/guard builds still render and verify a scannable code.
   */
  /** Statuses for which a pass code / token must still resolve at the desk. */
  static readonly LIVE_STATUSES = [
    VisitorStatus.PENDING,
    VisitorStatus.APPROVED,
    VisitorStatus.INSIDE,
  ];

  /** A 6-char code that no other live pass at the same site uses. */
  private async uniquePassCode(visitor: VisitorDocument): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generatePassCode();
      const clash = await this.visitorModel
        .exists({
          passCode: code,
          status: { $in: VisitPassService.LIVE_STATUSES },
          ...(visitor.buildingId ? { buildingId: visitor.buildingId } : {}),
          _id: { $ne: visitor._id },
        })
        .exec();
      if (!clash) return code;
    }
    return generatePassCode();
  }

  async issuePass(visitor: VisitorDocument, settings: SiteSettings): Promise<VisitorDocument> {
    if (!visitor.passToken) visitor.passToken = generatePassToken();
    if (!visitor.passCode) visitor.passCode = await this.uniquePassCode(visitor);
    const rule = visitor.siteType === SiteType.COMMERCIAL ? visitTypeRule(visitor.type) : null;
    const hours = rule?.validityHours && rule.validityHours < (settings.passValidityHours || 24)
      ? rule.validityHours
      : settings.passValidityHours || 24;
    const from =
      visitor.approvedAt || (visitor as any).createdAt || new Date();
    // Multi-day passes expire at the end of their window; others after N hours.
    visitor.expiresAt = visitor.validUntil
      ? new Date(visitor.validUntil)
      : new Date(new Date(from).getTime() + hours * 60 * 60 * 1000);
    // No host/user ids in a payload handed to an unauthenticated visitor.
    visitor.qrCode = JSON.stringify({
      v: 2,
      t: visitor.passToken,
      visitorId: visitor._id.toString(),
      timestamp: new Date(from).getTime(),
    });
    return visitor;
  }

  /** Mark a visit approved and attribute it. Only a Pending visit can be approved. */
  async approve(
    visitor: VisitorDocument,
    actor: Actor,
    settings: SiteSettings,
  ): Promise<VisitorDocument> {
    visitor.status = VisitorStatus.APPROVED;
    visitor.approvalMode = ApprovalMode.NONE;
    visitor.approvedBy = actor;
    visitor.approvedAt = new Date();
    visitor.rejectionReason = undefined;
    return this.issuePass(visitor, settings);
  }

  reject(
    visitor: VisitorDocument,
    actor: Actor,
    reason?: string,
  ): VisitorDocument {
    visitor.status = VisitorStatus.REJECTED;
    visitor.approvalMode = ApprovalMode.NONE;
    visitor.approvedBy = actor;
    visitor.approvedAt = new Date();
    if (reason) visitor.rejectionReason = reason;
    return visitor;
  }

  /**
   * State machine for entry. Approved → Inside; a visitor who Left may re-enter
   * on the same unexpired pass (lunch break); anything else is refused.
   */
  assertCanEnter(visitor: VisitorDocument, settings: SiteSettings): void {
    if (visitor.status === VisitorStatus.INSIDE) {
      throw new BadRequestException('Visitor is already inside.');
    }
    if (visitor.status === VisitorStatus.REJECTED) {
      throw new BadRequestException('Cannot record entry. This visit was rejected.');
    }
    if (visitor.status === VisitorStatus.PENDING) {
      throw new BadRequestException(
        visitor.approvalMode === ApprovalMode.GUARD
          ? 'Approve this visitor before recording entry.'
          : 'Cannot record entry. The resident has not approved this visit yet.',
      );
    }
    if (this.isExpired(visitor, settings)) {
      throw new BadRequestException(
        `Cannot record entry. This visitor pass has expired (valid for ${settings.passValidityHours} hours).`,
      );
    }
  }

  isExpired(visitor: VisitorDocument, settings?: SiteSettings): boolean {
    if (visitor.expiresAt) return visitor.expiresAt.getTime() < Date.now();
    // Pre-dual-mode passes have no expiresAt: fall back to the old 24h rule.
    const created = (visitor as any).createdAt;
    if (!created) return false;
    const hours = settings?.passValidityHours || 24;
    return Date.now() - new Date(created).getTime() > hours * 60 * 60 * 1000;
  }

  actorFromJwt(user: any): Actor {
    if (!user) return { kind: ActorKind.SYSTEM };
    if (user.role === 'guard' || user.guardId) {
      return {
        kind: ActorKind.GUARD,
        id: user.userId,
        name: user.guardId || user.phoneNumber,
      };
    }
    if (
      user.role === 'admin' ||
      user.userId === 'admin' ||
      user.role === 'super_admin' ||
      user.role === 'builder_admin' ||
      user.role === 'building_manager'
    ) {
      return {
        kind: ActorKind.ADMIN,
        id: user.userId || 'admin',
        name: user.name || user.email || 'Admin',
      };
    }
    return { kind: ActorKind.RESIDENT, id: user.userId, name: user.email };
  }

  /** The only visit shape ever returned to an unauthenticated caller. */
  publicView(visitor: VisitorDocument) {
    return {
      passToken: visitor.passToken,
      passCode: visitor.passCode,
      name: visitor.name,
      type: visitor.type,
      status: visitor.status,
      approvalMode: visitor.approvalMode,
      siteType: visitor.siteType,
      buildingName: visitor.buildingName,
      organizationId: visitor.organizationId ? String(visitor.organizationId) : undefined,
      hostCompany: visitor.hostCompany,
      hostPersonName: visitor.hostPersonName,
      hostFloor: visitor.hostFloor,
      hostUnit: visitor.hostUnit,
      purpose: visitor.purpose,
      expectedDate: visitor.expectedDate,
      entryTime: visitor.entryTime,
      exitTime: visitor.exitTime,
      expiresAt: visitor.expiresAt,
      validFrom: visitor.validFrom,
      validUntil: visitor.validUntil,
      priority: visitor.priority,
      afterHours: visitor.afterHours,
      reference: visitor.reference,
      companions: (visitor.companions || []).map((c) => ({ name: c.name })),
      guestCount: visitor.guestCount,
      rejectionReason: visitor.rejectionReason,
      // Only an approved pass carries a scannable code.
      qrPayload:
        visitor.status === VisitorStatus.APPROVED ||
        visitor.status === VisitorStatus.INSIDE
          ? visitor.qrCode
          : null,
    };
  }

  async findByPassToken(passToken: string) {
    return this.visitorModel.findOne({ passToken }).exec();
  }

  /** Live passes only: an old, closed visit must never shadow a current one. */
  async findByPassCode(passCode: string) {
    return this.visitorModel
      .findOne({
        passCode: passCode.toUpperCase(),
        status: { $in: VisitPassService.LIVE_STATUSES },
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}
