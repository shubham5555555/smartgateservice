import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Building,
  BuildingDocument,
  FlatStatus,
  Floor,
  Flat,
} from '../schemas/building.schema';
import { User } from '../schemas/user.schema';
import { S3Service } from '../common/s3.service';
import { QueueService } from '../queues/queue.service';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private s3Service: S3Service,
    private queueService: QueueService,
  ) { }

  async createBuilding(createBuildingDto: any) {
    const {
      name,
      address,
      type,
      totalFloors,
      flatsPerFloor,
      amenities,
      description,
    } = createBuildingDto;

    // Generate floors and flats/units structure based on building type
    const floors: Floor[] = [];
    const buildingType = type || 'Apartment';

    if (buildingType === 'Individual Home' || buildingType === 'Villa') {
      // For Individual Home/Villa: Each "floor" represents one unit/house
      for (let unitNum = 1; unitNum <= totalFloors; unitNum++) {
        const unitNumber = `Unit-${String(unitNum).padStart(3, '0')}`;
        floors.push({
          floorNumber: unitNum,
          flats: [
            {
              flatNumber: unitNumber,
              floor: unitNum,
              status: FlatStatus.AVAILABLE,
              bedrooms: 3, // Default for houses
              area: 2000, // Default sqft for houses
            },
          ],
        });
      }
    } else {
      // For Apartment/Tower/Commercial: Traditional floor-flat structure
      for (let floorNum = totalFloors; floorNum >= 1; floorNum--) {
        const flats: Flat[] = [];
        for (let flatNum = 1; flatNum <= flatsPerFloor; flatNum++) {
          const flatNumber = `${floorNum}${String(flatNum).padStart(2, '0')}`;
          flats.push({
            flatNumber,
            floor: floorNum,
            status: FlatStatus.AVAILABLE,
            bedrooms: 2, // Default
            area: 1000, // Default sqft
          });
        }
        floors.push({
          floorNumber: floorNum,
          flats,
        });
      }
    }

    const totalFlats =
      buildingType === 'Individual Home' || buildingType === 'Villa'
        ? totalFloors
        : totalFloors * flatsPerFloor;

    const building = new this.buildingModel({
      name,
      address,
      type: buildingType,
      totalFloors,
      flatsPerFloor:
        buildingType === 'Individual Home' || buildingType === 'Villa'
          ? 1
          : flatsPerFloor,
      floors,
      amenities: amenities || [],
      description,
      totalFlats,
      availableFlats: totalFlats,
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
   * Bulk assign residents to flats atomically.
   * assignments: [{ residentId?, residentEmail?, flatNumber }]
   */
  async bulkAssign(buildingId: string, assignments: Array<{ residentId?: string; residentEmail?: string; flatNumber: string }>) {
    const session = await this.buildingModel.db.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
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
          await resident.save({ session });
        }

        // Recalculate stats
        building.occupiedFlats = building.floors.reduce((count: number, floor: any) => {
          return count + floor.flats.filter((f: any) => f.status === FlatStatus.OCCUPIED).length;
        }, 0);
        building.availableFlats = building.totalFlats - building.occupiedFlats;

        result = await building.save({ session });
      });
      return { success: true };
    } finally {
      session.endSession();
    }
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

    const query = this.buildingModel.find().sort({ name: 1 });
    if (limit && page) {
      query.skip((page - 1) * limit).limit(limit);
    } else if (limit) {
      query.limit(limit);
    }

    const buildings = await query.exec();

    // Get all residents with building/flat info in one query
    const allResidents = await this.userModel
      .find({
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

  async getBuildingById(id: string) {
    const building = await this.buildingModel.findById(id).exec();
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Get all residents for this building in one query for better performance
    // Use case-insensitive matching for building name
    const allResidents = await this.userModel
      .find({
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
    // Use a mongoose session to make the assign operation atomic
    const session: ClientSession = await this.buildingModel.db.startSession();
    try {
      let resultBuilding;
      await session.withTransaction(async () => {
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

        // Update resident's building and flat info
        resident.building = updatedBuilding.name;
        resident.block = updatedBuilding.name;
        resident.flat = flatNumber;
        resident.flatNo = flatNumber;

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

        resultBuilding = await updatedBuilding.save({ session });
      });

      return resultBuilding;
    } finally {
      session.endSession();
    }
  }

  async unassignResidentFromFlat(buildingId: string, flatNumber: string) {
    // Use a mongoose session to make the unassign operation atomic
    const session: ClientSession = await this.buildingModel.db.startSession();
    try {
      let resultBuilding;
      await session.withTransaction(async () => {
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

        resultBuilding = await building.save({ session });
      });

      return resultBuilding;
    } finally {
      session.endSession();
    }
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
}
