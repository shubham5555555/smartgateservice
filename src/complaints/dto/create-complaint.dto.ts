import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ComplaintPriority } from '../../schemas/complaint.schema';

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

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
