import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import {
  AttendanceEvent,
  AttendanceEventDocument,
  AttendanceStatus,
  attendanceDay,
} from '../schemas/attendance-event.schema';
import { Actor } from '../schemas/visitor.schema';
import { inferSiteType, resolveSiteSettings } from '../schemas/site-settings';
import { VisitRulesService } from '../visits/visit-rules.service';
import { EMPLOYEE_PASS_KIND } from './company.service';

export interface EmployeePassCard {
  kind: 'employee';
  employee: {
    id: string;
    name?: string;
    photo?: string;
    phoneNumber?: string;
    employeeCode?: string;
    designation?: string;
    companyId: string;
    companyName?: string;
    buildingId?: string;
    buildingName?: string;
    floor?: string;
    unit?: string;
    passCode?: string;
  };
  isValid: boolean;
  reason?: string;
  status: 'Inside' | 'Outside';
  entryTime?: Date;
  exitTime?: Date;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

/**
 * The gate's view of an employee pass: resolve it, let the person in, let them
 * out again. Deliberately separate from `CompanyService` because the caller
 * here is a guard, not a company member — different scope, different rules.
 */
@Injectable()
export class EmployeeAccessService {
  private readonly logger = new Logger(EmployeeAccessService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(AttendanceEvent.name)
    private attendanceModel: Model<AttendanceEventDocument>,
    private visitRules: VisitRulesService,
  ) {}

  /** True when a scanned QR payload belongs to an employee, not a visitor. */
  static isEmployeePayload(parsed: any): boolean {
    return !!parsed && parsed.k === EMPLOYEE_PASS_KIND;
  }

  /** Resolve a pass token, or the 6-character fallback code. */
  async findByToken(token: string): Promise<UserDocument | null> {
    if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
    return this.userModel.findOne({ passToken: token }).exec();
  }

  async findByCode(code: string): Promise<UserDocument | null> {
    const c = (code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(c)) return null;
    return this.userModel.findOne({ passCode: c }).exec();
  }

  /** The card the guard app shows after a scan. */
  async card(user: UserDocument): Promise<EmployeePassCard> {
    const company = user.companyId
      ? await this.companyModel.findById(user.companyId).exec()
      : null;
    const today = await this.attendanceModel
      .findOne({ userId: user._id, date: attendanceDay() })
      .exec();
    const open = today?.status === AttendanceStatus.INSIDE;

    let reason: string | undefined;
    if (user.isActive === false) reason = 'This account has been deactivated.';
    else if (user.passRevokedAt) reason = 'This pass has been revoked.';
    else if (!user.passToken) reason = 'No pass has been issued.';
    else if (company && company.isActive === false) {
      reason = `${company.name} is no longer active at this site.`;
    }
    const isValid = !reason;

    return {
      kind: 'employee',
      employee: {
        id: String(user._id),
        name: user.fullName,
        photo: user.profilePhoto,
        phoneNumber: user.phoneNumber,
        employeeCode: user.employeeCode,
        designation: user.designation,
        companyId: String(user.companyId),
        companyName: company?.name,
        buildingId: user.buildingId ? String(user.buildingId) : undefined,
        buildingName: company?.buildingName || user.building,
        floor: user.workFloor || company?.floor,
        unit: user.workUnit || (company?.units || [])[0],
        passCode: user.passCode,
      },
      isValid,
      reason,
      status: open ? 'Inside' : 'Outside',
      entryTime: today?.entryTime,
      exitTime: today?.exitTime,
      canCheckIn: isValid && !open,
      canCheckOut: isValid && open,
    };
  }

  private async assertUsable(user: UserDocument) {
    if (user.isActive === false) {
      throw new ForbiddenException(
        'This account has been deactivated — entry refused.',
      );
    }
    if (user.passRevokedAt) {
      throw new ForbiddenException('This pass has been revoked — entry refused.');
    }
    if (!user.passToken) {
      throw new BadRequestException('This employee has no pass issued.');
    }
    if (user.companyId) {
      const company = await this.companyModel.findById(user.companyId).exec();
      if (company && company.isActive === false) {
        throw new ForbiddenException(
          `${company.name} is no longer active at this site.`,
        );
      }
    }
  }

