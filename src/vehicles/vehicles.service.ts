import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vehicle, VehicleDocument } from '../schemas/vehicle.schema';
import { VehicleEntry, VehicleEntryDocument, EntryType } from '../schemas/vehicle-entry.schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(VehicleEntry.name) private entryModel: Model<VehicleEntryDocument>,
  ) {}

  async createVehicle(userId: string, createVehicleDto: CreateVehicleDto) {
    try {
      // Check if vehicle with same number already exists for this user
      const existingVehicle = await this.vehicleModel.findOne({
        userId: new Types.ObjectId(userId),
        vehicleNumber: createVehicleDto.vehicleNumber,
        isActive: true,
      });

      if (existingVehicle) {
        throw new ConflictException('Vehicle with this number already exists for your account');
      }

      const vehicle = new this.vehicleModel({
        ...createVehicleDto,
        userId: new Types.ObjectId(userId),
      });

      return await vehicle.save();
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create vehicle: ${error.message}`);
    }
  }

  async getVehiclesByUser(userId: string) {
    return this.vehicleModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getVehicleById(id: string) {
    const vehicle = await this.vehicleModel.findById(id).exec();
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  async recordEntry(vehicleId: string, entryType: string, gateNumber?: string, guardName?: string) {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const entry = new this.entryModel({
      vehicleId: new Types.ObjectId(vehicleId),
      userId: vehicle.userId,
      entryType: entryType === 'Entry' ? EntryType.ENTRY : EntryType.EXIT,
      gateNumber,
      guardName,
      timestamp: new Date(),
    });

    return entry.save();
  }

  async getVehicleEntries(vehicleId: string) {
    return this.entryModel
      .find({ vehicleId: new Types.ObjectId(vehicleId) })
      .sort({ timestamp: -1 })
      .exec();
  }
}
