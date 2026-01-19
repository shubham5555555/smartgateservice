import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentFile, DocumentDocument } from '../schemas/document.schema';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentFile.name) private documentModel: Model<DocumentDocument>,
  ) {}

  async createDocument(userId: string, createDocumentDto: CreateDocumentDto) {
    const document = new this.documentModel({
      ...createDocumentDto,
      userId: new Types.ObjectId(userId),
      isVerified: false,
    });

    return document.save();
  }

  async getDocumentsByUser(userId: string) {
    return this.documentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getDocumentById(id: string) {
    const document = await this.documentModel.findById(id).exec();
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async deleteDocument(id: string) {
    const document = await this.documentModel.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.documentModel.findByIdAndDelete(id).exec();
  }
}