  private async employee(userId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Employee not found');
    }
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.companyId) throw new NotFoundException('Employee not found');
    return user;
  }

  /**
   * Record an employee entering. One attendance row per person per day: a
   * second entry after they stepped out re-opens the same row (lunch break),
   * exactly like visitor re-entry on a live pass.
   */
  async checkIn(userId: string, actor: Actor, gate?: string) {
    const user = await this.employee(userId);
    await this.assertUsable(user);

    const today = await this.attendanceModel
      .findOne({ userId: user._id, date: attendanceDay() })
      .exec();
    if (today?.status === AttendanceStatus.INSIDE) {
      throw new BadRequestException(`${user.fullName} is already inside.`);
    }

    // Employees count toward the site's capacity the same as visitors do.
    if (user.buildingId) {
      const building = await this.buildingModel.findById(user.buildingId).exec();
      if (building) {
        const settings = resolveSiteSettings(
          building.siteType || inferSiteType(building.type),
          building.settings,
        );
        await this.visitRules.assertCapacity(settings, building._id as Types.ObjectId, 1);
      }
    }

    const company = user.companyId
      ? await this.companyModel.findById(user.companyId).exec()
      : null;

    const row =
      today ||
      new this.attendanceModel({
        organizationId: user.organizationId,
        buildingId: user.buildingId,
        companyId: user.companyId,
        userId: user._id,
        userName: user.fullName,
        companyName: company?.name,
        date: attendanceDay(),
      });
    row.status = AttendanceStatus.INSIDE;
    row.entryTime = row.entryTime || new Date();
    row.exitTime = undefined;
    row.autoClosed = false;
    row.checkInBy = actor;
    if (gate) row.entryGate = gate;
    await row.save();

    return { ...(await this.card(user)), attendanceId: String(row._id) };
  }

  async checkOut(userId: string, actor: Actor, gate?: string) {
    const user = await this.employee(userId);
    const row = await this.attendanceModel
      .findOne({ userId: user._id, status: AttendanceStatus.INSIDE })
      .sort({ date: -1 })
      .exec();
    if (!row) {
      throw new BadRequestException(`${user.fullName} is not marked inside.`);
    }
    row.status = AttendanceStatus.LEFT;
    row.exitTime = new Date();
    row.checkOutBy = actor;
    row.autoClosed = false;
    if (gate) row.exitGate = gate;
    await row.save();
    return { ...(await this.card(user)), attendanceId: String(row._id) };
  }

  /** Employees currently in a building — the other half of the roll-call. */
  async insideBuilding(buildingId?: string) {
    const query: any = { status: AttendanceStatus.INSIDE };
    if (buildingId && Types.ObjectId.isValid(buildingId)) {
      query.buildingId = new Types.ObjectId(buildingId);
    }
    const rows = await this.attendanceModel
      .find(query)
      .sort({ entryTime: -1 })
      .limit(500)
      .exec();
    return rows.map((r) => ({
      id: String(r._id),
      userId: String(r.userId),
      name: r.userName,
      companyId: String(r.companyId),
      companyName: r.companyName,
      buildingId: r.buildingId ? String(r.buildingId) : undefined,
      entryTime: r.entryTime,
      entryGate: r.entryGate,
    }));
  }

  /**
   * Nobody scans out at the end of the day, so close yesterday's rows on the
   * site's own auto-checkout setting — the same treatment stale visitors get.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCloseStaleAttendance() {
    const buildings = await this.buildingModel
      .find({ isActive: true })
      .select('_id siteType type settings')
      .exec();

    let closed = 0;
    for (const building of buildings) {
      const settings = resolveSiteSettings(
        building.siteType || inferSiteType(building.type),
        building.settings,
      );
      const hours = settings.autoCheckoutHours;
      if (!hours || hours <= 0) continue;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const result = await this.attendanceModel.updateMany(
        {
          buildingId: building._id,
          status: AttendanceStatus.INSIDE,
          $or: [
            { entryTime: { $lt: cutoff } },
            { entryTime: null, updatedAt: { $lt: cutoff } },
          ],
        },
        {
          $set: {
            status: AttendanceStatus.LEFT,
            exitTime: new Date(),
            autoClosed: true,
          },
        },
      );
      closed += result.modifiedCount || 0;
    }
    if (closed > 0) {
      this.logger.log(`Auto-checked-out ${closed} stale employee day(s)`);
    }
  }
}
