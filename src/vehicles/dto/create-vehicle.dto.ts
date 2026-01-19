import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { VehicleType } from '../../schemas/vehicle.schema';

export class CreateVehicleDto {
  @IsNotEmpty({ message: 'Vehicle number is required' })
  @IsString()
  vehicleNumber: string;

  @IsNotEmpty({ message: 'Vehicle type is required' })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsNotEmpty({ message: 'Brand is required' })
  @IsString()
  brand: string;

  @IsNotEmpty({ message: 'Model is required' })
  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  rcNumber?: string;

  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  rcDocument?: string;

  @IsOptional()
  @IsString()
  insuranceDocument?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
