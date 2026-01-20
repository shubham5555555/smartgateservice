import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MarketplaceChat, MarketplaceChatDocument } from '../schemas/marketplace-chat.schema';
import { MarketplaceChatMessage, MarketplaceChatMessageDocument, MarketplaceMessageType } from '../schemas/marketplace-chat-message.schema';
import { MarketplaceListing } from '../schemas/marketplace-listing.schema';

@Injectable()
export class MarketplaceChatService {
  constructor(
    @InjectModel(MarketplaceChat.name)
    private chatModel: Model<MarketplaceChatDocument>,
    @InjectModel(MarketplaceChatMessage.name)
    private messageModel: Model<MarketplaceChatMessageDocument>,
    @InjectModel(MarketplaceListing.name)
    private listingModel: Model<any>,
  ) {}

  async getOrCreateChat(listingId: string, buyerId: string) {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const sellerId = listing.userId.toString();

    if (sellerId === buyerId) {
      throw new BadRequestException('You cannot chat with yourself');
    }

    // Try to find existing chat
    let chat = await this.chatModel
      .findOne({
        listingId: new Types.ObjectId(listingId),
        buyerId: new Types.ObjectId(buyerId),
      })
      .populate('sellerId', 'fullName phoneNumber profilePhoto')
      .populate('buyerId', 'fullName phoneNumber profilePhoto')
      .populate('listingId', 'title price images')
      .exec();

    if (!chat) {
      // Create new chat
      chat = new this.chatModel({
        listingId: new Types.ObjectId(listingId),
        sellerId: new Types.ObjectId(sellerId),
        buyerId: new Types.ObjectId(buyerId),
        isActive: true,
      });
      await chat.save();
      chat = await this.chatModel
        .findById(chat._id)
        .populate('sellerId', 'fullName phoneNumber profilePhoto')
        .populate('buyerId', 'fullName phoneNumber profilePhoto')
        .populate('listingId', 'title price images')
        .exec();
    }

    return chat;
  }

  async getChatsForUser(userId: string) {
    return this.chatModel
      .find({
        $or: [
          { sellerId: new Types.ObjectId(userId) },
          { buyerId: new Types.ObjectId(userId) },
        ],
        isActive: true,
      })
      .populate('sellerId', 'fullName phoneNumber profilePhoto')
      .populate('buyerId', 'fullName phoneNumber profilePhoto')
      .populate('listingId', 'title price images status')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();
  }

  async getChatById(chatId: string, userId: string) {
    const chat = await this.chatModel
      .findById(chatId)
      .populate('sellerId', 'fullName phoneNumber profilePhoto')
      .populate('buyerId', 'fullName phoneNumber profilePhoto')
      .populate('listingId', 'title price images status')
      .exec();

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Verify user is part of this chat
    const sellerId = (chat.sellerId as any)._id.toString();
    const buyerId = (chat.buyerId as any)._id.toString();

    if (sellerId !== userId && buyerId !== userId) {
      throw new BadRequestException('You do not have access to this chat');
    }

    return chat;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    type: MarketplaceMessageType,
    message?: string,
    imageUrl?: string,
    offerAmount?: number,
  ) {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Verify sender is part of this chat
    const sellerId = chat.sellerId.toString();
    const buyerId = chat.buyerId.toString();

    if (senderId !== sellerId && senderId !== buyerId) {
      throw new BadRequestException('You cannot send messages to this chat');
    }

    const chatMessage = new this.messageModel({
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(senderId),
      type,
      message,
      imageUrl,
      offerAmount,
    });

    await chatMessage.save();

    // Update chat's last message time
    await this.chatModel.findByIdAndUpdate(chatId, {
      lastMessageAt: new Date(),
      $push: { messages: chatMessage._id },
    });

    return this.messageModel
      .findById(chatMessage._id)
      .populate('senderId', 'fullName phoneNumber profilePhoto')
      .exec();
  }

  async getMessages(chatId: string, userId: string) {
    const chat = await this.getChatById(chatId, userId);

    const messages = await this.messageModel
      .find({ chatId: new Types.ObjectId(chatId) })
      .populate('senderId', 'fullName phoneNumber profilePhoto')
      .sort({ createdAt: 1 })
      .exec();

    // Mark messages as read
    await this.messageModel.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return messages;
  }

  async markAsRead(chatId: string, userId: string) {
    await this.messageModel.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );
  }
}
