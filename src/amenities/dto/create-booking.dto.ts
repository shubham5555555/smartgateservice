import { IsNotEmpty, IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { AmenityType } from '../../schemas/amenity-booking.schema';

export class CreateBookingDto {
  @IsNotEmpty()
  @IsEnum(AmenityType)
  amenityType: AmenityType;

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
