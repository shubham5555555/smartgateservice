import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ParkingSlot, ParkingSlotDocument } from '../schemas/parking-slot.schema';
import { ParkingApplication, ParkingApplicationDocument } from '../schemas/parking-application.schema';
import { CreateParkingApplicationDto } from './dto/create-application.dto';
import { ApplicationStatus } from '../schemas/parking-application.schema';

@Injectable()
export class ParkingService {
  constructor(
    @InjectModel(ParkingSlot.name) private slotModel: Model<ParkingSlotDocument>,
    @InjectModel(ParkingApplication.name) private applicationModel: Model<ParkingApplicationDocument>,
  ) {}

  async getMySlots(userId: string) {
    return this.slotModel.find({ assignedTo: new Types.ObjectId(userId) }).exec();
  }

  async createApplication(userId: string, createDto: CreateParkingApplicationDto) {
    // Generate application number
    const count = await this.applicationModel.countDocuments();
    const applicationNumber = `#SG-PRK-${String(count + 1).padStart(4, '0')}`;

    const application = new this.applicationModel({
      ...createDto,
      userId: new Types.ObjectId(userId),
      applicationNumber,
    });

    return application.save();
  }

  async getApplications(userId: string) {
    return this.applicationModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async getApplicationStatus(userId: string) {
    return this.getApplications(userId);
  }
}
