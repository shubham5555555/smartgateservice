import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitorType } from '../../schemas/visitor.schema';

/** An employee vouching for a guest coming to meet them. */
export class InviteVisitorDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: VisitorType, default: VisitorType.MEETING })
  @IsOptional()
  @IsEnum(VisitorType)
  type?: VisitorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ description: 'When they are expected' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;
}
