import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';
import { TenantContext } from './tenant-context';

/**
 * Scope helpers that need the database: resolving the set of residents or
 * buildings inside the caller's tenant, so collections that only carry a
 * `userId` (parcels, complaints, vehicles, pets…) can still be fenced.
 */
@Injectable()
export class TenantService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
  ) {}

  /** `{}` when unrestricted, else `{ userId: { $in: [...] } }`. */
  async userFilter(field = 'userId'): Promise<Record<string, any>> {
    const ids = await this.userIdsInScope();
    if (ids === null) return {};
    return { [field]: { $in: ids } };
  }

  /** null = no restriction. */
  async userIdsInScope(): Promise<Types.ObjectId[] | null> {
    const scope = TenantContext.current();
    if (!scope.organizationId && !scope.buildingIds) return null;
    const filter = TenantContext.buildingFilter('buildingId', 'organizationId', scope);
    const users = await this.userModel.find(filter).select('_id').lean().exec();
    return users.map((u) => u._id as Types.ObjectId);
  }

  /** Building ids inside the caller's scope (null = unrestricted). */
  async buildingIdsInScope(): Promise<Types.ObjectId[] | null> {
    const scope = TenantContext.current();
    if (!scope.organizationId && !scope.buildingIds) return null;
    if (scope.buildingIds && scope.buildingIds.length) return scope.buildingIds;
    const buildings = await this.buildingModel
      .find(TenantContext.orgFilter('organizationId', scope))
      .select('_id')
      .lean()
      .exec();
    return buildings.map((b) => b._id as Types.ObjectId);
  }

  /** Throws 403 unless the building is inside the caller's scope. */
  async assertBuildingAccess(buildingId: any): Promise<BuildingDocument> {
    const scope = TenantContext.current();
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new ForbiddenException('Building is outside your organization');
    }
    if (
      scope.organizationId &&
      building.organizationId &&
      String(building.organizationId) !== String(scope.organizationId)
    ) {
      throw new ForbiddenException('Building is outside your organization');
    }
    if (!TenantContext.canAccessBuilding(building._id, scope)) {
      throw new ForbiddenException('Building is outside your assigned sites');
    }
    return building;
  }

  async organizationName(id?: Types.ObjectId | string | null): Promise<string | undefined> {
    if (!id) return undefined;
    const org = await this.organizationModel.findById(id).select('name').lean().exec();
    return org?.name;
  }
}
