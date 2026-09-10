import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActorKind,
  ApprovalMode,
  Visitor,
  VisitorDocument,
  VisitorSource,
  VisitorType,
} from '../schemas/visitor.schema';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { SelfRegisterVisitorDto } from './dto/self-register-visitor.dto';
import { VisitorStatus } from '../schemas/visitor.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../schemas/user.schema';
import { VisitPassService } from '../visits/visit-pass.service';
import { PublicVisitsService } from '../visits/public-visits.service';
import { Building, BuildingDocument } from '../schemas/building.schema';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private passService: VisitPassService,
    private publicVisitsService: PublicVisitsService,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) { }

  async createVisitor(userId: string, createDto: CreateVisitorDto) {
    const ctx = await this.passService.contextForUser(userId);

    const visitor = new this.visitorModel({
      ...createDto,
      userId: new Types.ObjectId(userId),
      buildingId: ctx.buildingId,
      buildingName: ctx.buildingName,
      organizationId: ctx.organizationId,
      siteType: ctx.siteType,
      source: createDto.isPreApproved
        ? VisitorSource.INVITE
        : VisitorSource.RESIDENT,
      approvalMode: this.passService.approvalModeFor(
        ctx.settings,
        true,
        !!createDto.isPreApproved,
      ),
      status: createDto.isPreApproved
        ? VisitorStatus.APPROVED
        : VisitorStatus.PENDING,
      expectedDate: createDto.expectedDate
        ? new Date(createDto.expectedDate)
        : undefined,
    });

    if (createDto.isPreApproved) {
      visitor.approvedBy = { kind: ActorKind.RESIDENT, id: userId };
      visitor.approvedAt = new Date();
    }
    await this.passService.issuePass(visitor, ctx.settings);

    return visitor.save();
  }

  async getVisitors(userId: string) {
    return this.visitorModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getTodayVisitors(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.visitorModel
      .find({
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: today, $lt: tomorrow },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Legacy guard/admin route. Same rules as the /admin equivalent. */
  async approveVisitor(visitorId: string, jwtUser?: any) {
    const visitor = await this.visitorModel
      .findById(visitorId)
      .populate('userId');
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    if (visitor.status !== VisitorStatus.PENDING) {
      throw new BadRequestException(`Visitor is already ${visitor.status}`);
    }
    const ctx = visitor.buildingId
      ? await this.passService.contextFromBuildingId(visitor.buildingId)
      : await this.passService.contextForUser(visitor.userId);
    const actor = this.passService.actorFromJwt(jwtUser);
    if (actor.kind === ActorKind.GUARD && !ctx.settings.guardCanApprove) {
      throw new ForbiddenException(
        'Guards cannot approve visitors at this site. The resident must approve.',
      );
    }
    await this.passService.approve(visitor, actor, ctx.settings);

    const savedVisitor = await visitor.save();

    // Send notification to user
    if (this.notificationsService) {
      const userId =
        visitor.userId instanceof Types.ObjectId
          ? visitor.userId.toString()
          : (visitor.userId as any)?._id?.toString() || '';

      this.notificationsService
        .sendNotificationToUser(
          userId,
          'Visitor Approved',
          `${visitor.name} has been approved and is on their way`,
          {
            type: 'visitor',
            visitorId: visitorId,
            action: 'approved',
          },
        )
        .catch((err) => {
          console.error('Failed to send notification:', err);
        });
    }

    return savedVisitor;
  }

  async recordEntry(visitorId: string, jwtUser?: any) {
    const visitor = await this.visitorModel.findById(visitorId);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    const ctx = visitor.buildingId
      ? await this.passService.contextFromBuildingId(visitor.buildingId)
      : await this.passService.contextForUser(visitor.userId);
    this.passService.assertCanEnter(visitor, ctx.settings);
    visitor.status = VisitorStatus.INSIDE;
    visitor.entryTime = new Date();
    visitor.exitTime = undefined;
    visitor.checkOutGate = undefined;
    visitor.autoClosed = false;
    visitor.checkInBy = this.passService.actorFromJwt(jwtUser);
    const saved = await visitor.save();

    if (this.notificationsService && visitor.userId) {
      const uId = String((visitor.userId as any)?._id || visitor.userId);
      this.notificationsService.sendNotificationToUser(
        uId,
        'Visitor Arrived',
        `${visitor.name} has just entered the premises.`,
        { type: 'visitor', visitorId: visitorId, action: 'entry' }
      ).catch(err => console.error('Entry notification failed:', err));
    }

    return saved;
  }

  async recordExit(visitorId: string) {
    const visitor = await this.visitorModel.findById(visitorId);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    if (visitor.status !== VisitorStatus.INSIDE) {
      throw new BadRequestException(
        `Cannot record exit: visitor is ${visitor.status}, not Inside`,
      );
    }
    visitor.status = VisitorStatus.LEFT;
    visitor.exitTime = new Date();
    return visitor.save();
  }

  async getVisitorStatusByPhone(phoneNumber: string) {
    const visitor = await this.visitorModel
      .findOne({ phoneNumber })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName email building flat')
      .lean()
      .exec();

    if (!visitor) {
      throw new NotFoundException('No visitor found with this phone number');
    }

    // Public, keyed only by a phone number: never expose the host resident,
    // the pass token/code, or the record id. The QR is returned only once the
    // visit is approved (it is what the visitor needs to show at the gate).
    const v: any = visitor;
    const approved =
      v.status === VisitorStatus.APPROVED || v.status === VisitorStatus.INSIDE;
    return {
      name: v.name,
      type: v.type,
      status: v.status,
      approvalMode: v.approvalMode,
      phoneNumber: v.phoneNumber,
      buildingName: v.buildingName,
      hostUnit: v.hostUnit,
      hostCompany: v.hostCompany,
      expectedDate: v.expectedDate,
      entryTime: v.entryTime,
      exitTime: v.exitTime,
      expiresAt: v.expiresAt,
      rejectionReason: v.rejectionReason,
      createdAt: v.createdAt,
      qrCode: approved ? v.qrCode : undefined,
    };
  }

  async acceptSelfRegisteredVisitor(visitorId: string, userId: string) {
    const visitor = await this.visitorModel.findById(visitorId).exec();
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    // Verify that the visitor belongs to this user
    const visitorUserId =
      visitor.userId instanceof Types.ObjectId
        ? visitor.userId.toString()
        : (visitor.userId as any)?._id?.toString() || '';

    if (visitorUserId !== userId) {
      throw new BadRequestException(
        'You are not authorized to accept this visitor',
      );
    }

    if (visitor.status !== VisitorStatus.PENDING) {
      throw new BadRequestException(`Visitor is already ${visitor.status}`);
    }

    const ctx = visitor.buildingId
      ? await this.passService.contextFromBuildingId(visitor.buildingId)
      : await this.passService.contextForUser(visitorUserId);
    await this.passService.approve(
      visitor,
      { kind: ActorKind.RESIDENT, id: visitorUserId },
      ctx.settings,
    );

    return visitor.save();
  }

  async rejectSelfRegisteredVisitor(
    visitorId: string,
    userId: string,
    reason?: string,
  ) {
    const visitor = await this.visitorModel.findById(visitorId).exec();
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    // Verify that the visitor belongs to this user
    const visitorUserId =
      visitor.userId instanceof Types.ObjectId
        ? visitor.userId.toString()
        : (visitor.userId as any)?._id?.toString() || '';

    if (visitorUserId !== userId) {
      throw new BadRequestException(
        'You are not authorized to reject this visitor',
      );
    }

    if (visitor.status !== VisitorStatus.PENDING) {
      throw new BadRequestException(`Visitor is already ${visitor.status}`);
    }

    this.passService.reject(
      visitor,
      { kind: ActorKind.RESIDENT, id: visitorUserId },
      reason,
    );
    return visitor.save();
  }

  async selfRegisterVisitor(selfRegisterDto: SelfRegisterVisitorDto) {
    // Building-aware path (generic registration page): commercial buildings
    // need no e-mail — the visit goes to the guard queue; residential ones
    // resolve the host by flat number or e-mail inside that building.
    if (selfRegisterDto.buildingId) {
      const building = await this.buildingModel
        .findOne({ _id: selfRegisterDto.buildingId, isActive: true })
        .exec();
      if (!building) {
        throw new BadRequestException('Building not found');
      }
      return this.publicVisitsService.createForBuilding(
        building,
        {
          name: selfRegisterDto.name,
          phoneNumber: selfRegisterDto.phoneNumber || '',
          type: selfRegisterDto.type,
          purpose: selfRegisterDto.purpose,
          flatNumber: selfRegisterDto.flatNumber,
          block: selfRegisterDto.block,
          residentEmail: selfRegisterDto.residentEmail,
          hostCompany: selfRegisterDto.hostCompany,
          hostPersonName: selfRegisterDto.hostPersonName,
          hostFloor: selfRegisterDto.hostFloor,
          hostUnit: selfRegisterDto.hostUnit,
          vehicleNumber: selfRegisterDto.vehicleNumber,
          guestCount: selfRegisterDto.guestCount,
          expectedDate: selfRegisterDto.expectedDate,
          expectedTime: selfRegisterDto.expectedTime,
          idProofType: selfRegisterDto.idProofType,
          idProofLast4: selfRegisterDto.idProofLast4,
        },
        { viaPoster: false },
      );
    }

    // Legacy path: host resident identified by e-mail only.
    if (!selfRegisterDto.residentEmail) {
      throw new BadRequestException(
        'Pick the building you are visiting, or give the resident\'s e-mail.',
      );
    }
    const resident = await this.userModel
      .findOne({
        normalizedEmail: selfRegisterDto.residentEmail.trim().toLowerCase(),
        isApprovedByAdmin: true, // Only allow visits to approved residents
      })
      .exec();

    if (!resident) {
      throw new BadRequestException(
        'Resident not found or not approved. Please verify the email address.',
      );
    }

    const ctx = await this.passService.contextForUser(resident._id.toString());

    // Parse expected date and time if provided
    let expectedDate: Date | undefined;
    if (selfRegisterDto.expectedDate) {
      expectedDate = new Date(selfRegisterDto.expectedDate);
      if (selfRegisterDto.expectedTime) {
        const [hours, minutes] = selfRegisterDto.expectedTime.split(':');
        expectedDate.setHours(
          parseInt(hours) || 0,
          parseInt(minutes) || 0,
          0,
          0,
        );
      }
    }

    const visitor = new this.visitorModel({
      name: selfRegisterDto.name,
      phoneNumber: selfRegisterDto.phoneNumber,
      type: selfRegisterDto.type || VisitorType.GUEST,
      purpose: selfRegisterDto.purpose,
      userId: resident._id,
      buildingId: ctx.buildingId,
      buildingName: ctx.buildingName,
      organizationId: ctx.organizationId,
      siteType: ctx.siteType,
      source: VisitorSource.GATE_QR,
      approvalMode: this.passService.approvalModeFor(ctx.settings, true, false),
      status: VisitorStatus.PENDING, // Always pending for self-registered visitors
      isPreApproved: false,
      expectedDate: expectedDate,
    });
    await this.passService.issuePass(visitor, ctx.settings);

    const savedVisitor = await visitor.save();
    const view = this.passService.publicView(savedVisitor);

    // Send notification to resident about new visitor request
    if (this.notificationsService) {
      this.notificationsService
        .sendNotificationToUser(
          resident._id.toString(),
          'New Visitor Request',
          `${selfRegisterDto.name} wants to visit you${expectedDate ? ` on ${expectedDate.toLocaleDateString()}` : ''}`,
          {
            type: 'visitor',
            visitorId: savedVisitor._id.toString(),
            action: 'request',
          },
        )
        .catch((err) => {
          console.error('Failed to send notification:', err);
        });
    }

    return { ...view, message: 'Registered. Waiting for the resident to approve your visit.' };
  }
}
