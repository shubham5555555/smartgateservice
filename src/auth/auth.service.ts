import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async sendOtp(loginDto: LoginDto) {
    const { phoneNumber } = loginDto;
    
    // Use default OTP for test phone number
    const TEST_PHONE = '9999999999';
    const DEFAULT_OTP = '123456';
    
    // Generate 6-digit OTP (or use default for test number)
    const otp = phoneNumber === TEST_PHONE ? DEFAULT_OTP : Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await this.userModel.findOne({ phoneNumber });
    
    if (!user) {
      user = new this.userModel({
        phoneNumber,
        otp,
        otpExpiresAt,
      });
    } else {
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
    }

    await user.save();

    // In production, send OTP via SMS service
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    return {
      message: 'OTP sent successfully',
      phoneNumber,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, otp } = verifyOtpDto;

    const user = await this.userModel.findOne({ phoneNumber });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('OTP expired');
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    // Generate JWT token
    const payload = { sub: user._id, phoneNumber: user.phoneNumber };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        fullName: user.fullName,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }
}
