import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// NOTE: the global ValidationPipe runs with `whitelist: true`, so a property
// without a validator is silently dropped. Every field here needs a decorator.

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Pvt Ltd' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Commercial building the office sits in' })
  @IsMongoId({ message: 'Pick the building this company sits in' })
  buildingId: string;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: ['401', '402'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  units?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'contactEmail must be a valid email' })
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Cap HR cannot exceed (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  employeeLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowEmployeeInvites?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  invitesNeedDesk?: boolean;
}

export class CompanySettingsDto {
  @IsOptional()
  @IsBoolean()
  allowEmployeeInvites?: boolean;

  @IsOptional()
  @IsBoolean()
  invitesNeedDesk?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  employeeLimit?: number;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  units?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'contactEmail must be a valid email' })
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: CompanySettingsDto })
  @IsOptional()
  settings?: CompanySettingsDto;
}
