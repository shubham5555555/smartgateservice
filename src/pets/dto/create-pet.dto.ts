import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';
import { PetType } from '../../schemas/pet.schema';

export class CreatePetDto {
  @IsString()
  name: string;

  @IsEnum(PetType)
  type: PetType;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  vaccinationRecords?: string[];

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  microchipNumber?: string;

  @IsOptional()
  @IsDateString()
  lastVaccinationDate?: string;

  @IsOptional()
  @IsDateString()
  nextVaccinationDate?: string;
}
