import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../schemas/vehicle.schema';

export class CreateVehicleDto {
  @ApiProperty({ 
    description: 'Vehicle registration number',
    example: 'MH12AB1234',
    required: true,
  })
  @IsNotEmpty({ message: 'Vehicle number is required' })
  @IsString()
  vehicleNumber: string;

  @ApiProperty({ 
    description: 'Type of vehicle',
    enum: VehicleType,
    example: VehicleType.CAR,
    required: true,
  })
  @IsNotEmpty({ message: 'Vehicle type is required' })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ 
    description: 'Vehicle brand',
    example: 'Toyota',
    required: true,
  })
  @IsNotEmpty({ message: 'Brand is required' })
  @IsString()
  brand: string;

  @ApiProperty({ 
    description: 'Vehicle model',
    example: 'Camry',
    required: true,
  })
  @IsNotEmpty({ message: 'Model is required' })
  @IsString()
  model: string;

  @ApiProperty({ 
    description: 'Vehicle color',
    example: 'White',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ 
    description: 'RC (Registration Certificate) number',
    example: 'RC123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  rcNumber?: string;

  @ApiProperty({ 
    description: 'Insurance policy number',
    example: 'INS123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @ApiProperty({ 
    description: 'Insurance expiry date (ISO 8601 format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiProperty({ 
    description: 'URL to RC document',
    example: 'https://example.com/rc.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  rcDocument?: string;

  @ApiProperty({ 
    description: 'URL to insurance document',
    example: 'https://example.com/insurance.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  insuranceDocument?: string;

  @ApiProperty({ 
    description: 'Additional notes',
    example: 'Parked in basement',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
