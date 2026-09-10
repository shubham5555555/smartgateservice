import { Type } from 'class-transformer';
import { CompanionDto } from '../../visits/dto/public-visit.dto';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitorType } from '../../schemas/visitor.schema';

/**
 * Generic (non-poster) self-registration. Residential buildings need a host
 * resident (flat number or e-mail); commercial buildings need only whom the
 * visitor is meeting — no e-mail, the guard approves at the desk.
 */
export class SelfRegisterVisitorDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: VisitorType })
  @IsOptional()
  @IsEnum(VisitorType)
  type?: VisitorType;

  @ApiPropertyOptional({ description: 'Building being visited (preferred)' })
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  // ---- residential host ----
  @ApiPropertyOptional({ description: 'Host resident e-mail (residential, alternative to flatNumber)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  residentEmail?: string;

  @ApiPropertyOptional({ description: 'Flat / unit of the host resident (residential)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  flatNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) block?: string;

  // ---- commercial "whom to meet" ----
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) hostCompany?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) hostPersonName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) hostFloor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) hostUnit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) guestCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) idProofType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 6) @Matches(/^[A-Za-z0-9]+$/) idProofLast4?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) hostPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validUntil?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consentAccepted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompanionDto) companions?: CompanionDto[];

  @ApiPropertyOptional({ example: '2024-12-25' }) @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional({ example: '14:00' }) @IsOptional() @IsString() @MaxLength(5) expectedTime?: string;
}
