import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        ...updateProfileDto,
        isProfileComplete: true,
      },
      { new: true },
    );
    return user;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'FCM token updated successfully', fcmToken: user.fcmToken };
  }
}
