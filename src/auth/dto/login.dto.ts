import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits' })
  phoneNumber: string;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits' })
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}
