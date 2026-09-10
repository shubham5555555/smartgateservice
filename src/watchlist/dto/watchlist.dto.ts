import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsMongoId, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WatchlistKind } from '../../schemas/watchlist.schema';

export class CreateWatchlistDto {
  @ApiProperty({ enum: WatchlistKind }) @IsEnum(WatchlistKind) kind: WatchlistKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 6) idProofLast4?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNumber?: string;
  @ApiProperty() @IsString() @Length(3, 300) reason: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) buildingIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateWatchlistDto {
  @ApiPropertyOptional({ enum: WatchlistKind }) @IsOptional() @IsEnum(WatchlistKind) kind?: WatchlistKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 6) idProofLast4?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 300) reason?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) buildingIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
