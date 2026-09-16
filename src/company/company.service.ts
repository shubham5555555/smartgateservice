import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  AccountType,
  Company,
  CompanyDocument,
  CompanyRole,
  companyLocation,
} from '../schemas/company.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import {
  AttendanceEvent,
  AttendanceEventDocument,
  AttendanceStatus,
  attendanceDay,
} from '../schemas/attendance-event.schema';
import {
  Actor,
  ActorKind,
  ApprovalMode,
  Visitor,
  VisitorDocument,
  VisitorSource,
  VisitorStatus,
  generatePassCode,
  generatePassToken,
} from '../schemas/visitor.schema';
import { SiteType } from '../schemas/site-settings';
import { VisitPassService } from '../visits/visit-pass.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantContext } from '../tenancy/tenant-context';

/** What an employee pass QR carries. `k` is what tells it from a visitor pass. */
export const EMPLOYEE_PASS_KIND = 'emp';

export interface CompanyPrincipal {
  userId: string;
  companyId: Types.ObjectId;
  companyRole: CompanyRole;
}

/**
 * Everything an office tenant does: its team, their gate passes, their
 * attendance and the visitors they host.
 *
 * Company isolation is enforced by the tenant plugin (every query on a
 * `companyId` collection is confined to the caller's company). The explicit
 * checks here are the *role* rules on top of that — who may create whom.
 */
