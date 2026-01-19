import { IsNotEmpty, IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { StaffType } from '../../schemas/staff.schema';

export class CreateStaffDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsNotEmpty({ message: 'Staff type is required' })
  @IsEnum(StaffType, { message: 'Invalid staff type' })
  type: StaffType;

  @IsNotEmpty({ message: 'Role is required' })
  @IsString()
  role: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

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
  @IsString()
  notes?: string;
}
