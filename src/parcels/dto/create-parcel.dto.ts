import { IsNotEmpty, IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ParcelType } from '../../schemas/parcel.schema';

export class CreateParcelDto {
  @IsNotEmpty({ message: 'Tracking number is required' })
  @IsString()
  trackingNumber: string;

  @IsNotEmpty({ message: 'Recipient name is required' })
  @IsString()
  recipientName: string;

  @IsNotEmpty({ message: 'Recipient phone is required' })
  @IsString()
  recipientPhone: string;

  @IsOptional()
  @IsString()
  flatNumber?: string;

  @IsOptional()
  @IsEnum(ParcelType)
  parcelType?: ParcelType;

  @IsOptional()
  @IsString()
  deliveryCompany?: string;

  @IsOptional()
  @IsString()
  deliveryPersonName?: string;

  @IsOptional()
  @IsString()
  deliveryPersonPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  loggedBy?: string;
}
