import { IsOptional, IsString, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { StaffType, StaffStatus } from '../../schemas/staff.schema';

export class UpdateStaffAdminDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsOptional()
  @IsEnum(StaffType, { message: 'Invalid staff type' })
  type?: StaffType;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  aadharNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
