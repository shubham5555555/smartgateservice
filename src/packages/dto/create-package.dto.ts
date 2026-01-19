import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class CreatePackageDto {
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
}
