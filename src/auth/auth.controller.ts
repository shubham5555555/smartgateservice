import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
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
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description:
      'Sends a 6-digit OTP to the provided phone number for authentication. The OTP is valid for 5 minutes.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number format',
  })
  async sendOtp(@Body() loginDto: LoginDto) {
    return this.authService.sendOtp(loginDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and get access token',
    description:
      'Verifies the OTP code and returns a JWT access token if valid. The token is required for authenticated endpoints.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '507f1f77bcf86cd799439011',
          phoneNumber: '9876543210',
          fullName: 'John Doe',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  // ========== Email-based Registration Flow ==========

  @Post('register/send-email-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send email OTP for registration',
    description:
      'Sends a 6-digit OTP to the provided email address for registration. Step 1 of the registration process.',
  })
  @ApiBody({ type: RegisterEmailDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async sendRegistrationEmailOtp(@Body() registerDto: RegisterEmailDto) {
    return this.authService.sendRegistrationEmailOtp(registerDto);
  }

  @Post('register/verify-email-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email OTP',
    description:
      'Verifies the email OTP code. Step 2 of the registration process.',
  })
  @ApiBody({ type: VerifyEmailOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async verifyEmailOtp(@Body() verifyDto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(verifyDto);
  }

  @Post('register/complete-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Complete profile after email verification',
    description:
      'Completes the user profile with password and other details. Step 3 of the registration process. Requires token from email verification.',
  })
  @ApiBody({ type: CompleteProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile completed successfully. Waiting for admin approval.',
  })
  @ApiResponse({
    status: 400,
    description: 'Email not verified or profile already completed',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing token',
  })
  async completeProfile(
    @Body() completeDto: CompleteProfileDto,
    @Request() req,
  ) {
    // Get email from JWT token (set during email verification)
    let email = req.user?.email || completeDto.email;

    // Validate email exists and is valid
    if (!email || typeof email !== 'string') {
      throw new UnauthorizedException(
        'Invalid email. Please verify your email first.',
      );
    }

    email = email.trim().toLowerCase();

    // Validate email format - strict validation
    if (
      email === '' ||
      email === 'pending' ||
      email === 'null' ||
      email === 'undefined' ||
      !email.includes('@') ||
      !email.includes('.') ||
      email.length < 5
    ) {
      throw new UnauthorizedException(
        'Invalid email format. Please verify your email first.',
      );
    }

    // Verify token purpose
    if (!req.user || req.user.purpose !== 'complete-profile') {
      throw new UnauthorizedException(
        'Invalid token. Please verify your email first.',
      );
    }

    // Ensure completeDto.email matches the token email (if provided)
    if (completeDto.email && completeDto.email.trim().toLowerCase() !== email) {
      throw new UnauthorizedException(
        'Email mismatch. Please use the email you verified.',
      );
    }

    return this.authService.completeProfile(completeDto, email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates user with email and password. Returns JWT token if credentials are valid and user is approved by admin.',
  })
  @ApiBody({ type: LoginEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          fullName: 'John Doe',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account not approved',
  })
  async loginWithEmail(@Body() loginDto: LoginEmailDto) {
    return this.authService.loginWithEmail(loginDto);
  }

  // ========== Password Reset Flow ==========

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send password reset OTP',
    description: "Sends a password reset OTP to the user's email address.",
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'If email exists, OTP sent successfully',
  })
  async sendPasswordResetOtp(@Body() forgotDto: ForgotPasswordDto) {
    return this.authService.sendPasswordResetOtp(forgotDto);
  }

  @Post('verify-password-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify password reset OTP',
    description: 'Verifies the password reset OTP code.',
  })
  @ApiBody({ type: VerifyPasswordResetOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async verifyPasswordResetOtp(@Body() verifyDto: VerifyPasswordResetOtpDto) {
    return this.authService.verifyPasswordResetOtp(verifyDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets the user password after OTP verification.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto);
  }
}
