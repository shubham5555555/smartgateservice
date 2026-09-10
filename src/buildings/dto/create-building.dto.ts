import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '../../schemas/property-types';

export class CreateBuildingDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  /** Legacy display label (Apartment, Villa, Commercial…); prefer propertyType. */
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  /** Super admins may create a building for any builder; others are stamped with their own. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  organizationId?: string;

  /** Floors for the floors model; number of units for the standalone model. */
  @IsOptional()
  @IsNumber()
  totalFloors?: number;

  @IsOptional()
  @IsNumber()
  flatsPerFloor?: number;

  /** Standalone model: number of villas / plots / houses (alias of totalFloors). */
  @IsOptional()
  @IsNumber()
  totalUnits?: number;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
