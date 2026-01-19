import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum, IsNumber, Min, IsBoolean, IsArray } from 'class-validator';
import { EventType, EventStatus } from '../../schemas/event.schema';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventType)
  @IsNotEmpty()
  type: EventType;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxAttendees?: number;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @IsOptional()
  invitedUsers?: string[];
}
