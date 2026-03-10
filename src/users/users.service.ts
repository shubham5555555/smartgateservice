import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  Building,
  BuildingDocument,
  FlatStatus,
} from '../schemas/building.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
  ) {}

  async getProfile(userId: string) {
    // Validate userId is a valid ObjectId format
    if (
      !userId ||
      userId === 'pending' ||
      typeof userId !== 'string' ||
      userId.length !== 24
    ) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    // Validate userId is a valid ObjectId format
    if (
      !userId ||
      userId === 'pending' ||
      typeof userId !== 'string' ||
      userId.length !== 24
    ) {
      throw new NotFoundException('Invalid user ID');
    }

    const updateData: any = {
      ...updateProfileDto,
      isProfileComplete: true,
    };

    // If building and flat are provided, update building flat status
    if (updateProfileDto.building && updateProfileDto.flat) {
      const building = await this.buildingModel
        .findOne({ name: updateProfileDto.building })
        .exec();
      if (building) {
        // Find and update the flat
        for (const floor of building.floors) {
          const flat = floor.flats.find(
            (f) => f.flatNumber === updateProfileDto.flat,
          );
          if (flat) {
            // Unassign previous resident if any
            if (flat.residentId && flat.residentId !== userId) {
              const prevResident = await this.userModel
                .findById(flat.residentId)
                .exec();
              if (prevResident) {
                prevResident.building = undefined;
                prevResident.block = undefined;
                prevResident.flat = undefined;
                prevResident.flatNo = undefined;
                await prevResident.save();
              }
            }

            flat.status = FlatStatus.OCCUPIED;
            flat.residentId = userId;
            flat.residentName = updateProfileDto.fullName || undefined;
            flat.residentEmail = updateProfileDto.email || undefined;
            flat.residentPhone = updateProfileDto.phoneNumber || undefined;

            // Update building statistics
            building.occupiedFlats = building.floors.reduce((count, f) => {
              return (
                count +
                f.flats.filter((fl) => fl.status === FlatStatus.OCCUPIED).length
              );
            }, 0);
            building.availableFlats =
              building.totalFlats - building.occupiedFlats;

            await building.save();
            break;
          }
        }
      }
    }

    const user = await this.userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    return user;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    // Validate userId is a valid ObjectId format
    if (
      !userId ||
      userId === 'pending' ||
      typeof userId !== 'string' ||
      userId.length !== 24
    ) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      message: 'FCM token updated successfully',
      fcmToken: user.fcmToken,
    };
  }
}
