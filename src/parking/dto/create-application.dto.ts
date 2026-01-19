import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ParkingType } from '../../schemas/parking-slot.schema';

export class CreateParkingApplicationDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(ParkingType)
  parkingType?: ParkingType;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
