import { Type } from 'class-transformer';
import { CompanionDto } from '../../visits/dto/public-visit.dto';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsObject,
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
 * Body for both `POST /admin/visitors` and the commercial one-shot
 * `POST /admin/visitors/checkin`. Superset of CreateVisitorDto.
 */
export class GuardCheckinDto {
  @ApiProperty()
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ enum: VisitorType })
  @IsEnum(VisitorType)
  type: VisitorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePhoto?: string;

  @ApiPropertyOptional({ description: 'Host resident (residential sites)' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Site the visitor is entering' })
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;

  // commercial free-text host
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hostCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hostPersonName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hostFloor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hostUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  idProofType?: string;

  @ApiPropertyOptional({ description: 'Last digits only — never the full ID' })
  @IsOptional()
  @IsString()
  @Length(3, 6)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'idProofLast4 must be letters or digits only' })
  idProofLast4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  idProofPhoto?: string;

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
  @IsBoolean()
  isPreApproved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gate?: string;

  // ---- industry fields ----
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) hostPhone?: string;
  @ApiPropertyOptional({ type: [CompanionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanionDto)
  companions?: CompanionDto[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validUntil?: string;
  @ApiPropertyOptional({ enum: ['normal', 'vip'] }) @IsOptional() @IsIn(['normal', 'vip']) priority?: 'normal' | 'vip';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consentAccepted?: boolean;
  /** Guard confirms a *warn* watchlist hit was reviewed. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() overrideWarning?: boolean;

  /** Courier types: log a parcel at the desk in the same step. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  parcel?: {
    trackingNumber?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientCompany?: string;
    recipientFloor?: string;
    recipientUnit?: string;
    parcelType?: string;
    storageLocation?: string;
    isPerishable?: boolean;
    notes?: string;
  };

  @ApiPropertyOptional({
    description: 'Approve only, without recording entry yet',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  checkInNow?: boolean;
}
