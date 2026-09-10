import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
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
 * Body of the public gate-QR form. The same DTO serves both site types; which
 * fields are shown (and which are mandatory) comes from the site's settings,
 * and is enforced server-side in PublicVisitsService.
 */
export class CompanionDto {
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 6) idProofLast4?: string;
}

export class PublicVisitDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Length(6, 20)
  phoneNumber: string;

  @ApiPropertyOptional({ enum: VisitorType })
  @IsOptional()
  @IsEnum(VisitorType)
  type?: VisitorType;

  @ApiPropertyOptional({ description: 'Purpose of the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;

  // ---- residential: identify the host resident ----
  @ApiPropertyOptional({ description: 'Flat/unit number of the host resident' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  flatNumber?: string;

  @ApiPropertyOptional({ description: 'Block/wing of the host resident' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  block?: string;

  @ApiPropertyOptional({ description: 'Host resident email (alternative to flat)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  residentEmail?: string;

  // ---- commercial: free-text "whom to meet", no company records ----
  @ApiPropertyOptional({ example: 'Acme Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hostCompany?: string;

  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hostPersonName?: string;

  @ApiPropertyOptional({ example: '7' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hostFloor?: string;

  @ApiPropertyOptional({ example: '703' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hostUnit?: string;

  // ---- optional extras ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleNumber?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  guestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({ example: '14:30' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  expectedTime?: string;

  @ApiPropertyOptional({ description: 'S3 URL from the photo upload endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePhoto?: string;

  @ApiPropertyOptional({ example: 'Aadhaar' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  idProofType?: string;

  // ---- industry fields ----
  @ApiPropertyOptional({ description: 'Work order / PO / tracking / audit number' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @ApiPropertyOptional({ description: 'Phone of the person being visited' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hostPhone?: string;

  @ApiPropertyOptional({ description: 'Crew / group members' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanionDto)
  companions?: CompanionDto[];

  @ApiPropertyOptional({ description: 'Multi-day pass start (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Multi-day pass end (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'Visitor accepted the site terms' })
  @IsOptional()
  @IsBoolean()
  consentAccepted?: boolean;

  @ApiPropertyOptional({ example: '4821', description: 'Last 4 digits only' })
  @IsOptional()
  @IsString()
  @Length(3, 6)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'idProofLast4 must be letters or digits only' })
  idProofLast4?: string;
}
