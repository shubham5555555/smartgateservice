import { IsEmail, IsOptional, IsEnum, IsString } from 'class-validator';
import { ResidentType, BuildingType } from './create-resident.dto';

export class UpdateResidentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  flatNo?: string;

  @IsOptional()
  @IsEnum(BuildingType, { message: 'Invalid building type' })
  building?: BuildingType;

  @IsOptional()
  @IsEnum(ResidentType, { message: 'Invalid resident type' })
  residentType?: ResidentType;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  aadharNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;
}
