import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VisitorType } from '../../schemas/visitor.schema';

export class SelfRegisterVisitorDto {
  @ApiProperty({
    description: 'Name of the visitor',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Phone number of the visitor',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Type of visitor',
    enum: VisitorType,
    example: VisitorType.GUEST,
  })
  @IsEnum(VisitorType)
  type: VisitorType;

  @ApiProperty({
    description: 'Resident email or ID to visit',
    example: 'resident@example.com',
  })
  @IsString()
  residentEmail: string;

  @ApiProperty({
    description: 'Purpose of visit',
    example: 'Meeting',
    required: false,
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    description: 'Expected date of visit',
    example: '2024-12-25',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Expected time of visit',
    example: '14:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  expectedTime?: string;
}
