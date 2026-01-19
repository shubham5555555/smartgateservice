import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { DocumentType } from '../../schemas/document.schema';

export class CreateDocumentDto {
  @IsNotEmpty({ message: 'Document type is required' })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsNotEmpty({ message: 'Document number is required' })
  @IsString()
  documentNumber: string;

  @IsNotEmpty({ message: 'File URL is required' })
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  fileSize?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
