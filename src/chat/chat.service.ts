import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from '../schemas/chat.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
  ) {}

  async getMessages(limit: number = 50, before?: string): Promise<ChatMessageDocument[]> {
    const query: any = { isDeleted: false };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    return this.chatMessageModel
      .find(query)
      .populate('userId', 'fullName phoneNumber profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getMessageById(id: string): Promise<ChatMessageDocument | null> {
    return this.chatMessageModel
      .findById(id)
      .populate('userId', 'fullName phoneNumber profilePhoto')
      .exec();
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.chatMessageModel.findById(messageId).exec();
    if (message && !message.readBy.includes(userId as any)) {
      message.readBy.push(userId as any);
      await message.save();
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await this.chatMessageModel.findById(messageId).exec();
    if (message && message.userId.toString() === userId) {
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
      return true;
    }
    return false;
  }

  async editMessage(messageId: string, userId: string, newMessage: string): Promise<boolean> {
    const message = await this.chatMessageModel.findById(messageId).exec();
    if (message && message.userId.toString() === userId) {
      message.message = newMessage;
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();
      return true;
    }
    return false;
  }

  async getAllMessages(limit: number = 100): Promise<ChatMessageDocument[]> {
    return this.chatMessageModel
      .find({ isDeleted: false })
      .populate('userId', 'fullName phoneNumber profilePhoto building flatNo')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async deleteMessageByAdmin(messageId: string): Promise<boolean> {
    const message = await this.chatMessageModel.findById(messageId).exec();
    if (message) {
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
      return true;
    }
    return false;
  }
}
