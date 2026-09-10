import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../../schemas/admin-user.schema';

export class CreateAdminUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @Length(8, 100) password: string;
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiProperty({ enum: AdminRole }) @IsEnum(AdminRole) role: AdminRole;

  @ApiPropertyOptional({ description: 'Required for builder_admin / building_manager' })
  @IsOptional()
  @IsMongoId()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'building_manager: the buildings they may manage' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  buildingIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ enum: AdminRole }) @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) buildingIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetAdminPasswordDto {
  @ApiProperty() @IsString() @Length(8, 100) newPassword: string;
}