@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(AttendanceEvent.name)
    private attendanceModel: Model<AttendanceEventDocument>,
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    private passService: VisitPassService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- helpers

  /** The signed-in company member, refused if the token carries no company. */
  async principal(jwtUser: any): Promise<CompanyPrincipal> {
    const companyId = jwtUser?.companyId;
    const companyRole = jwtUser?.companyRole;
    if (!companyId || !Types.ObjectId.isValid(String(companyId)) || !companyRole) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }
    return {
      userId: String(jwtUser.userId),
      companyId: new Types.ObjectId(String(companyId)),
      companyRole: companyRole as CompanyRole,
    };
  }

  private isManager(role: CompanyRole): boolean {
    return role === CompanyRole.BOSS || role === CompanyRole.HR;
  }

  private assertManager(p: CompanyPrincipal) {
    if (!this.isManager(p.companyRole)) {
      throw new ForbiddenException(
        'Only the company owner or HR can manage the team.',
      );
    }
  }

  async requireCompany(companyId: Types.ObjectId): Promise<CompanyDocument> {
    const company = await this.companyModel.findById(companyId).exec();
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  /** The fields every client needs about a member. Never the password hash. */
  memberView(user: UserDocument | any) {
    return {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePhoto: user.profilePhoto,
      companyRole: user.companyRole,
      employeeCode: user.employeeCode,
      designation: user.designation,
      department: user.department,
      workFloor: user.workFloor,
      workUnit: user.workUnit,
      isActive: user.isActive !== false,
      hasLogin: !!user.password,
      mustChangePassword: !!user.mustChangePassword,
      pass: user.passToken
        ? {
            passCode: user.passCode,
            issuedAt: user.passIssuedAt,
            revokedAt: user.passRevokedAt,
            active: !user.passRevokedAt && user.isActive !== false,
          }
        : null,
      createdAt: user.createdAt,
    };
  }

  companyView(company: CompanyDocument | any) {
    return {
      id: String(company._id),
      name: company.name,
      buildingId: company.buildingId ? String(company.buildingId) : undefined,
      buildingName: company.buildingName,
      floor: company.floor,
      units: company.units || [],
      logo: company.logo,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      gstNumber: company.gstNumber,
      settings: company.settings,
      isActive: company.isActive !== false,
      createdAt: company.createdAt,
    };
  }

  // ------------------------------------------------------- company creation

  /**
   * Create an office tenant. Admin-side: the building must be a commercial
   * site, because a residential visit is approved by its host resident and has
   * nowhere to put a company.
   */
  async createCompany(
    data: {
      name: string;
      buildingId: string;
      floor?: string;
      units?: string[];
      contactEmail?: string;
      contactPhone?: string;
      gstNumber?: string;
      logo?: string;
      employeeLimit?: number | null;
      allowEmployeeInvites?: boolean;
      invitesNeedDesk?: boolean;
    },
    actorLabel?: string,
  ) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('Company name is required');
    }
    if (!data.buildingId || !Types.ObjectId.isValid(data.buildingId)) {
      throw new BadRequestException('Pick the building this company sits in');
    }
    const building = await this.buildingModel.findById(data.buildingId).exec();
    if (!building) throw new NotFoundException('Building not found');
    if (building.siteType !== SiteType.COMMERCIAL) {
      throw new BadRequestException(
        `"${building.name}" is a residential site. Companies can only be added to commercial sites — change the site mode first.`,
      );
    }

    const normalized = data.name.trim().toLowerCase();
    const clash = await this.companyModel
      .exists({ buildingId: building._id, normalizedName: normalized })
      .exec();
    if (clash) {
      throw new BadRequestException(
        `"${data.name.trim()}" already exists in ${building.name}.`,
      );
    }

    const company = new this.companyModel({
      name: data.name.trim(),
      buildingId: building._id,
      buildingName: building.name,
      organizationId: building.organizationId,
      floor: data.floor,
      units: (data.units || []).filter(Boolean),
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      gstNumber: data.gstNumber,
      logo: data.logo,
      settings: {
        allowEmployeeInvites: data.allowEmployeeInvites !== false,
        invitesNeedDesk: !!data.invitesNeedDesk,
        employeeLimit: data.employeeLimit ?? null,
      },
      createdBy: actorLabel,
    });
    return this.companyView(await company.save());
  }

  async listCompanies(filter: { buildingId?: string; search?: string } = {}) {
    const query: any = {};
    if (filter.buildingId && Types.ObjectId.isValid(filter.buildingId)) {
      query.buildingId = new Types.ObjectId(filter.buildingId);
    }
    if (filter.search?.trim()) {
      query.normalizedName = { $regex: this.escape(filter.search.trim().toLowerCase()) };
    }
    const companies = await this.companyModel
      .find(query)
      .sort({ name: 1 })
      .limit(500)
      .exec();

    // Counts in one pass rather than a query per company.
    const ids = companies.map((c) => c._id);
    const [members, inside] = await Promise.all([
      this.userModel.aggregate([
        { $match: { companyId: { $in: ids } } },
        { $group: { _id: { companyId: '$companyId', role: '$companyRole' }, n: { $sum: 1 } } },
      ]),
      this.attendanceModel.aggregate([
        { $match: { companyId: { $in: ids }, status: AttendanceStatus.INSIDE } },
        { $group: { _id: '$companyId', n: { $sum: 1 } } },
      ]),
    ]);

    const byCompany = new Map<string, any>();
    for (const row of members) {
      const key = String(row._id.companyId);
      const entry = byCompany.get(key) || { employees: 0, hr: 0, boss: 0 };
      if (row._id.role === CompanyRole.EMPLOYEE) entry.employees += row.n;
      else if (row._id.role === CompanyRole.HR) entry.hr += row.n;
      else if (row._id.role === CompanyRole.BOSS) entry.boss += row.n;
      byCompany.set(key, entry);
    }
    const insideBy = new Map(inside.map((r: any) => [String(r._id), r.n]));

    return companies.map((c) => ({
      ...this.companyView(c),
      counts: {
        ...(byCompany.get(String(c._id)) || { employees: 0, hr: 0, boss: 0 }),
        inside: insideBy.get(String(c._id)) || 0,
      },
    }));
  }

  async getCompany(id: string) {
    const company = await this.companyModel.findById(id).exec();
    if (!company) throw new NotFoundException('Company not found');
    const members = await this.userModel
      .find({ companyId: company._id })
      .sort({ companyRole: 1, fullName: 1 })
      .exec();
    return {
      ...this.companyView(company),
      members: members.map((m) => this.memberView(m)),
    };
  }

  async updateCompany(id: string, data: any) {
    const company = await this.companyModel.findById(id).exec();
    if (!company) throw new NotFoundException('Company not found');
    for (const f of [
      'name',
      'floor',
      'units',
      'logo',
      'contactEmail',
      'contactPhone',
      'gstNumber',
      'isActive',
    ]) {
      if (data[f] !== undefined) (company as any)[f] = data[f];
    }
    if (data.settings) {
      company.settings = { ...company.settings, ...data.settings };
    }
    return this.companyView(await company.save());
  }

  /** Deactivate; only a company nobody belongs to can be removed outright. */
  async deleteCompany(id: string) {
    const company = await this.companyModel.findById(id).exec();
    if (!company) throw new NotFoundException('Company not found');
    const members = await this.userModel.countDocuments({ companyId: company._id }).exec();
    if (members > 0) {
      company.isActive = false;
      await company.save();
      return {
        deleted: false,
        deactivated: true,
        message: `${company.name} has ${members} account(s) and was deactivated instead of deleted.`,
      };
    }
    await this.companyModel.deleteOne({ _id: company._id }).exec();
    return { deleted: true, deactivated: false, message: `${company.name} removed.` };
  }

  // -------------------------------------------------------------- the team

  /**
   * Create a member. `by` is the acting principal for app-side calls (HR/boss)
   * and null for an admin creating the first boss/HR from the dashboard.
   */
  async createMember(
    companyId: Types.ObjectId,
    data: {
      fullName: string;
      email?: string;
      phoneNumber?: string;
      password?: string;
      companyRole: CompanyRole;
      employeeCode?: string;
      designation?: string;
      department?: string;
      workFloor?: string;
      workUnit?: string;
      issuePass?: boolean;
    },
    by: CompanyPrincipal | null,
  ) {
    const company = await this.requireCompany(companyId);
    const role = data.companyRole;
    if (!Object.values(CompanyRole).includes(role)) {
      throw new BadRequestException('Role must be boss, hr or employee');
    }
    if (by) {
      this.assertManager(by);
      // HR runs the team; only the owner appoints another owner or HR.
      if (role !== CompanyRole.EMPLOYEE && by.companyRole !== CompanyRole.BOSS) {
        throw new ForbiddenException(
          'Only the company owner can create an owner or HR account.',
        );
      }
    }
    if (!data.fullName?.trim()) {
      throw new BadRequestException('Name is required');
    }

    const email = data.email?.trim().toLowerCase();
    if (email) {
      // Email uniqueness is global, so this question has to be asked outside
      // the caller's company filter — otherwise the clash only surfaces as a
      // duplicate-key crash on save.
      const taken = await TenantContext.runUnscoped(() =>
        this.userModel
          .findOne({ $or: [{ email }, { normalizedEmail: email }] })
          .select('_id')
          .exec(),
      );
      if (taken) {
        throw new BadRequestException(
          'That email already has an account. Use a different one.',
        );
      }
    }
    if (data.password && !email) {
      throw new BadRequestException(
        'An email is required to set a login password.',
      );
    }

    if (
      role === CompanyRole.EMPLOYEE &&
      company.settings?.employeeLimit != null
    ) {
      const current = await this.userModel
        .countDocuments({ companyId: company._id, companyRole: CompanyRole.EMPLOYEE })
        .exec();
      if (current >= company.settings.employeeLimit) {
        throw new BadRequestException(
          `${company.name} is limited to ${company.settings.employeeLimit} employees.`,
        );
      }
    }

    const loc = companyLocation(company);
    const user = new this.userModel({
      fullName: data.fullName.trim(),
      email,
      normalizedEmail: email,
      phoneNumber: data.phoneNumber?.trim(),
      password: data.password ? await bcrypt.hash(data.password, 10) : undefined,
      mustChangePassword: !!data.password,
      accountType: AccountType.COMPANY,
      companyId: company._id,
      companyRole: role,
      employeeCode: data.employeeCode,
      designation: data.designation,
      department: data.department,
      workFloor: data.workFloor || loc.floor,
      workUnit: data.workUnit || loc.unit,
      // Inherit the site so tenant-scoped queries and the gate can find them.
      organizationId: company.organizationId,
      buildingId: company.buildingId,
      building: company.buildingName,
      parentUserId: by?.userId,
      isActive: true,
      isProfileComplete: true,
      isApprovedByAdmin: true,
      isEmailVerified: !!email,
    });

    if (data.issuePass !== false) await this.attachPass(user);
    try {
      await user.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException(
          'That email already has an account. Use a different one.',
        );
      }
      throw err;
    }
    return this.memberView(user);
  }

  async listMembers(
    companyId: Types.ObjectId,
    filter: { search?: string; role?: string; status?: string } = {},
  ) {
    const query: any = { companyId };
    if (filter.role) query.companyRole = filter.role;
    if (filter.status === 'active') query.isActive = { $ne: false };
    if (filter.status === 'inactive') query.isActive = false;
    if (filter.search?.trim()) {
      const rx = new RegExp(this.escape(filter.search.trim()), 'i');
      query.$or = [
        { fullName: rx },
        { email: rx },
        { phoneNumber: rx },
        { employeeCode: rx },
        { designation: rx },
      ];
    }
    const members = await this.userModel
      .find(query)
      .sort({ isActive: -1, fullName: 1 })
      .limit(1000)
      .exec();
    return members.map((m) => this.memberView(m));
  }

  /** One member of *this* company; anything else is a 404, never a 403 leak. */
  private async memberOf(
    companyId: Types.ObjectId,
    userId: string,
  ): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Employee not found');
    }
    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), companyId })
      .exec();
    if (!user) throw new NotFoundException('Employee not found');
    return user;
  }

  async getMember(companyId: Types.ObjectId, userId: string) {
    return this.memberView(await this.memberOf(companyId, userId));
  }

  async updateMember(
    companyId: Types.ObjectId,
    userId: string,
    data: any,
    by: CompanyPrincipal | null,
  ) {
    if (by) this.assertManager(by);
    const user = await this.memberOf(companyId, userId);
    if (
      by &&
      user.companyRole !== CompanyRole.EMPLOYEE &&
      by.companyRole !== CompanyRole.BOSS
    ) {
      throw new ForbiddenException(
        'Only the company owner can change an owner or HR account.',
      );
    }
    for (const f of [
      'fullName',
      'phoneNumber',
      'employeeCode',
      'designation',
      'department',
      'workFloor',
      'workUnit',
      'profilePhoto',
    ]) {
      if (data[f] !== undefined) (user as any)[f] = data[f];
    }
    if (data.companyRole && (!by || by.companyRole === CompanyRole.BOSS)) {
      if (!Object.values(CompanyRole).includes(data.companyRole)) {
        throw new BadRequestException('Role must be boss, hr or employee');
      }
      user.companyRole = data.companyRole;
    }
    await user.save();
    return this.memberView(user);
  }

  async setMemberPassword(
    companyId: Types.ObjectId,
    userId: string,
    email: string | undefined,
    password: string,
    by: CompanyPrincipal | null,
  ) {
    if (by) this.assertManager(by);
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const user = await this.memberOf(companyId, userId);
    if (
      by &&
      user.companyRole !== CompanyRole.EMPLOYEE &&
      by.companyRole !== CompanyRole.BOSS
    ) {
      throw new ForbiddenException(
        'Only the company owner can reset an owner or HR password.',
      );
    }
    const wanted = email?.trim().toLowerCase();
    if (wanted && wanted !== user.email) {
      const taken = await this.userModel
        .findOne({ email: wanted, _id: { $ne: user._id } })
        .select('_id')
        .exec();
      if (taken) throw new BadRequestException('That email is already in use.');
      user.email = wanted;
      user.normalizedEmail = wanted;
      user.isEmailVerified = true;
    }
    if (!user.email) {
      throw new BadRequestException(
        'Give this employee a login email before setting a password.',
      );
    }
    user.password = await bcrypt.hash(password, 10);
    user.mustChangePassword = true;
    await user.save();
    return { message: `Login updated for ${user.fullName}`, email: user.email };
  }

  /**
   * Deactivate: revoke the pass and close any open attendance row in the same
   * step, so a leaver cannot re-enter and is not left "inside" forever.
   */
  async deactivateMember(
    companyId: Types.ObjectId,
    userId: string,
    by: CompanyPrincipal | null,
  ) {
    if (by) this.assertManager(by);
    const user = await this.memberOf(companyId, userId);
    if (by && String(user._id) === by.userId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    if (
      by &&
      user.companyRole !== CompanyRole.EMPLOYEE &&
      by.companyRole !== CompanyRole.BOSS
    ) {
      throw new ForbiddenException(
        'Only the company owner can deactivate an owner or HR account.',
      );
    }
    if (user.companyRole === CompanyRole.BOSS) {
      const otherBosses = await this.userModel
        .countDocuments({
          companyId,
          companyRole: CompanyRole.BOSS,
          isActive: { $ne: false },
          _id: { $ne: user._id },
        })
        .exec();
      if (otherBosses === 0) {
        throw new BadRequestException(
          'This is the only owner account — appoint another owner first.',
        );
      }
    }

    user.isActive = false;
    user.passRevokedAt = new Date();
    await user.save();
    await this.closeOpenAttendance(user, { kind: ActorKind.SYSTEM }, true);
    return { message: `${user.fullName} deactivated`, id: String(user._id) };
  }

  async reactivateMember(companyId: Types.ObjectId, userId: string, by: CompanyPrincipal | null) {
    if (by) this.assertManager(by);
    const user = await this.memberOf(companyId, userId);
    user.isActive = true;
    user.passRevokedAt = undefined;
    if (!user.passToken) await this.attachPass(user);
    await user.save();
    return this.memberView(user);
  }

  // ------------------------------------------------------------- the pass

  /** Give a member an unexpiring gate pass with a site-unique short code. */
  private async attachPass(user: UserDocument) {
    if (!user.passToken) user.passToken = generatePassToken();
    if (!user.passCode) user.passCode = await this.uniquePassCode(user);
    user.passIssuedAt = new Date();
    user.passRevokedAt = undefined;
  }

  /**
   * A short code no other live pass at the same building uses — checked
   * against both employee passes and visitor passes, because the guard types
   * one code into one box.
   */
  private async uniquePassCode(user: UserDocument): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generatePassCode();
      // The guard types one code into one box, so it has to be unique across
      // employee passes *and* live visitor passes — a question that must be
      // asked outside the caller's company scope.
      const [userClash, visitClash] = await TenantContext.runUnscoped(() =>
        Promise.all([
          this.userModel.exists({ passCode: code, _id: { $ne: user._id } }).exec(),
          this.visitorModel
            .exists({
              passCode: code,
              status: { $in: VisitPassService.LIVE_STATUSES },
              ...(user.buildingId ? { buildingId: user.buildingId } : {}),
            })
            .exec(),
        ]),
      );
      if (!userClash && !visitClash) return code;
    }
    return generatePassCode();
  }

  /** The payload printed into the employee's QR. `k` marks it as an employee. */
  passPayload(user: UserDocument | any): string {
    return JSON.stringify({
      v: 2,
      k: EMPLOYEE_PASS_KIND,
      t: user.passToken,
      userId: String(user._id),
    });
  }

  async myPass(p: CompanyPrincipal) {
    const user = await this.memberOf(p.companyId, p.userId);
    if (!user.passToken || user.passRevokedAt || user.isActive === false) {
      return {
        active: false,
        reason:
          user.isActive === false
            ? 'Your account has been deactivated.'
            : user.passRevokedAt
              ? 'Your pass was revoked. Ask HR to issue a new one.'
              : 'No pass has been issued yet. Ask HR to issue one.',
      };
    }
    const company = await this.requireCompany(p.companyId);
    const today = await this.attendanceModel
      .findOne({ userId: user._id, date: attendanceDay() })
      .exec();
    return {
      active: true,
      passCode: user.passCode,
      qrPayload: this.passPayload(user),
      issuedAt: user.passIssuedAt,
      name: user.fullName,
      photo: user.profilePhoto,
      companyName: company.name,
      buildingName: company.buildingName,
      floor: user.workFloor || company.floor,
      unit: user.workUnit,
      status: today?.status === AttendanceStatus.INSIDE ? 'Inside' : 'Outside',
      entryTime: today?.entryTime,
      exitTime: today?.exitTime,
    };
  }

  async issuePass(companyId: Types.ObjectId, userId: string, by: CompanyPrincipal | null) {
    if (by) this.assertManager(by);
    const user = await this.memberOf(companyId, userId);
    if (user.isActive === false) {
      throw new BadRequestException(
        'Reactivate this account before issuing a pass.',
      );
    }
    // A reissue mints a new token so a leaked QR stops working.
    user.passToken = generatePassToken();
    user.passCode = await this.uniquePassCode(user);
    user.passIssuedAt = new Date();
    user.passRevokedAt = undefined;
    await user.save();
    return this.memberView(user);
  }

  async revokePass(companyId: Types.ObjectId, userId: string, by: CompanyPrincipal | null) {
    if (by) this.assertManager(by);
    const user = await this.memberOf(companyId, userId);
    user.passRevokedAt = new Date();
    await user.save();
    await this.closeOpenAttendance(user, { kind: ActorKind.SYSTEM }, true);
    return this.memberView(user);
  }

  // ----------------------------------------------------------- attendance

  private async closeOpenAttendance(
    user: UserDocument,
    actor: Actor,
    autoClosed = false,
    gate?: string,
  ) {
    const open = await this.attendanceModel
      .findOne({ userId: user._id, status: AttendanceStatus.INSIDE })
      .exec();
    if (!open) return null;
    open.status = AttendanceStatus.LEFT;
    open.exitTime = new Date();
    open.checkOutBy = actor;
    open.autoClosed = autoClosed;
    if (gate) open.exitGate = gate;
    return open.save();
  }

  async attendance(
    companyId: Types.ObjectId,
    filter: { userId?: string; from?: string; to?: string; status?: string },
  ) {
    const query: any = { companyId };
    if (filter.userId && Types.ObjectId.isValid(filter.userId)) {
      query.userId = new Types.ObjectId(filter.userId);
    }
    if (filter.status) query.status = filter.status;
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = attendanceDay(new Date(filter.from));
      if (filter.to) query.date.$lte = attendanceDay(new Date(filter.to));
    }
    const rows = await this.attendanceModel
      .find(query)
      .sort({ date: -1, entryTime: -1 })
      .limit(1000)
      .exec();
    return rows.map((r) => ({
      id: String(r._id),
      userId: String(r.userId),
      userName: r.userName,
      date: r.date,
      entryTime: r.entryTime,
      exitTime: r.exitTime,
      entryGate: r.entryGate,
      exitGate: r.exitGate,
      status: r.status,
      autoClosed: r.autoClosed,
    }));
  }

  /** Who from this company is in the building right now. */
  async insideNow(companyId: Types.ObjectId) {
    const rows = await this.attendanceModel
      .find({ companyId, status: AttendanceStatus.INSIDE })
      .sort({ entryTime: -1 })
      .exec();
    return rows.map((r) => ({
      userId: String(r.userId),
      userName: r.userName,
      entryTime: r.entryTime,
      entryGate: r.entryGate,
    }));
  }

  // ------------------------------------------------------------- overview

  /** Drives which shell the user app renders, and what it shows on Home. */
  async me(jwtUser: any) {
    const p = await this.principal(jwtUser);
    const [company, user] = await Promise.all([
      this.requireCompany(p.companyId),
      this.memberOf(p.companyId, p.userId),
    ]);
    const manager = this.isManager(p.companyRole);
    const [employees, inside, pass] = await Promise.all([
      manager
        ? this.userModel.countDocuments({ companyId: p.companyId, isActive: { $ne: false } }).exec()
        : Promise.resolve(0),
      manager
        ? this.attendanceModel
            .countDocuments({ companyId: p.companyId, status: AttendanceStatus.INSIDE })
            .exec()
        : Promise.resolve(0),
      this.myPass(p),
    ]);
    return {
      company: this.companyView(company),
      me: this.memberView(user),
      permissions: {
        manageTeam: manager,
        manageManagers: p.companyRole === CompanyRole.BOSS,
        inviteVisitors:
          company.settings?.allowEmployeeInvites !== false ||
          manager,
      },
      counts: { employees, inside },
      pass,
    };
  }

  // -------------------------------------------------------------- visitors

  /**
   * An employee invites a guest. The commercial mirror of a resident
   * pre-approval: the host vouches for the visitor, so the pass is live unless
   * the company insists every guest is cleared at the desk.
   */
  async inviteVisitor(jwtUser: any, dto: any) {
    const p = await this.principal(jwtUser);
    const [company, host] = await Promise.all([
      this.requireCompany(p.companyId),
      this.memberOf(p.companyId, p.userId),
    ]);
    if (
      company.settings?.allowEmployeeInvites === false &&
      !this.isManager(p.companyRole)
    ) {
      throw new ForbiddenException(
        `${company.name} has turned off visitor invites for employees.`,
      );
    }
    if (!dto?.name?.trim()) {
      throw new BadRequestException('Visitor name is required');
    }

    const ctx = await this.passService.contextFromBuildingId(company.buildingId);
    const deskApproval = company.settings?.invitesNeedDesk === true;
    const actor: Actor = {
      kind: ActorKind.EMPLOYEE,
      id: String(host._id),
      name: host.fullName,
    };

    const visitor = new this.visitorModel({
      name: dto.name.trim(),
      type: dto.type || 'Meeting',
      phoneNumber: dto.phoneNumber,
      profilePhoto: dto.profilePhoto,
      purpose: dto.purpose,
      vehicleNumber: dto.vehicleNumber,
      guestCount: dto.guestCount ?? 1,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      companyId: company._id,
      hostUserId: host._id,
      // Free text kept in step so every guard screen and export still works.
      hostCompany: company.name,
      hostPersonName: host.fullName,
      hostPhone: host.phoneNumber,
      hostFloor: host.workFloor || company.floor,
      hostUnit: host.workUnit || (company.units || [])[0],
      organizationId: company.organizationId,
      buildingId: company.buildingId,
      buildingName: company.buildingName,
      siteType: ctx.siteType,
      source: VisitorSource.INVITE,
      isPreApproved: !deskApproval,
      approvalMode: deskApproval ? ApprovalMode.GUARD : ApprovalMode.NONE,
      status: deskApproval ? VisitorStatus.PENDING : VisitorStatus.APPROVED,
    });
    if (!deskApproval) {
      visitor.approvedBy = actor;
      visitor.approvedAt = new Date();
    }
    await this.passService.issuePass(visitor, ctx.settings);
    const saved = await visitor.save();
    return this.passService.publicView(saved);
  }

  /** Visits hosted by me, or by the whole company for a boss/HR. */
  async visitors(jwtUser: any, scope: string | undefined, status?: string) {
    const p = await this.principal(jwtUser);
    const query: any = { companyId: p.companyId };
    const wantsCompany = scope === 'company' && this.isManager(p.companyRole);
    if (!wantsCompany) query.hostUserId = new Types.ObjectId(p.userId);
    if (status) query.status = status;
    const rows = await this.visitorModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(300)
      .exec();
    return rows.map((v) => ({
      ...this.passService.publicView(v),
      id: String(v._id),
      hostUserId: v.hostUserId ? String(v.hostUserId) : undefined,
      isPreApproved: v.isPreApproved,
      createdAt: (v as any).createdAt,
    }));
  }

  /**
   * Everything the guard desk needs to offer a company and a person: the
   * site's office tenants, each with its people. Called by a guard, so it is
   * deliberately narrow — names and desk locations, no contact details.
   */
  async deskDirectory(buildingId?: string) {
    const query: any = { isActive: { $ne: false } };
    if (buildingId && Types.ObjectId.isValid(buildingId)) {
      query.buildingId = new Types.ObjectId(buildingId);
    }
    const companies = await this.companyModel
      .find(query)
      .select('name floor units buildingId')
      .sort({ name: 1 })
      .limit(500)
      .lean()
      .exec();
    const ids = companies.map((c: any) => c._id);
    const people = await this.userModel
      .find({ companyId: { $in: ids }, isActive: { $ne: false } })
      .select('fullName designation companyId workFloor workUnit')
      .sort({ fullName: 1 })
      .lean()
      .exec();
    const byCompany = new Map<string, any[]>();
    for (const p of people as any[]) {
      const key = String(p.companyId);
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push({
        id: String(p._id),
        name: p.fullName,
        designation: p.designation,
        floor: p.workFloor,
        unit: p.workUnit,
      });
    }
    return companies.map((c: any) => ({
      id: String(c._id),
      name: c.name,
      floor: c.floor,
      unit: (c.units || [])[0],
      buildingId: String(c.buildingId),
      people: byCompany.get(String(c._id)) || [],
    }));
  }

  private escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
