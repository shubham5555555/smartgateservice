import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  AdminRole,
  AdminUser,
  AdminUserDocument,
} from '../schemas/admin-user.schema';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { TenantContext, TenantScope } from '../tenancy/tenant-context';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';

export interface PublicAdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole | 'super_admin';
  organizationId?: string;
  organizationName?: string;
  buildingIds: string[];
  phoneNumber?: string;
  isActive: boolean;
  lastLoginAt?: Date;
}

@Injectable()
export class AdminUsersService implements OnModuleInit {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectModel(AdminUser.name) private adminUserModel: Model<AdminUserDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    private configService: ConfigService,
  ) {}

  /**
   * First start on an existing deployment: turn the .env admin into a
   * super_admin account so the old credentials keep working.
   */
  async onModuleInit() {
    try {
      const count = await this.adminUserModel.estimatedDocumentCount();
      if (count > 0) return;
      const email = this.configService.get<string>('ADMIN_EMAIL', 'admin@smartgate.com');
      const hashed = this.configService.get<string>('ADMIN_PASSWORD_HASHED');
      const plain = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');
      await new this.adminUserModel({
        email: email.toLowerCase(),
        password: hashed || plain, // pre-save hashes a plain password
        name: 'Platform Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        createdBy: 'bootstrap',
      }).save();
      this.logger.log(`Bootstrapped super_admin account for ${email}`);
    } catch (err) {
      this.logger.error('Could not bootstrap the super_admin account', err as any);
    }
  }

  async authenticate(email: string, password: string): Promise<AdminUserDocument | null> {
    const user = await this.adminUserModel
      .findOne({ email: (email || '').toLowerCase().trim(), isActive: true })
      .exec();
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }

  async findById(id: string): Promise<AdminUserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.adminUserModel.findById(id).exec();
  }

  /** JWT claims for an admin account. */
  tokenPayload(user: AdminUserDocument) {
    return {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId.toString() : undefined,
      buildingIds: (user.buildingIds || []).map((b) => b.toString()),
    };
  }

  async toPublic(user: AdminUserDocument): Promise<PublicAdminUser> {
    const orgName = user.organizationId
      ? (await this.organizationModel.findById(user.organizationId).select('name').lean().exec())?.name
      : undefined;
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId.toString() : undefined,
      organizationName: orgName,
      buildingIds: (user.buildingIds || []).map((b) => b.toString()),
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ---- management -----------------------------------------------------------

  async findAll(): Promise<PublicAdminUser[]> {
    const scope = TenantContext.current();
    const filter: any = {};
    if (TenantContext.isPlatform(scope)) {
      if (scope.organizationId) filter.organizationId = scope.organizationId;
    } else {
      filter.organizationId = scope.organizationId;
    }
    const users = await this.adminUserModel.find(filter).sort({ createdAt: -1 }).exec();
    return Promise.all(users.map((u) => this.toPublic(u)));
  }

  async create(dto: CreateAdminUserDto): Promise<PublicAdminUser> {
    const scope = TenantContext.current();
    const organizationId = await this.resolveOrganization(dto.role, dto.organizationId, scope);
    this.assertCanManageRole(dto.role, scope);
    const buildingIds = await this.validateBuildings(dto.buildingIds, organizationId);

    const exists = await this.adminUserModel.findOne({ email: dto.email.toLowerCase() }).exec();
    if (exists) throw new ConflictException('An admin with that email already exists');

    const user = await new this.adminUserModel({
      email: dto.email.toLowerCase(),
      password: dto.password,
      name: dto.name,
      role: dto.role,
      organizationId: organizationId || undefined,
      buildingIds,
      phoneNumber: dto.phoneNumber,
      createdBy: scope.principalId,
    }).save();
    return this.toPublic(user);
  }

  async update(id: string, dto: UpdateAdminUserDto): Promise<PublicAdminUser> {
    const scope = TenantContext.current();
    const user = await this.getManaged(id, scope);
    const role = dto.role || user.role;
    this.assertCanManageRole(role, scope);
    const organizationId = await this.resolveOrganization(
      role,
      dto.organizationId ?? (user.organizationId ? user.organizationId.toString() : undefined),
      scope,
    );
    if (dto.buildingIds !== undefined) {
      user.buildingIds = await this.validateBuildings(dto.buildingIds, organizationId);
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.isActive !== undefined) {
      if (String(user._id) === String(scope.principalId) && dto.isActive === false) {
        throw new BadRequestException('You cannot deactivate your own account');
      }
      user.isActive = dto.isActive;
    }
    user.role = role;
    user.organizationId = organizationId || undefined;
    if (role === AdminRole.SUPER_ADMIN) {
      user.organizationId = undefined;
      user.buildingIds = [];
    }
    await user.save();
    return this.toPublic(user);
  }

  async remove(id: string) {
    const scope = TenantContext.current();
    const user = await this.getManaged(id, scope);
    if (String(user._id) === String(scope.principalId)) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (user.role === AdminRole.SUPER_ADMIN) {
      const supers = await this.adminUserModel.countDocuments({ role: AdminRole.SUPER_ADMIN, isActive: true });
      if (supers <= 1) throw new BadRequestException('At least one super admin must remain');
    }
    await user.deleteOne();
    return { deleted: true };
  }

  async resetPassword(id: string, newPassword: string) {
    const scope = TenantContext.current();
    const user = await this.getManaged(id, scope);
    user.password = newPassword; // hashed by the pre-save hook
    await user.save();
    return { message: 'Password updated' };
  }

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.adminUserModel.findById(id).exec();
    if (!user) throw new NotFoundException('Admin not found');
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    user.password = newPassword;
    await user.save();
    return { message: 'Password changed successfully' };
  }

  // ---- helpers ----------------------------------------------------------------

  private async getManaged(id: string, scope: TenantScope): Promise<AdminUserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Admin not found');
    if (!TenantContext.isPlatform(scope)) {
      if (!user.organizationId || String(user.organizationId) !== String(scope.organizationId)) {
        throw new ForbiddenException('That admin belongs to another organization');
      }
      if (user.role === AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only a super admin can manage super admins');
      }
    }
    return user;
  }

  private assertCanManageRole(role: AdminRole, scope: TenantScope) {
    if (TenantContext.isPlatform(scope)) return;
    if (scope.role !== AdminRole.BUILDER_ADMIN) {
      throw new ForbiddenException('Only builder admins can manage accounts');
    }
    if (role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can create super admins');
    }
  }

  private async resolveOrganization(
    role: AdminRole,
    requested: string | undefined,
    scope: TenantScope,
  ): Promise<Types.ObjectId | null> {
    if (role === AdminRole.SUPER_ADMIN) return null;
    let orgId: Types.ObjectId | null = null;
    if (TenantContext.isPlatform(scope)) {
      const raw = requested || (scope.organizationId ? String(scope.organizationId) : undefined);
      if (!raw) throw new BadRequestException('organizationId is required for this role');
      orgId = new Types.ObjectId(raw);
    } else {
      if (requested && String(requested) !== String(scope.organizationId)) {
        throw new ForbiddenException('You can only create accounts in your own organization');
      }
      orgId = scope.organizationId;
    }
    if (!orgId) throw new BadRequestException('organizationId is required');
    const org = await this.organizationModel.findById(orgId).exec();
    if (!org) throw new NotFoundException('Organization not found');
    return orgId;
  }

  private async validateBuildings(
    ids: string[] | undefined,
    organizationId: Types.ObjectId | null,
  ): Promise<Types.ObjectId[]> {
    if (!ids || ids.length === 0) return [];
    if (!organizationId) return [];
    const objectIds = ids.map((i) => new Types.ObjectId(i));
    const found = await this.buildingModel
      .countDocuments({ _id: { $in: objectIds }, organizationId })
      .exec();
    if (found !== objectIds.length) {
      throw new BadRequestException('One or more buildings do not belong to that organization');
    }
    return objectIds;
  }
}
