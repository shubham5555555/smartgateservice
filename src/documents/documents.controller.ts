import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create document with file URL',
    description: 'Creates a document record. Use the upload endpoint first to get the file URL.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Document created successfully',
  })
  async createDocument(@Request() req, @Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.createDocument(req.user.userId, createDocumentDto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: 'Upload document file',
    description: 'Uploads a document file to Cloudinary and returns the file URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'Document uploaded successfully',
    schema: {
      example: {
        fileUrl: 'https://res.cloudinary.com/dbfphetiv/raw/upload/v1234567890/documents/file.pdf',
        fileName: 'document.pdf',
        fileSize: 1024000,
      },
    },
  })
  async uploadDocument(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileUrl = await this.cloudinaryService.uploadDocument(file);
    
    return {
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
    };
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
