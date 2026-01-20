import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { MarketplaceChatService } from './marketplace-chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketplaceMessageType } from '../schemas/marketplace-chat-message.schema';

@ApiTags('Marketplace')
@ApiBearerAuth('JWT-auth')
@Controller('marketplace/chat')
@UseGuards(JwtAuthGuard)
export class MarketplaceChatController {
  constructor(private readonly chatService: MarketplaceChatService) {}

  @Post('listing/:listingId')
  async getOrCreateChat(@Param('listingId') listingId: string, @Request() req) {
    return this.chatService.getOrCreateChat(listingId, req.user.userId);
  }

  @Get('chats')
  async getMyChats(@Request() req) {
    return this.chatService.getChatsForUser(req.user.userId);
  }

  @Get(':chatId')
  async getChat(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.getChatById(chatId, req.user.userId);
  }

  @Get(':chatId/messages')
  async getMessages(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.getMessages(chatId, req.user.userId);
  }

  @Post(':chatId/message')
  async sendMessage(
    @Param('chatId') chatId: string,
    @Request() req,
    @Body() body: { type?: string; message?: string; imageUrl?: string; offerAmount?: number },
  ) {
    const messageType = (body.type as MarketplaceMessageType) || MarketplaceMessageType.TEXT;
    return this.chatService.sendMessage(
      chatId,
      req.user.userId,
      messageType,
      body.message,
      body.imageUrl,
      body.offerAmount,
    );
  }

  @Post(':chatId/read')
  async markAsRead(@Param('chatId') chatId: string, @Request() req) {
    await this.chatService.markAsRead(chatId, req.user.userId);
    return { success: true };
  }
}
