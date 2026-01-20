import { Controller, Get, Query, UseGuards, Request, Param, Delete, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('messages')
  async getMessages(@Query('limit') limit?: string, @Query('before') before?: string) {
    const messageLimit = limit ? parseInt(limit, 10) : 50;
    return this.chatService.getMessages(messageLimit, before);
  }

  @Get('messages/:id')
  async getMessage(@Param('id') id: string) {
    return this.chatService.getMessageById(id);
  }

  @Delete('messages/:id')
  @ApiOperation({ 
    summary: 'Delete chat message',
    description: 'Deletes a chat message. Only the message author can delete their messages.',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Message deleted successfully',
  })
  async deleteMessage(@Param('id') id: string, @Request() req) {
    const success = await this.chatService.deleteMessage(id, req.user.userId);
    return { success };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ 
    summary: 'Upload chat image',
    description: 'Uploads an image for chat messages to Cloudinary. Returns the image URL to use in chat messages.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'Image uploaded successfully',
    schema: {
      example: {
        imageUrl: 'https://res.cloudinary.com/dbfphetiv/image/upload/v1234567890/chat/images/image.jpg',
      },
    },
  })
  async uploadChatImage(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const imageUrl = await this.cloudinaryService.uploadChatImage(file);
    return { imageUrl };
  }

  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: 'Upload chat file',
    description: 'Uploads a file for chat messages to Cloudinary. Returns the file URL to use in chat messages.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    schema: {
      example: {
        fileUrl: 'https://res.cloudinary.com/dbfphetiv/raw/upload/v1234567890/chat/files/document.pdf',
        fileName: 'document.pdf',
        fileSize: 1024000,
      },
    },
  })
  async uploadChatFile(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileUrl = await this.cloudinaryService.uploadChatFile(file);
    return {
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }
}
