import {
  IsMongoId,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';

export enum ResidentType {
  OWNER = 'Owner',
  RENTED = 'Rented',
}

export enum BuildingType {
  BLOCK_A = 'Block A',
  BLOCK_B = 'Block B',
  BLOCK_C = 'Block C',
  BLOCK_D = 'Block D',
  INDIVIDUAL_HOME = 'Individual Home',
  TOWER_A = 'Tower A',
  TOWER_B = 'Tower B',
  TOWER_C = 'Tower C',
}

export class CreateResidentDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  fullName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsNotEmpty({ message: 'Flat/Unit number is required' })
  @IsString()
  flatNo: string;

  /** Building name as shown in the dashboard (any building of the builder). */
  @IsNotEmpty({ message: 'Building is required' })
  @IsString()
  building: string;

  /** Preferred: the building's id. Resolved from the name when omitted. */
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @IsEnum(ResidentType, { message: 'Invalid resident type' })
  @IsNotEmpty({ message: 'Resident type is required' })
  residentType: ResidentType;

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
