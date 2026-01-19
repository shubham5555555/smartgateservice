import { Controller, Get, Query, UseGuards, Request, Param, Delete } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
  async deleteMessage(@Param('id') id: string, @Request() req) {
    const success = await this.chatService.deleteMessage(id, req.user.userId);
    return { success };
  }
}
