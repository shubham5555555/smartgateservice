import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from '../schemas/user.schema';
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
  ) { }

  async getProfile(userId: string) {
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
        for (const floor of building.floors) {
          const flat = floor.flats.find(
            (f) => f.flatNumber === updateProfileDto.flat,
          );
          if (flat) {
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

    // Auto-propagate building/flat details to all sub-users (family members & tenants)
    if (user && (updateProfileDto.building || updateProfileDto.flat || updateProfileDto.block || updateProfileDto.flatNo)) {
      const propagateFields: any = {};
      if (user.building !== undefined) propagateFields.building = user.building;
      if (user.block !== undefined) propagateFields.block = user.block;
      if (user.flat !== undefined) propagateFields.flat = user.flat;
      if (user.flatNo !== undefined) propagateFields.flatNo = user.flatNo;

      if (Object.keys(propagateFields).length > 0) {
        await this.userModel.updateMany(
          { parentUserId: userId },
          { $set: propagateFields },
        );
      }
    }

    return user;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
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

  async createSubUser(ownerId: string, data: any) {
    const owner = await this.getProfile(ownerId);

    if (owner.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only Owners can add family members or tenants');
    }

    const { fullName, phoneNumber, email, role, relation, password } = data;

    const subUserData: any = {
      fullName,
      phoneNumber,
      email: email ? email.toLowerCase() : undefined,
      role,
      relation,
      parentUserId: ownerId,
      // Always inherit owner's building details
      block: owner.block,
      flat: owner.flat,
      flatNo: owner.flatNo,
      building: owner.building,
      isProfileComplete: true,
      isApprovedByAdmin: true,
      isEmailVerified: !!email,
    };

    if (password) {
      subUserData.password = await bcrypt.hash(password, 10);
    }

    const newSubUser = new this.userModel(subUserData);
    await newSubUser.save();

    return {
      message: `${role} added successfully`,
      user: newSubUser,
    };
  }

  async getSubUsers(ownerId: string) {
    return this.userModel.find({ parentUserId: ownerId }).select(
      '_id fullName email phoneNumber role relation parentUserId building block flat flatNo isEmailVerified isApprovedByAdmin createdAt'
    );
  }

  async deleteSubUser(ownerId: string, subUserId: string) {
    const subUser = await this.userModel.findById(subUserId);
    if (!subUser) {
      throw new NotFoundException('Member not found');
    }
    if (subUser.parentUserId !== ownerId) {
      throw new ForbiddenException('You do not have permission to delete this member');
    }
    await this.userModel.findByIdAndDelete(subUserId);
    return { message: 'Member deleted successfully' };
  }

  async setSubUserPassword(ownerId: string, subUserId: string, email: string, password: string) {
    const subUser = await this.userModel.findById(subUserId);
    if (!subUser) {
      throw new NotFoundException('Member not found');
    }
    if (subUser.parentUserId !== ownerId) {
      throw new ForbiddenException('You do not have permission to update this member');
    }
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const existing = await this.userModel.findOne({
      email: email.toLowerCase(),
      _id: { $ne: subUserId },
    });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updated = await this.userModel.findByIdAndUpdate(
      subUserId,
      {
        email: email.toLowerCase(),
        password: hashedPassword,
        isEmailVerified: true,
        normalizedEmail: email.toLowerCase(),
      },
      { new: true },
    );

    return {
      message: 'Login credentials set successfully',
      email: updated?.email,
    };
  }
}
