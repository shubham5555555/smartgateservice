import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Staff, StaffDocument, StaffStatus } from '../schemas/staff.schema';
import { StaffActivity, StaffActivityDocument, ActivityStatus } from '../schemas/staff-activity.schema';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
    @InjectModel(StaffActivity.name) private activityModel: Model<StaffActivityDocument>,
  ) {}

  async createStaff(userId: string, createStaffDto: CreateStaffDto) {
    try {
      // Check if staff with same phone already exists for this user
      const existingStaff = await this.staffModel.findOne({
        userId: new Types.ObjectId(userId),
        phoneNumber: createStaffDto.phoneNumber,
        isActive: true,
      });

      if (existingStaff) {
        throw new ConflictException('Staff with this phone number already exists for your account');
      }

      const staff = new this.staffModel({
        ...createStaffDto,
        userId: new Types.ObjectId(userId),
      });
      return await staff.save();
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create staff: ${error.message}`);
    }
  }

  async getStaffByUser(userId: string) {
    return this.staffModel.find({ userId: new Types.ObjectId(userId), isActive: true }).exec();
  }

  async getStaffById(staffId: string) {
    return this.staffModel.findById(staffId).exec();
  }

  async getStaffActivity(staffId: string, month?: number, year?: number) {
    const query: any = { staffId: new Types.ObjectId(staffId) };
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    return this.activityModel.find(query).sort({ date: -1 }).exec();
  }

  async checkIn(staffId: string) {
    const staff = await this.staffModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    staff.status = StaffStatus.INSIDE;
    await staff.save();

    // Create activity record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let activity = await this.activityModel.findOne({
      staffId: new Types.ObjectId(staffId),
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (!activity) {
      activity = new this.activityModel({
        staffId: new Types.ObjectId(staffId),
        date: today,
        checkInTime: new Date(),
        status: ActivityStatus.PRESENT,
      });
    } else {
      activity.checkInTime = new Date();
      activity.status = ActivityStatus.PRESENT;
    }

    await activity.save();
    return activity;
  }

  async checkOut(staffId: string) {
    const staff = await this.staffModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    staff.status = StaffStatus.OUTSIDE;
    await staff.save();

    // Update activity record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activity = await this.activityModel.findOne({
      staffId: new Types.ObjectId(staffId),
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (activity) {
      activity.checkOutTime = new Date();
      await activity.save();
    }

    return activity;
  }
}
