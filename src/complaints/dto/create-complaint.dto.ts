import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsDateString,
} from 'class-validator';
import {
  ComplaintPriority,
  ComplaintCategory,
} from '../../schemas/complaint.schema';

export class CreateComplaintDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Description is required' })
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @IsNotEmpty({ message: 'Category is required' })
  @IsEnum(ComplaintCategory)
  category: ComplaintCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  estimatedTime?: number;
}
