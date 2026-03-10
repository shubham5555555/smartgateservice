import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  amenityId?: string;

  @IsNotEmpty()
  @IsString()
  amenityType: string;

  @IsNotEmpty()
  @IsDateString()
  bookingDate: string;

  @IsNotEmpty()
  @IsString()
  timeSlot: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
