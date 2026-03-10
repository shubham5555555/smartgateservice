import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginDto, VerifyOtpDto } from './dto/login.dto';
import {
  RegisterEmailDto,
  VerifyEmailOtpDto,
  CompleteProfileDto,
  LoginEmailDto,
  ForgotPasswordDto,
  VerifyPasswordResetOtpDto,
  ResetPasswordDto,
} from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../common/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async sendOtp(loginDto: LoginDto) {
    const { phoneNumber } = loginDto;

    // Use default OTP for test phone number
    const TEST_PHONE = '9999999999';
    const DEFAULT_OTP = '123456';

    // Generate 6-digit OTP (or use default for test number)
    const otp =
      phoneNumber === TEST_PHONE
        ? DEFAULT_OTP
        : Math.floor(100000 + Math.random() * 900000).toString();
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

  // ========== Email-based Registration Flow ==========

  /**
   * Step 1: Send email OTP for registration
   */
  async sendRegistrationEmailOtp(registerDto: RegisterEmailDto) {
    const { email } = registerDto;

    // Check if email already exists
    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const existingUsers = await this.userModel.find({ email }).limit(1).exec();
    const existingUser = existingUsers.length > 0 ? existingUsers[0] : null;
    if (existingUser && existingUser.isEmailVerified && existingUser.password) {
      throw new ConflictException(
        'Email already registered. Please login instead.',
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    let user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      user = new this.userModel({
        email,
        emailOtp: otp,
        emailOtpExpiresAt: otpExpiresAt,
        isEmailVerified: false,
        isApprovedByAdmin: false,
      });
    } else {
      user.emailOtp = otp;
      user.emailOtpExpiresAt = otpExpiresAt;
    }

    await user.save();

    // Send OTP via email
    await this.emailService.sendRegistrationOtp(email, otp);

    return {
      message: 'OTP sent successfully to your email',
      email,
    };
  }

  /**
   * Step 2: Verify email OTP
   */
  async verifyEmailOtp(verifyDto: VerifyEmailOtpDto) {
    const { email, otp } = verifyDto;

    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    const user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.emailOtpExpiresAt && new Date() > user.emailOtpExpiresAt) {
      throw new UnauthorizedException('OTP expired');
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiresAt = undefined;
    await user.save();

    // Generate temporary token for completing profile (valid for 1 hour)
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      isEmailVerified: true,
      purpose: 'complete-profile',
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

    return {
      message: 'Email verified successfully',
      email,
      emailVerified: true,
      accessToken, // Return token for completing profile
    };
  }

  /**
   * Step 3: Complete profile with password
   */
  async completeProfile(completeDto: CompleteProfileDto, email: string) {
    // Validate email format
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new BadRequestException('Invalid email address');
    }

    // Additional validation - reject common invalid values
    const trimmedEmail = email.trim().toLowerCase();
    if (
      trimmedEmail === 'pending' ||
      trimmedEmail === '' ||
      trimmedEmail === 'null' ||
      trimmedEmail === 'undefined'
    ) {
      throw new BadRequestException('Invalid email address provided');
    }

    // Explicitly query by email field only - prevent Mongoose from trying _id
    // Log the query to debug
    this.logger.debug(`Querying user with email: ${trimmedEmail}`);

    // Double-check email is not "pending" before querying
    if (trimmedEmail === 'pending') {
      this.logger.error(
        'Attempted to query with "pending" as email - this should have been caught earlier!',
      );
      throw new BadRequestException('Invalid email address provided');
    }

    // Use explicit query object - only query by email field
    // Do NOT include _id in the query to prevent Mongoose from trying to cast it
    // Use where() to be absolutely explicit about the field
    this.logger.debug(
      `Query object: ${JSON.stringify({ email: trimmedEmail })}`,
    );
    this.logger.debug(
      `trimmedEmail type: ${typeof trimmedEmail}, value: "${trimmedEmail}"`,
    );

    // CRITICAL FIX: Use MongoDB's native driver query to bypass Mongoose's query casting
    // Mongoose is somehow interpreting our query incorrectly, so we'll use the collection directly
    let userDoc;
    try {
      // Get the native MongoDB collection to bypass Mongoose's query transformation
      const collection = this.userModel.collection;

      // Use MongoDB's native findOne with explicit field specification
      const userData = await collection.findOne(
        { email: trimmedEmail },
        { projection: {} }, // Get all fields
      );

      if (!userData) {
        throw new UnauthorizedException('User not found');
      }

      // Validate _id before using it
      // MongoDB native query returns ObjectId, so we need to convert it to string for validation
      const userIdString = userData._id ? userData._id.toString() : null;
      if (
        !userIdString ||
        userIdString === 'pending' ||
        userIdString.length !== 24
      ) {
        this.logger.error(`Invalid _id from MongoDB query: ${userIdString}`);
        throw new BadRequestException(
          'Invalid user data retrieved from database',
        );
      }

      // Convert the raw MongoDB document to a Mongoose document
      userDoc = await this.userModel.findById(userData._id).exec();

      if (!userDoc) {
        throw new UnauthorizedException('User not found');
      }

      this.logger.debug(`User found via native query: ${userDoc.email}`);
    } catch (error) {
      this.logger.error(`Error querying user: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      this.logger.error(`Query was: email = ${trimmedEmail}`);

      // If it's still a cast error, something is very wrong
      if (error.message && error.message.includes('Cast to ObjectId')) {
        this.logger.error(
          'CRITICAL: Still getting ObjectId cast error even with native query!',
        );
        // Fallback: try one more time with explicit email query using aggregation
        try {
          const aggResult = await this.userModel
            .aggregate([{ $match: { email: trimmedEmail } }, { $limit: 1 }])
            .exec();

          if (aggResult.length === 0) {
            throw new UnauthorizedException('User not found');
          }

          // Validate _id before using it
          // Aggregation returns ObjectId, so we need to convert it to string for validation
          const aggUserIdString = aggResult[0]._id
            ? aggResult[0]._id.toString()
            : null;
          if (
            !aggUserIdString ||
            aggUserIdString === 'pending' ||
            aggUserIdString.length !== 24
          ) {
            this.logger.error(
              `Invalid _id from aggregation: ${aggUserIdString}`,
            );
            throw new BadRequestException(
              'Invalid user data retrieved from database',
            );
          }

          userDoc = await this.userModel.findById(aggResult[0]._id).exec();
          this.logger.debug(
            'Successfully found user using aggregation fallback',
          );
        } catch (aggError) {
          this.logger.error(
            `Aggregation fallback also failed: ${aggError.message}`,
          );
          throw new BadRequestException(
            `Failed to query user: ${error.message}`,
          );
        }
      } else {
        throw new BadRequestException(`Failed to query user: ${error.message}`);
      }
    }

    this.logger.debug(`User found: ${userDoc ? 'yes' : 'no'}`);

    if (!userDoc) {
      throw new UnauthorizedException('User not found');
    }

    if (!userDoc.isEmailVerified) {
      throw new BadRequestException(
        'Email not verified. Please verify your email first.',
      );
    }

    if (userDoc.password) {
      throw new ConflictException('Profile already completed');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(completeDto.password, 10);

    // Update user profile
    userDoc.fullName = completeDto.fullName;
    userDoc.password = hashedPassword;
    userDoc.role = completeDto.role as any;
    userDoc.block = completeDto.block;
    userDoc.flat = completeDto.flat;
    userDoc.flatNo = completeDto.flat;
    userDoc.phoneNumber = completeDto.phoneNumber;
    userDoc.isProfileComplete = true;
    // isApprovedByAdmin remains false - admin needs to approve

    await userDoc.save();

    return {
      message: 'Profile completed successfully. Waiting for admin approval.',
      user: {
        id: userDoc._id,
        email: userDoc.email,
        fullName: userDoc.fullName,
        isEmailVerified: userDoc.isEmailVerified,
        isApprovedByAdmin: userDoc.isApprovedByAdmin,
      },
    };
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(loginDto: LoginEmailDto) {
    const { email, password } = loginDto;

    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    const user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please verify your email first.',
      );
    }

    if (!user.isApprovedByAdmin) {
      throw new UnauthorizedException(
        'Your account is pending admin approval. Please wait for approval.',
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Password not set. Please complete your profile.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const payload = { sub: user._id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }

  // ========== Password Reset Flow ==========

  /**
   * Send password reset OTP
   */
  async sendPasswordResetOtp(forgotDto: ForgotPasswordDto) {
    const { email } = forgotDto;

    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    const user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      // Don't reveal if email exists for security
      return {
        message: 'If the email exists, a password reset OTP has been sent',
      };
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException('Email not verified');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetOtp = otp;
    user.passwordResetOtpExpiresAt = otpExpiresAt;
    await user.save();

    // Send OTP via email
    await this.emailService.sendPasswordResetOtp(email, otp);

    return {
      message: 'If the email exists, a password reset OTP has been sent',
    };
  }

  /**
   * Verify password reset OTP
   */
  async verifyPasswordResetOtp(verifyDto: VerifyPasswordResetOtpDto) {
    const { email, otp } = verifyDto;

    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    const user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordResetOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (
      user.passwordResetOtpExpiresAt &&
      new Date() > user.passwordResetOtpExpiresAt
    ) {
      throw new UnauthorizedException('OTP expired');
    }

    return {
      message: 'OTP verified successfully',
      email,
      otpVerified: true,
    };
  }

  /**
   * Reset password
   */
  async resetPassword(resetDto: ResetPasswordDto) {
    const { email, otp, newPassword } = resetDto;

    // Use find().limit(1) to avoid any potential Mongoose issues with findOne
    const userResults = await this.userModel.find({ email }).limit(1).exec();
    const user = userResults.length > 0 ? userResults[0] : null;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordResetOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (
      user.passwordResetOtpExpiresAt &&
      new Date() > user.passwordResetOtpExpiresAt
    ) {
      throw new UnauthorizedException('OTP expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    user.password = hashedPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    await user.save();

    return {
      message: 'Password reset successfully',
    };
  }
}
