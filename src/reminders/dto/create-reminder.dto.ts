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
} from '../../schemas/reminder.schema';

export class CreateReminderDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReminderPriority)
  priority: ReminderPriority;

  @IsEnum(ReminderCategory)
  category: ReminderCategory;

  @IsDateString()
  dueDate: string;

  @IsMongoId()
  createdBy: string;

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
