import { IsNotEmpty, IsArray, IsString } from 'class-validator';

export class PayMaintenanceDto {
  @IsNotEmpty()
  @IsArray()
  maintenanceIds: string[];

  @IsNotEmpty()
  @IsString()
  paymentMethod: string;

  @IsNotEmpty()
  @IsString()
  transactionId: string;
}
