import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { VisitorType } from '../../schemas/visitor.schema';

export class CreateVisitorDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsNotEmpty()
  @IsEnum(VisitorType)
  type: VisitorType;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isPreApproved?: boolean;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number;
}
