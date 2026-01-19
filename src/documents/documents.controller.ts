import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async createDocument(@Request() req, @Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.createDocument(req.user.userId, createDocumentDto);
  }

  @Get()
  async getMyDocuments(@Request() req) {
    return this.documentsService.getDocumentsByUser(req.user.userId);
  }

  @Get(':id')
  async getDocumentById(@Param('id') id: string) {
    return this.documentsService.getDocumentById(id);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }
}
