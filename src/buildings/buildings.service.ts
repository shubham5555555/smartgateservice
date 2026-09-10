import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContext } from '../tenancy/tenant-context';
import {
  ActorKind,
  ApprovalMode,
  Visitor,
  VisitorDocument,
  VisitorStatus,
} from '../schemas/visitor.schema';
import {
  PROPERTY_TYPES,
  UnitModel,
  propertyTypeFromLegacyLabel,
  propertyTypeInfo,
  standaloneUnitNumber,
} from '../schemas/property-types';
import { ClientSession } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Building,
  BuildingDocument,
  FlatStatus,
  Floor,
  Flat,
  generateGateQrToken,
} from '../schemas/building.schema';
import {
  SiteSettings,
  SiteType,
  inferSiteType,
  resolveSiteSettings,
  toPlainSettings,
} from '../schemas/site-settings';
import { User } from '../schemas/user.schema';
import { S3Service } from '../common/s3.service';
import { QueueService } from '../queues/queue.service';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private s3Service: S3Service,
    private queueService: QueueService,
  ) { }

  /** The catalogue the create-building UI renders. */
  getPropertyTypes() {
    return PROPERTY_TYPES;
  }

  /** Organization a new building must belong to. */
  private resolveOrganizationForCreate(requested?: string) {
    const scope = TenantContext.current();
    if (TenantContext.isPlatform(scope)) {
      const raw = requested || (scope.organizationId ? String(scope.organizationId) : undefined);
      if (!raw) {
        throw new BadRequestException(
          'organizationId is required: pick the builder this building belongs to',
        );
      }
      return new Types.ObjectId(raw);
    }
    if (requested && scope.organizationId && String(requested) !== String(scope.organizationId)) {
      throw new ForbiddenException('You can only create buildings in your own organization');
    }
    return TenantContext.requireOrganizationId(scope);
  }

  /** Generate the unit layout for a property type. */
  buildFloors(propertyType: string, totalFloors: number, flatsPerFloor: number) {
    const info = propertyTypeInfo(propertyType);
    const floors: Floor[] = [];
    if (info.unitModel === UnitModel.STANDALONE) {
      // Each "floor" is one standalone unit: Villa-001, Plot-002, House-003…
      for (let unitNum = 1; unitNum <= totalFloors; unitNum++) {
        floors.push({
          floorNumber: unitNum,
          flats: [
            {
              flatNumber: standaloneUnitNumber(propertyType, unitNum),
              floor: unitNum,
              status: FlatStatus.AVAILABLE,
              bedrooms: info.unitLabel === 'Plot' ? undefined : 3,
              area: info.unitLabel === 'Plot' ? 2400 : 2000,
            },
          ],
        });
      }
      return { floors, totalFlats: totalFloors, flatsPerFloor: 1 };
    }
    for (let floorNum = totalFloors; floorNum >= 1; floorNum--) {
      const flats: Flat[] = [];
      for (let flatNum = 1; flatNum <= flatsPerFloor; flatNum++) {
        flats.push({
          flatNumber: `${floorNum}${String(flatNum).padStart(2, '0')}`,
          floor: floorNum,
          status: FlatStatus.AVAILABLE,
          bedrooms: info.siteType === 'commercial' ? undefined : 2,
          area: 1000,
        });
      }
      floors.push({ floorNumber: floorNum, flats });
    }
    return { floors, totalFlats: totalFloors * flatsPerFloor, flatsPerFloor };
  }

  async createBuilding(createBuildingDto: any) {
    const {
      name,
      address,
      type,
      totalFloors,
      flatsPerFloor,
      totalUnits,
      amenities,
      description,
      organizationId: requestedOrg,
    } = createBuildingDto;

    const propertyType =
      createBuildingDto.propertyType || propertyTypeFromLegacyLabel(type);
    const info = propertyTypeInfo(propertyType);
    const organizationId = this.resolveOrganizationForCreate(requestedOrg);

    const duplicate = await this.buildingModel
      .findOne({ organizationId, normalizedName: String(name).toLowerCase() })
      .exec();
    if (duplicate) {
      throw new BadRequestException(
        `A building named "${name}" already exists for this builder`,
      );
    }

    const count = Math.max(1, Number(totalUnits ?? totalFloors ?? 1));
    const perFloor = Math.max(1, Number(flatsPerFloor ?? 1));
    const layout = this.buildFloors(propertyType, count, perFloor);

    const building = new this.buildingModel({
      organizationId,
      name,
      address,
      type: type && !createBuildingDto.propertyType ? type : info.label,
      propertyType,
      unitModel: info.unitModel,
      unitLabel: info.unitLabel,
      siteType: info.siteType,
      // Site rules follow the property type (commercial → guard approves at the desk).
      settings: resolveSiteSettings(info.siteType),
      totalFloors: count,
      flatsPerFloor: layout.flatsPerFloor,
      floors: layout.floors,
      amenities: amenities || [],
      description,
      totalFlats: layout.totalFlats,
      availableFlats: layout.totalFlats,
      occupiedFlats: 0,
    });

    return building.save();
  }

  /**
   * Bulk import buildings from uploaded CSV file.
   * Expected CSV headers: name,address,type,totalFloors,flatsPerFloor,amenities
   */
  async bulkImport(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    const text = file.buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      throw new BadRequestException('CSV must contain header and at least one row');
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const required = ['name', 'address', 'totalfloors', 'flatsperfloor'];
    for (const r of required) {
      if (!header.includes(r)) {
        throw new BadRequestException(`Missing required CSV column: ${r}`);
      }
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((c) => c.trim());
      const obj: any = {};
      header.forEach((h, idx) => {
        obj[h] = row[idx] ?? '';
      });

      try {
        const payload = {
          name: obj['name'],
          address: obj['address'],
          type: obj['type'] || 'Apartment',
          totalFloors: parseInt(obj['totalfloors'] || '0', 10) || 0,
          flatsPerFloor: parseInt(obj['flatsperfloor'] || '0', 10) || 0,
          amenities: obj['amenities'] ? obj['amenities'].split('|').map((s: string) => s.trim()) : [],
          description: obj['description'] || '',
        };
        const b = await this.createBuilding(payload);
        created.push(b);
      } catch (e: any) {
        errors.push({ line: i + 1, error: e.message || String(e) });
      }
    }

    return { createdCount: created.length, errors, created };
  }

  /**
   * Run `work` inside a transaction when the deployment supports one (replica
   * set / mongos) and fall back to a plain sequential run on a standalone
   * MongoDB, where transactions are rejected outright.
   */
  private async withOptionalTransaction<T>(
    work: (session: ClientSession | null) => Promise<T>,
  ): Promise<T> {
    const session = await this.buildingModel.db.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error: any) {
      const message = String(error?.message || '');
      const noTransactions =
        error?.code === 20 ||
        /Transaction numbers are only allowed|does not support transactions|replica set/i.test(
          message,
        );
      if (!noTransactions) throw error;
      return work(null);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Bulk assign residents to flats atomically.
   * assignments: [{ residentId?, residentEmail?, flatNumber }]
   */
  async bulkAssign(buildingId: string, assignments: Array<{ residentId?: string; residentEmail?: string; flatNumber: string }>) {
    await this.withOptionalTransaction(async (session) => {
        const building = await this.buildingModel.findById(buildingId).session(session).exec();
        if (!building) {
          throw new NotFoundException('Building not found');
        }

        // Helper to find flat
        const findFlat = (flatNumber: string) => {
          for (const floor of building.floors) {
            const flat = floor.flats.find((f: any) => f.flatNumber === flatNumber);
            if (flat) return flat;
          }
          return null;
        };

        for (const a of assignments) {
          const flat = findFlat(a.flatNumber);
          if (!flat) {
            throw new BadRequestException(`Flat ${a.flatNumber} not found in building`);
          }
          if (flat.status === FlatStatus.OCCUPIED) {
            throw new BadRequestException(`Flat ${a.flatNumber} is already occupied`);
          }

          // Find resident by id or email
          let resident: any = null;
          if (a.residentId) {
            resident = await this.userModel.findById(a.residentId).session(session).exec();
          } else if (a.residentEmail) {
            resident = await this.userModel.findOne({ email: a.residentEmail }).session(session).exec();
          }
          if (!resident) {
            throw new NotFoundException(`Resident not found for flat ${a.flatNumber}`);
          }

          // Assign
          flat.status = FlatStatus.OCCUPIED;
          flat.residentId = resident._id.toString();
          flat.residentName = resident.fullName;
          flat.residentEmail = resident.email;
          flat.residentPhone = resident.phoneNumber;

          // Update resident
          resident.building = building.name;
          resident.block = building.name;
          resident.flat = a.flatNumber;
          resident.flatNo = a.flatNumber;
          resident.buildingId = building._id;
          if (building.organizationId) resident.organizationId = building.organizationId;
          await resident.save({ session });
        }

        // Recalculate stats
        building.occupiedFlats = building.floors.reduce((count: number, floor: any) => {
          return count + floor.flats.filter((f: any) => f.status === FlatStatus.OCCUPIED).length;
        }, 0);
        building.availableFlats = building.totalFlats - building.occupiedFlats;

        await building.save({ session });
    });
    return { success: true };
  }

  async exportBuildingCsv(buildingId: string) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) throw new NotFoundException('Building not found');

    const rows: string[] = [];
    rows.push('buildingName,floorNumber,flatNumber,status,residentId,residentName,residentEmail,residentPhone');
    for (const floor of building.floors) {
      for (const flat of floor.flats) {
        rows.push(
          `${(building.name || '').replace(/,/g, '')},${floor.floorNumber},${flat.flatNumber},${flat.status},${flat.residentId || ''},${(flat.residentName || '').replace(/,/g, '')},${(flat.residentEmail || '').replace(/,/g, '')},${(flat.residentPhone || '').replace(/,/g, '')}`,
        );
      }
    }
    return rows.join('\\n');
  }

  async getAllBuildings(options?: { page?: number; limit?: number; fields?: string[] }) {
    const page = options?.page && options.page > 0 ? options.page : undefined;
    const limit = options?.limit && options.limit > 0 ? options.limit : undefined;

    const query = this.buildingModel
      .find(TenantContext.buildingSelfFilter())
      .sort({ name: 1 });
    if (limit && page) {
      query.skip((page - 1) * limit).limit(limit);
    } else if (limit) {
      query.limit(limit);
    }

    const buildings = await query.exec();
    // Pre-dual-mode buildings: present the mode the server would infer, so the
    // dashboard never shows (or saves back) "residential" for an office.
    for (const b of buildings) {
      if (!b.siteType) b.siteType = inferSiteType(b.type);
      if (!b.settings) b.settings = resolveSiteSettings(b.siteType);
      if (!b.propertyType) b.propertyType = propertyTypeFromLegacyLabel(b.type);
    }

    // Get all residents with building/flat info in one query (tenant-scoped)
    const allResidents = await this.userModel
      .find({
        ...TenantContext.orgFilter(),
        $or: [
          { building: { $exists: true, $ne: null } },
          { flat: { $exists: true, $ne: null } },
          { flatNo: { $exists: true, $ne: null } },
        ],
      })
      .exec();

    // Populate resident information for each building
    for (const building of buildings) {
      // Filter residents for this building (case-insensitive)
      const buildingResidents = allResidents.filter(
        (r) =>
          r.building &&
          r.building.toLowerCase() === building.name.toLowerCase(),
      );

      let needsSave = false;

      for (const floor of building.floors) {
        for (const flat of floor.flats) {
          // If flat has residentId, verify and populate resident info
          if (flat.residentId) {
            const resident =
              buildingResidents.find(
                (r) => r._id.toString() === flat.residentId,
              ) ||
              allResidents.find((r) => r._id.toString() === flat.residentId);

            if (
              resident &&
              resident.building &&
              resident.building.toLowerCase() === building.name.toLowerCase()
            ) {
              flat.status = FlatStatus.OCCUPIED;
              flat.residentName = resident.fullName;
              flat.residentEmail = resident.email;
              flat.residentPhone = resident.phoneNumber;
            } else {
              // Resident not found or doesn't match, clear the assignment
              flat.status = FlatStatus.AVAILABLE;
              flat.residentId = undefined;
              flat.residentName = undefined;
              flat.residentEmail = undefined;
              flat.residentPhone = undefined;
              needsSave = true;
            }
          } else {
            // Check if there's a resident matching this building and flat
            const resident = buildingResidents.find(
              (r) => r.flat === flat.flatNumber || r.flatNo === flat.flatNumber,
            );

            if (resident) {
              flat.status = FlatStatus.OCCUPIED;
              flat.residentId = resident._id.toString();
              flat.residentName = resident.fullName;
              flat.residentEmail = resident.email;
              flat.residentPhone = resident.phoneNumber;
              needsSave = true;
            } else {
              // Ensure status is set correctly
              if (flat.status === FlatStatus.OCCUPIED) {
                flat.status = FlatStatus.AVAILABLE;
                flat.residentId = undefined;
                flat.residentName = undefined;
                flat.residentEmail = undefined;
                flat.residentPhone = undefined;
                needsSave = true;
              }
            }
          }
        }
      }

      // Update statistics
      const occupiedCount = building.floors.reduce((count, floor) => {
        return (
          count +
          floor.flats.filter((f) => f.status === FlatStatus.OCCUPIED).length
        );
      }, 0);

      if (building.occupiedFlats !== occupiedCount) {
        building.occupiedFlats = occupiedCount;
        building.availableFlats = building.totalFlats - building.occupiedFlats;
        needsSave = true;
      }

      // Save if any changes were made
      if (needsSave) {
        await building.save();
      }
    }

    return buildings.map((b) => b.toObject());
  }

  /** 404 when missing, 403 when it belongs to another builder / outside the manager's sites. */
  async getScopedBuilding(id: string): Promise<BuildingDocument> {
    if (!Types.ObjectId.isValid(String(id))) {
      throw new NotFoundException('Building not found');
    }
    const building = await this.buildingModel.findById(id).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }
    const scope = TenantContext.current();
    if (
      scope.organizationId &&
      building.organizationId &&
      String(building.organizationId) !== String(scope.organizationId)
    ) {
      throw new ForbiddenException('This building belongs to another organization');
    }
    if (!TenantContext.canAccessBuilding(building._id, scope)) {
      throw new ForbiddenException('This building is outside your assigned sites');
    }
    return building;
  }

  async getBuildingById(id: string) {
    const building = await this.getScopedBuilding(id);

    // Get all residents for this building in one query for better performance
    // Use case-insensitive matching for building name
    const allResidents = await this.userModel
      .find({
        ...(building.organizationId ? { organizationId: building.organizationId } : {}),
        $or: [
          { building: { $exists: true, $ne: null } },
          { flat: { $exists: true, $ne: null } },
          { flatNo: { $exists: true, $ne: null } },
        ],
      })
      .exec();

    // Filter residents for this building (case-insensitive)
    const residents = allResidents.filter(
      (r) =>
        r.building && r.building.toLowerCase() === building.name.toLowerCase(),
    );

    let needsSave = false;

    // Ensure resident information is populated and status is correct
    for (const floor of building.floors) {
      for (const flat of floor.flats) {
        // If flat has residentId, verify and populate resident info
        if (flat.residentId) {
          const resident =
            residents.find((r) => r._id.toString() === flat.residentId) ||
            (await this.userModel.findById(flat.residentId).exec());

          if (
            resident &&
            (resident.building === building.name || !resident.building)
          ) {
            flat.status = FlatStatus.OCCUPIED;
            flat.residentName = resident.fullName;
            flat.residentEmail = resident.email;
            flat.residentPhone = resident.phoneNumber;
          } else {
            // Resident not found or doesn't match, clear the assignment
            flat.status = FlatStatus.AVAILABLE;
            flat.residentId = undefined;
            flat.residentName = undefined;
            flat.residentEmail = undefined;
            flat.residentPhone = undefined;
            needsSave = true;
          }
        } else {
          // Check if there's a resident matching this building and flat
          const resident = residents.find(
            (r) =>
              r.building === building.name &&
              (r.flat === flat.flatNumber || r.flatNo === flat.flatNumber),
          );

          if (resident) {
            flat.status = FlatStatus.OCCUPIED;
            flat.residentId = resident._id.toString();
            flat.residentName = resident.fullName;
            flat.residentEmail = resident.email;
            flat.residentPhone = resident.phoneNumber;
            needsSave = true;
          } else {
            // Ensure status is set correctly
            if (flat.status === FlatStatus.OCCUPIED) {
              flat.status = FlatStatus.AVAILABLE;
              needsSave = true;
            }
          }
        }
      }
    }

    // Update statistics
    const occupiedCount = building.floors.reduce((count, floor) => {
      return (
        count +
        floor.flats.filter((f) => f.status === FlatStatus.OCCUPIED).length
      );
    }, 0);

    if (building.occupiedFlats !== occupiedCount) {
      building.occupiedFlats = occupiedCount;
      building.availableFlats = building.totalFlats - building.occupiedFlats;
      needsSave = true;
    }

    // Save if any changes were made
    if (needsSave) {
      await building.save();
    }

    return building.toObject();
  }

  async updateBuilding(id: string, updateBuildingDto: any) {
    const building = await this.buildingModel
      .findByIdAndUpdate(id, { $set: updateBuildingDto }, { new: true })
      .exec();

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    return building;
  }

  async deleteBuilding(id: string) {
    await this.getScopedBuilding(id);
    const building = await this.buildingModel.findByIdAndDelete(id).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }
    return building;
  }

  async assignResidentToFlat(
    buildingId: string,
    flatNumber: string,
    residentId: string,
  ) {
    // Atomic where the deployment supports transactions (see helper).
    return this.withOptionalTransaction(async (session) => {
        // Attempt an atomic update to set the flat to OCCUPIED only if it is currently AVAILABLE
        const updatedBuilding = await this.buildingModel
          .findOneAndUpdate(
            {
              _id: buildingId,
              'floors.flats.flatNumber': flatNumber,
              'floors.flats.status': FlatStatus.AVAILABLE,
            },
            {
              $set: {
                'floors.$[].flats.$[fl].status': FlatStatus.OCCUPIED,
                'floors.$[].flats.$[fl].residentId': residentId,
                'floors.$[].flats.$[fl].residentName': undefined, // will populate after resident lookup
                'floors.$[].flats.$[fl].residentEmail': undefined,
                'floors.$[].flats.$[fl].residentPhone': undefined,
              },
            },
            {
              arrayFilters: [{ 'fl.flatNumber': flatNumber, 'fl.status': FlatStatus.AVAILABLE }],
              new: true,
              session,
            },
          )
          .exec();

        if (!updatedBuilding) {
          // No document updated — either not found or flat already occupied
          throw new BadRequestException('Flat not found or already occupied');
        }

        // Populate resident info and update resident document
        const resident = await this.userModel
          .findById(residentId)
          .session(session)
          .exec();
        if (!resident) {
          // Rollback by throwing inside transaction
          throw new NotFoundException('Resident not found');
        }

        // Update resident's building and flat info (name + resolved references)
        resident.building = updatedBuilding.name;
        resident.block = updatedBuilding.name;
        resident.flat = flatNumber;
        resident.flatNo = flatNumber;
        resident.buildingId = updatedBuilding._id as Types.ObjectId;
        if (updatedBuilding.organizationId) {
          resident.organizationId = updatedBuilding.organizationId as Types.ObjectId;
        }

        await resident.save({ session });

        // Now update the flat's resident details (name/email/phone) for the changed flat(s)
        for (const floor of updatedBuilding.floors) {
          for (const flat of floor.flats) {
            if (flat.flatNumber === flatNumber && flat.status === FlatStatus.OCCUPIED) {
              flat.residentId = residentId;
              flat.residentName = resident.fullName;
              flat.residentEmail = resident.email;
              flat.residentPhone = resident.phoneNumber;
            }
          }
        }

        // Recalculate stats and save
        updatedBuilding.occupiedFlats = updatedBuilding.floors.reduce((count, floor) => {
          return count + floor.flats.filter((f) => f.status === FlatStatus.OCCUPIED).length;
        }, 0);
        updatedBuilding.availableFlats = updatedBuilding.totalFlats - updatedBuilding.occupiedFlats;

        return updatedBuilding.save({ session });
    });
  }

  async unassignResidentFromFlat(buildingId: string, flatNumber: string) {
    return this.withOptionalTransaction(async (session) => {
        const building = await this.buildingModel
          .findById(buildingId)
          .session(session)
          .exec();
        if (!building) {
          throw new NotFoundException('Building not found');
        }

        // Find and update the flat
        let flatFound = false;
        let residentId: string | undefined;
        for (const floor of building.floors) {
          const flat = floor.flats.find((f) => f.flatNumber === flatNumber);
          if (flat) {
            residentId = flat.residentId;
            flat.status = FlatStatus.AVAILABLE;
            flat.residentId = undefined;
            flat.residentName = undefined;
            flat.residentEmail = undefined;
            flat.residentPhone = undefined;
            flatFound = true;
            break;
          }
        }

        if (!flatFound) {
          throw new NotFoundException('Flat not found');
        }

        // Update building statistics
        building.occupiedFlats = building.floors.reduce((count, floor) => {
          return (
            count +
            floor.flats.filter((f) => f.status === FlatStatus.OCCUPIED).length
          );
        }, 0);
        building.availableFlats = building.totalFlats - building.occupiedFlats;

        // Update resident's building and flat info
        if (residentId) {
          const resident = await this.userModel
            .findById(residentId)
            .session(session)
            .exec();
          if (resident) {
            resident.building = undefined;
            resident.block = undefined;
            resident.flat = undefined;
            resident.flatNo = undefined;
            await resident.save({ session });
          }
        }

        return building.save({ session });
    });
  }

  async updateFlatDetails(
    buildingId: string,
    flatNumber: string,
    flatDetails: Partial<Flat>,
  ) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Find and update the flat
    let flatFound = false;
    for (const floor of building.floors) {
      const flat = floor.flats.find((f) => f.flatNumber === flatNumber);
      if (flat) {
        Object.assign(flat, flatDetails);
        flatFound = true;
        break;
      }
    }

    if (!flatFound) {
      throw new NotFoundException('Flat not found');
    }

    return building.save();
  }

  async syncResidentsWithBuildings() {
    // Sync existing residents with building flats
    const buildings = await this.buildingModel.find().exec();
    const residents = await this.userModel
      .find({
        $or: [
          { building: { $exists: true, $ne: null } },
          { flat: { $exists: true, $ne: null } },
        ],
      })
      .exec();

    for (const building of buildings) {
      for (const floor of building.floors) {
        for (const flat of floor.flats) {
          // Find resident by building and flat
          const resident = residents.find(
            (r) =>
              r.building === building.name &&
              (r.flat === flat.flatNumber || r.flatNo === flat.flatNumber),
          );

          if (resident) {
            flat.status = FlatStatus.OCCUPIED;
            flat.residentId = resident._id.toString();
            flat.residentName = resident.fullName;
            flat.residentEmail = resident.email;
            flat.residentPhone = resident.phoneNumber;
          } else if (flat.status === FlatStatus.OCCUPIED && !flat.residentId) {
            // Clear orphaned flat assignments
            flat.status = FlatStatus.AVAILABLE;
            flat.residentId = undefined;
            flat.residentName = undefined;
            flat.residentEmail = undefined;
            flat.residentPhone = undefined;
          }
        }
      }

      // Update statistics
      building.occupiedFlats = building.floors.reduce((count, floor) => {
        return (
          count +
          floor.flats.filter((f) => f.status === FlatStatus.OCCUPIED).length
        );
      }, 0);
      building.availableFlats = building.totalFlats - building.occupiedFlats;

      await building.save();
    }

    return { message: 'Residents synced with buildings successfully' };
  }

  async uploadBuildingImage(buildingId: string, file: Express.Multer.File) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Enqueue image upload job (async)
    const job = await this.queueService.add('imageQueue', {
      action: 'uploadBuildingImage',
      buildingId,
      filename: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer.toString('base64'),
    });

    // Return accepted response; worker will update building when done
    return { jobId: job.id, status: 'queued' };
  }

  async uploadBuildingImages(buildingId: string, files: Express.Multer.File[]) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Enqueue batch upload job
    const job = await this.queueService.add('imageQueue', {
      action: 'uploadBuildingImages',
      buildingId,
      files: files.map((f) => ({
        filename: f.originalname,
        mimetype: f.mimetype,
        buffer: f.buffer.toString('base64'),
      })),
    });

    return { jobId: job.id, status: 'queued' };
  }

  async uploadFlatImage(
    buildingId: string,
    flatNumber: string,
    file: Express.Multer.File,
  ) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Enqueue flat image upload job
    const job = await this.queueService.add('imageQueue', {
      action: 'uploadFlatImage',
      buildingId,
      flatNumber,
      filename: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer.toString('base64'),
    });

    return { jobId: job.id, status: 'queued' };
  }

  async deleteFlatImage(
    buildingId: string,
    flatNumber: string,
    imageUrl: string,
  ) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Find and update the flat
    let flatFound = false;
    for (const floor of building.floors) {
      const flat = floor.flats.find((f) => f.flatNumber === flatNumber);
      if (flat && flat.images) {
        flat.images = flat.images.filter((img) => img !== imageUrl);
        flatFound = true;
        break;
      }
    }

    if (!flatFound) {
      throw new NotFoundException('Flat not found');
    }

    await building.save();
    return { message: 'Image deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // Site mode (residential / commercial)
  // ---------------------------------------------------------------------------

  /**
   * Buildings created before dual-mode support have no siteType/settings/token.
   * Fill them in lazily rather than requiring the migration to have run.
   */
  private async backfillSiteFields(
    building: BuildingDocument,
  ): Promise<BuildingDocument> {
    let dirty = false;
    if (!building.siteType) {
      building.siteType = inferSiteType(building.type);
      dirty = true;
    }
    if (!building.settings) {
      building.settings = resolveSiteSettings(building.siteType);
      dirty = true;
    }
    if (!building.gateQrToken) {
      building.gateQrToken = generateGateQrToken();
      dirty = true;
    }
    if (dirty) {
      await building.save();
    }
    return building;
  }

  async findByGateToken(gateQrToken: string): Promise<BuildingDocument> {
    const building = await this.buildingModel
      .findOne({ gateQrToken, isActive: true })
      .exec();
    if (!building) {
      throw new NotFoundException('Unknown or deactivated gate QR code');
    }
    return this.backfillSiteFields(building);
  }

  /** Resolve a building from the plain name residents store on their profile. */
  async findByName(
    name?: string,
    organizationId?: Types.ObjectId | string | null,
  ): Promise<BuildingDocument | null> {
    if (!name) return null;
    const orgFilter = organizationId
      ? { organizationId: new Types.ObjectId(String(organizationId)) }
      : {};
    const building = await this.buildingModel
      .findOne({ ...orgFilter, normalizedName: name.toLowerCase() })
      .exec();
    if (building) return this.backfillSiteFields(building);
    const loose = await this.buildingModel
      .findOne({ ...orgFilter, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .exec();
    return loose ? this.backfillSiteFields(loose) : null;
  }

  async getSiteContext(buildingId: string) {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }
    await this.backfillSiteFields(building);
    return {
      building,
      siteType: building.siteType,
      settings: resolveSiteSettings(building.siteType, building.settings),
    };
  }

  async updateSiteSettings(
    id: string,
    dto: { siteType?: SiteType; settings?: Partial<SiteSettings> },
  ) {
    const building = await this.getScopedBuilding(id);
    await this.backfillSiteFields(building);

    if (dto.siteType && dto.siteType !== building.siteType) {
      // Visits still waiting under the old rules would be orphaned (e.g. a
      // guard-mode visit at a site that no longer lets guards approve).
      await this.visitorModel.updateMany(
        { buildingId: building._id, status: VisitorStatus.PENDING },
        {
          $set: {
            status: VisitorStatus.REJECTED,
            approvalMode: ApprovalMode.NONE,
            rejectionReason: 'Site mode changed by the administrator. Please register again.',
            approvedBy: { kind: ActorKind.SYSTEM },
            approvedAt: new Date(),
          },
        },
      );
      // Switching mode re-bases the flags on that mode's defaults, then applies
      // any explicit overrides sent alongside the switch.
      building.siteType = dto.siteType;
      building.settings = resolveSiteSettings(dto.siteType, dto.settings);
      building.markModified('settings');
    } else if (dto.settings) {
      // Partial update: keep every flag not mentioned in the request.
      building.settings = resolveSiteSettings(building.siteType, {
        ...toPlainSettings(building.settings),
        ...toPlainSettings(dto.settings),
      });
      building.markModified('settings');
    }

    await building.save();
    return {
      id: building._id.toString(),
      name: building.name,
      siteType: building.siteType,
      settings: building.settings,
    };
  }

  async rotateGateQrToken(id: string) {
    const building = await this.getScopedBuilding(id);
    building.gateQrToken = generateGateQrToken();
    await building.save();
    return { id: building._id.toString(), gateQrToken: building.gateQrToken };
  }

  async getGateQr(id: string) {
    const building = await this.getScopedBuilding(id);
    await this.backfillSiteFields(building);
    return {
      id: building._id.toString(),
      name: building.name,
      address: building.address,
      siteType: building.siteType,
      gateQrToken: building.gateQrToken,
    };
  }
}
