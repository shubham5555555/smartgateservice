import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ApprovalMode,
  Visitor,
  VisitorDocument,
  VisitorSource,
  VisitorStatus,
  VisitorType,
} from '../schemas/visitor.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { Organization, OrganizationDocument } from '../schemas/organization.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { SiteSettings, SiteType } from '../schemas/site-settings';
import { NotificationsService } from '../notifications/notifications.service';
import { VisitPassService } from './visit-pass.service';
import { PublicVisitDto } from './dto/public-visit.dto';
import { BuildingsService } from '../buildings/buildings.service';
import { S3Service } from '../common/s3.service';
import { VisitRulesService } from './visit-rules.service';
import { VisitPriority } from '../schemas/visitor.schema';
import { isWithinOperatingHours } from '../schemas/site-settings';

@Injectable()
export class PublicVisitsService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
    private buildingsService: BuildingsService,
    private passService: VisitPassService,
    private s3Service: S3Service,
    private rules: VisitRulesService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) {}

  /** Photo capture only makes sense when there is somewhere to store it. */
  private photoRequired(settings: SiteSettings): boolean {
    return settings.requireVisitorPhoto && this.s3Service.isConfigured;
  }

  /**
   * What the public form should render. Driven entirely by the site, so the
   * same page component works for a society gate and an office lobby.
   */
  async getSiteForm(siteToken: string) {
    const building = await this.buildingsService.findByGateToken(siteToken);
    const ctx = this.passService.contextFromBuilding(building);
    const s = ctx.settings;
    const commercial = ctx.siteType === SiteType.COMMERCIAL;
    const organization = building.organizationId
      ? await this.organizationModel
          .findById(building.organizationId)
          .select('name logo')
          .lean()
          .exec()
      : null;
    // Commercial visits have no host: if the guard may not approve, nobody can.
    const deskClosed = commercial && !s.guardCanApprove;
    const photo = this.photoRequired(s);

    return {
      site: {
        name: building.name,
        address: building.address,
        image: building.image,
        siteType: ctx.siteType,
        unitLabel: (building as any).unitLabel,
      },
      organization: organization
        ? { name: organization.name, logo: organization.logo || null }
        : null,
      enabled: s.allowGateQrSelfRegister && !deskClosed,
      disabledReason: !s.allowGateQrSelfRegister
        ? 'Self-registration is switched off for this site.'
        : deskClosed
          ? 'Visitors at this site are registered by the security desk.'
          : undefined,
      // Who acts on a self-registered visit here (same rule the server applies on create).
      approvalBy:
        commercial || s.guardCanApprove ? 'guard' : 'resident',
      photoUploadAvailable: this.s3Service.isConfigured,
      hostRule: commercial ? 'companyOrPerson' : 'flatOrEmail',
      // Industry rules the form renders from
      visitTypes: this.rules.catalogue(ctx.siteType, s),
      terms: { required: !!s.requireConsent, text: s.termsText || '' },
      operatingHours: s.operatingHours || null,
      afterHoursNow: !isWithinOperatingHours(s.operatingHours || null),
      afterHoursPolicy: s.afterHoursPolicy || 'allow',
      maxPassDays: s.maxPassDays || 30,
      idProofEnforced: !!s.requireIdProof,
      fields: {
        name: { show: true, required: true },
        phoneNumber: { show: true, required: true },
        purpose: { show: true, required: commercial },
        type: {
          show: true,
          required: false,
          options: commercial
            ? [
                VisitorType.MEETING,
                VisitorType.INTERVIEW,
                VisitorType.CLIENT,
                VisitorType.VENDOR,
                VisitorType.CONTRACTOR,
                VisitorType.DELIVERY,
                VisitorType.OTHER,
              ]
            : [
                VisitorType.GUEST,
                VisitorType.FAMILY,
                VisitorType.FRIEND,
                VisitorType.DELIVERY,
                VisitorType.CAB,
                VisitorType.SERVICE,
                VisitorType.OTHER,
              ],
        },
        // residential host identification
        flatNumber: { show: !commercial, required: !commercial },
        block: { show: !commercial, required: false },
        residentEmail: { show: !commercial, required: false },
        // commercial free-text host — company OR person is enough (hostRule)
        hostCompany: { show: commercial, required: false },
        hostPersonName: { show: commercial, required: false },
        hostFloor: { show: commercial, required: false },
        hostUnit: { show: commercial, required: false },
        // extras
        vehicleNumber: { show: s.collectVehicleNumber, required: false },
        guestCount: { show: true, required: false },
        expectedDate: { show: !commercial, required: false },
        expectedTime: { show: !commercial, required: false },
        profilePhoto: {
          show: photo,
          required: photo,
        },
        idProofType: { show: s.requireIdProof, required: s.requireIdProof },
        idProofLast4: { show: s.requireIdProof, required: s.requireIdProof },
      },
    };
  }

  private assertRequired(dto: PublicVisitDto, settings: SiteSettings, commercial: boolean) {
    const missing: string[] = [];
    // Commercial host / purpose / ID requirements come from the visit-type
    // catalogue (VisitRulesService.resolve); only residential + photo here.
    if (!commercial && !dto.flatNumber?.trim() && !dto.residentEmail?.trim()) {
      missing.push('flatNumber or residentEmail');
    }
    if (this.photoRequired(settings) && !dto.profilePhoto) {
      missing.push('profilePhoto');
    }
    if (dto.profilePhoto && !this.s3Service.isOwnUrl(dto.profilePhoto)) {
      throw new BadRequestException(
        'profilePhoto must be the URL returned by the photo upload endpoint',
      );
    }
    if (!commercial && settings.requireIdProof && (!dto.idProofType || !dto.idProofLast4)) {
      missing.push('idProofType, idProofLast4');
    }
    if (missing.length) {
      throw new BadRequestException(`Missing required field(s): ${missing.join(', ')}`);
    }
  }

  /** Residential only: map flat/block (or email) to the host resident. */
  private async findHostResident(
    building: BuildingDocument,
    dto: PublicVisitDto,
  ): Promise<UserDocument | null> {
    // Hosts can only be residents of this building's builder.
    const tenant: any = building.organizationId
      ? { organizationId: building.organizationId }
      : {};
    if (dto.residentEmail?.trim()) {
      const byEmail = await this.userModel
        .findOne({
          ...tenant,
          normalizedEmail: dto.residentEmail.trim().toLowerCase(),
          isApprovedByAdmin: true,
        })
        .exec();
      if (byEmail) return byEmail;
    }

    const flat = dto.flatNumber?.trim();
    if (!flat) return null;

    // Prefer the flat record on the building (it carries residentId).
    for (const floor of building.floors || []) {
      for (const f of floor.flats || []) {
        if (
          f.flatNumber?.toLowerCase() === flat.toLowerCase() &&
          f.residentId
        ) {
          const byFlat = await this.userModel.findById(f.residentId).exec();
          if (byFlat) return byFlat;
        }
      }
    }

    // Fall back to the resident profile fields.
    const nameRegex = new RegExp(
      `^${building.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    );
    const flatRegex = new RegExp(
      `^${flat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    );
    const query: any = {
      ...tenant,
      isApprovedByAdmin: true,
      $and: [
        { $or: [{ buildingId: building._id }, { building: nameRegex }] },
        { $or: [{ flat: flatRegex }, { flatNo: flatRegex }] },
      ],
    };
    if (dto.block?.trim()) query.block = new RegExp(`^${dto.block.trim()}$`, 'i');
    return this.userModel.findOne(query).exec();
  }

  async createVisit(siteToken: string, dto: PublicVisitDto) {
    const building = await this.buildingsService.findByGateToken(siteToken);
    return this.createForBuilding(building, dto, { viaPoster: true });
  }

  /**
   * Shared by the gate-QR poster and the generic registration page. Off the
   * poster there is no photo upload endpoint, so the photo rule is not applied
   * (the desk captures it if the site requires one).
   */
  async createForBuilding(
    building: BuildingDocument,
    dto: PublicVisitDto,
    opts: { viaPoster: boolean } = { viaPoster: true },
  ) {
    const ctx = this.passService.contextFromBuilding(building);
    const commercial = ctx.siteType === SiteType.COMMERCIAL;

    if (!ctx.settings.allowGateQrSelfRegister) {
      throw new BadRequestException(
        'Self-registration is disabled for this site. Please see the security desk.',
      );
    }
    this.assertRequired(
      dto,
      opts.viaPoster ? ctx.settings : { ...ctx.settings, requireVisitorPhoto: false },
      commercial,
    );
    // Type catalogue, per-type required fields, validity window, after-hours, consent.
    const resolved = this.rules.resolve(dto, ctx.siteType, ctx.settings, {
      desk: false,
      idProofEnforced: !!ctx.settings.requireIdProof,
    });
    // Watchlist: a blocked person cannot self-register; a warning travels with the visit.
    const hit = await this.rules.watchlistFor({
      organizationId: ctx.organizationId || null,
      buildingId: ctx.buildingId || null,
      phoneNumber: dto.phoneNumber,
      idProofLast4: dto.idProofLast4,
      vehicleNumber: dto.vehicleNumber,
      name: dto.name,
    });
    if (hit && hit.kind === 'block') {
      throw new BadRequestException(
        'We could not register this visit. Please contact the security desk.',
      );
    }

    let host: UserDocument | null = null;
    if (!commercial) {
      host = await this.findHostResident(building, dto);
      if (!host && !ctx.settings.guardCanApprove) {
        throw new BadRequestException(
          'No resident found for that flat. Please check the flat number or ask the guard for help.',
        );
      }
    }
    if (!this.passService.canBeApproved(ctx.settings, !!host)) {
      throw new BadRequestException(
        'Visitors at this site are registered by the security desk. Please see the guard.',
      );
    }

    let expectedDate: Date | undefined;
    if (dto.expectedDate) {
      expectedDate = new Date(dto.expectedDate);
      if (dto.expectedTime) {
        const [h, m] = dto.expectedTime.split(':');
        expectedDate.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
      }
    }

    const approvalMode = this.passService.approvalModeFor(
      ctx.settings,
      !!host,
      false,
    );

    const visitor = new this.visitorModel({
      name: dto.name.trim(),
      phoneNumber: dto.phoneNumber.trim(),
      type: resolved.type,
      companions: resolved.companions,
      reference: resolved.reference,
      hostPhone: resolved.hostPhone,
      priority: resolved.priority,
      validFrom: resolved.validFrom,
      validUntil: resolved.validUntil,
      afterHours: resolved.afterHours,
      consentAcceptedAt: resolved.consentAcceptedAt,
      watchlistHit: hit ? { kind: hit.kind, reason: hit.reason } : undefined,
      purpose: dto.purpose?.trim(),
      status: VisitorStatus.PENDING,
      approvalMode,
      source: VisitorSource.GATE_QR,
      isPreApproved: false,
      userId: host?._id,
      organizationId: ctx.organizationId,
      buildingId: ctx.buildingId,
      buildingName: ctx.buildingName,
      siteType: ctx.siteType,
      hostCompany: dto.hostCompany?.trim(),
      hostPersonName: dto.hostPersonName?.trim(),
      hostFloor: dto.hostFloor?.trim(),
      hostUnit: dto.hostUnit?.trim() || (!commercial ? dto.flatNumber?.trim() : undefined),
      vehicleNumber: ctx.settings.collectVehicleNumber ? dto.vehicleNumber?.trim() : undefined,
      guestCount: resolved.guestCount,
      expectedDate,
      profilePhoto: dto.profilePhoto,
      idProofType: dto.idProofType,
      idProofLast4: dto.idProofLast4,
    });

    // A pass token exists from the start so the visitor has a status link even
    // while the visit is still pending; the QR only renders once approved.
    await this.passService.issuePass(visitor, ctx.settings);
    const saved = await visitor.save();

    this.notifyPending(saved, host).catch((err) =>
      console.error('Gate QR notification failed:', err),
    );

    return {
      ...this.passService.publicView(saved),
      message:
        approvalMode === ApprovalMode.GUARD
          ? resolved.afterHours
            ? 'Registered outside operating hours. Please see the security desk — the guard will decide on your entry.'
            : 'Registered. Please show this screen at the security desk — the guard will approve your entry.'
          : 'Registered. Waiting for the resident to approve your visit.',
    };
  }

  private async notifyPending(visitor: VisitorDocument, host: UserDocument | null) {
    if (!this.notificationsService) return;
    const where = visitor.buildingName ? ` at ${visitor.buildingName}` : '';

    if (visitor.approvalMode === ApprovalMode.RESIDENT && host) {
      await this.notificationsService.sendNotificationToUser(
        host._id.toString(),
        'New Visitor Request',
        `${visitor.name} is at the gate and wants to visit you`,
        {
          type: 'visitor',
          visitorId: visitor._id.toString(),
          action: 'request',
        },
      );
      return;
    }

    if (visitor.approvalMode === ApprovalMode.GUARD) {
      const who =
        visitor.hostCompany || visitor.hostPersonName || 'the building';
      const flags = [
        visitor.priority === VisitPriority.VIP ? 'VIP' : '',
        visitor.afterHours ? 'after hours' : '',
        visitor.watchlistHit ? 'WATCHLIST' : '',
      ].filter(Boolean);
      await this.notificationsService.sendNotificationToAllGuards(
        flags.length ? `Visitor Awaiting Approval (${flags.join(', ')})` : 'Visitor Awaiting Approval',
        `${visitor.name} registered${where} to meet ${who}`,
        {
          type: 'visitor',
          visitorId: visitor._id.toString(),
          action: 'guard_approval',
        },
        visitor.organizationId,
        visitor.buildingId,
      );
    }
  }

  async getVisitByPassToken(passToken: string) {
    const visitor = await this.passService.findByPassToken(passToken);
    if (!visitor) {
      throw new NotFoundException('Pass not found');
    }
    return this.passService.publicView(visitor);
  }
}
