import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SiteType } from '../../schemas/site-settings';

export class OperatingHoursDto {
  @ApiPropertyOptional({ example: '09:00' }) @IsString() open: string;
  @ApiPropertyOptional({ example: '19:00' }) @IsString() close: string;
  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] }) @IsOptional() @IsArray() @IsInt({ each: true }) days?: number[];
}

export class SiteSettingsDto {
  @ApiPropertyOptional({ description: 'Guard may approve without the host' })
  @IsOptional()
  @IsBoolean()
  guardCanApprove?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireHostApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireVisitorPhoto?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireIdProof?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  collectVehicleNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowGateQrSelfRegister?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 720 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  passValidityHours?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 720, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  autoCheckoutHours?: number | null;

  // ---- industry rules ----
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) allowedVisitTypes?: string[];
  @ApiPropertyOptional({ type: OperatingHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto | null;
  @ApiPropertyOptional({ enum: ['allow', 'guard_approval', 'block'] }) @IsOptional() @IsIn(['allow', 'guard_approval', 'block']) afterHoursPolicy?: 'allow' | 'guard_approval' | 'block';
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) @Max(100000) maxInside?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireConsent?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) termsText?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) maxPassDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyOverstay?: boolean;
}

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ enum: SiteType })
  @IsOptional()
  @IsEnum(SiteType)
  siteType?: SiteType;

  @ApiPropertyOptional({ type: SiteSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SiteSettingsDto)
  settings?: SiteSettingsDto;
}
