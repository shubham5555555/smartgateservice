import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Organization,
  OrganizationDocument,
  slugify,
} from '../schemas/organization.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
  ) {}

  /** Super admins see every builder; everyone else only their own. */
  async findAll() {
    const scope = TenantContext.current();
    const filter: any = {};
    if (!TenantContext.isPlatform(scope)) {
      if (!scope.organizationId) return [];
      filter._id = scope.organizationId;
    }
    const orgs = await this.organizationModel.find(filter).sort({ name: 1 }).lean().exec();
    const counts = await this.buildingModel.aggregate([
      { $match: { organizationId: { $in: orgs.map((o) => o._id) } } },
      { $group: { _id: '$organizationId', buildings: { $sum: 1 } } },
    ]);
    const byOrg = new Map(counts.map((c) => [String(c._id), c.buildings]));
    return orgs.map((o) => ({ ...o, buildingCount: byOrg.get(String(o._id)) || 0 }));
  }

  async findOne(id: string) {
    this.assertVisible(id);
    const org = await this.organizationModel.findById(id).exec();
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: CreateOrganizationDto) {
    const slug = slugify(dto.slug || dto.name);
    if (!slug) throw new BadRequestException('Name must contain letters or digits');
    const exists = await this.organizationModel.findOne({ slug }).exec();
    if (exists) throw new ConflictException(`Slug "${slug}" is already taken`);
    return new this.organizationModel({ ...dto, slug }).save();
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    this.assertVisible(id);
    const org = await this.organizationModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  /** Soft delete: a builder with data is deactivated, never removed. */
  async remove(id: string) {
    const buildings = await this.buildingModel.countDocuments({ organizationId: new Types.ObjectId(id) });
    if (buildings > 0) {
      const org = await this.organizationModel
        .findByIdAndUpdate(id, { isActive: false }, { new: true })
        .exec();
      if (!org) throw new NotFoundException('Organization not found');
      return { deactivated: true, message: `Organization has ${buildings} building(s); it was deactivated instead of deleted.` };
    }
    const res = await this.organizationModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Organization not found');
    return { deleted: true };
  }

  async ensureDefault(): Promise<OrganizationDocument> {
    const existing = await this.organizationModel.findOne().sort({ createdAt: 1 }).exec();
    if (existing) return existing;
    return new this.organizationModel({ name: 'Default Builder', slug: 'default' }).save();
  }

  private assertVisible(id: string) {
    const scope = TenantContext.current();
    if (TenantContext.isPlatform(scope)) return;
    if (!scope.organizationId || String(scope.organizationId) !== String(id)) {
      throw new ForbiddenException('That organization is not yours');
    }
  }
}
