import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsMongoId,
  IsArray,
} from 'class-validator';
import {
  ReminderPriority,
  ReminderCategory,
  ReminderStatus,
} from '../../schemas/reminder.schema';

export class UpdateReminderDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReminderPriority)
  @IsOptional()
  priority?: ReminderPriority;

  @IsEnum(ReminderCategory)
  @IsOptional()
  category?: ReminderCategory;

  @IsEnum(ReminderStatus)
  @IsOptional()
  status?: ReminderStatus;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  assignedTo?: string[];

  @IsMongoId()
  @IsOptional()
  relatedComplaint?: string;

  @IsMongoId()
  @IsOptional()
  relatedMaintenance?: string;

  @IsMongoId()
  @IsOptional()
  relatedEvent?: string;
}
