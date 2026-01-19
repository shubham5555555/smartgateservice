import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentDocument = DocumentFile & Document;

export enum DocumentType {
  AADHAR = 'Aadhar',
  PAN = 'PAN',
  DRIVING_LICENSE = 'Driving License',
  VOTER_ID = 'Voter ID',
  PASSPORT = 'Passport',
  RC = 'RC',
  INSURANCE = 'Insurance',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class DocumentFile {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: DocumentType })
  documentType: DocumentType;

  @Prop({ required: true })
  documentNumber: string;

  @Prop({ required: true })
  fileUrl: string; // URL to document file

  @Prop()
  fileName?: string;

  @Prop()
  fileSize?: number;

  @Prop()
  expiryDate?: Date;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verifiedBy?: string; // Admin who verified

  @Prop()
  verifiedAt?: Date;

  @Prop()
  notes?: string;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentFile);
