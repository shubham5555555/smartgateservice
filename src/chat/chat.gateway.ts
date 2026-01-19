import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageDocument } from '../schemas/chat.schema';
import { User, UserDocument } from '../schemas/user.schema';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, { userId: string; userName: string; socketId: string }>();

  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('❌ No token provided');
        client.disconnect();
        return;
      }

      let payload;
      try {
        payload = this.jwtService.verify(token);
      } catch (error) {
        console.error('❌ JWT verification failed:', error);
        client.disconnect();
        return;
      }

      // JWT payload might have 'sub' or 'userId'
      const userId = payload.userId || payload.sub;
      if (!userId) {
        console.error('❌ No userId in JWT payload');
        client.disconnect();
        return;
      }

      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        console.error('❌ User not found:', userId);
        client.disconnect();
        return;
      }

      client.userId = userId;
      client.userName = user.fullName || user.phoneNumber;

      // Store connected user
      this.connectedUsers.set(client.id, {
        userId: userId,
        userName: client.userName,
        socketId: client.id,
      });

      // Notify others that user is online
      client.broadcast.emit('userOnline', {
        userId: userId,
        userName: client.userName,
      });

      // Send list of online users to the newly connected user
      const onlineUsers = Array.from(this.connectedUsers.values()).map((u) => ({
        userId: u.userId,
        userName: u.userName,
      }));
      client.emit('onlineUsers', onlineUsers);

      console.log(`✅ User connected: ${client.userName} (${client.id})`);
    } catch (error) {
      console.error('❌ Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.connectedUsers.delete(client.id);
      
      // Notify others that user is offline
      client.broadcast.emit('userOffline', {
        userId: user.userId,
        userName: user.userName,
      });

      console.log(`User disconnected: ${user.userName} (${client.id})`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { message: string; type?: string; imageUrl?: string; fileUrl?: string; fileName?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const user = await this.userModel.findById(client.userId).exec();
      
      const chatMessage = new this.chatMessageModel({
        userId: client.userId,
        userName: user?.fullName || user?.phoneNumber || 'Unknown',
        userPhoto: user?.profilePhoto,
        type: data.type || 'text',
        message: data.message,
        imageUrl: data.imageUrl,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
      });

      const savedMessage = await chatMessage.save();
      const populatedMessage = await this.chatMessageModel
        .findById(savedMessage._id)
        .populate('userId', 'fullName phoneNumber profilePhoto')
        .exec();

      if (!populatedMessage) {
        return { error: 'Failed to save message' };
      }

      // Broadcast message to all connected clients
      this.server.emit('newMessage', {
        id: populatedMessage._id.toString(),
        userId: populatedMessage.userId,
        userName: populatedMessage.userName,
        userPhoto: populatedMessage.userPhoto,
        type: populatedMessage.type,
        message: populatedMessage.message,
        imageUrl: populatedMessage.imageUrl,
        fileUrl: populatedMessage.fileUrl,
        fileName: populatedMessage.fileName,
        createdAt: (populatedMessage as any).createdAt || new Date(),
        readBy: populatedMessage.readBy,
        isEdited: populatedMessage.isEdited,
      });

      return { success: true, messageId: savedMessage._id };
    } catch (error) {
      console.error('Error sending message:', error);
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const message = await this.chatMessageModel.findById(data.messageId).exec();
      if (message && !message.readBy.includes(client.userId as any)) {
        message.readBy.push(client.userId as any);
        await message.save();
        
        // Notify others that message was read
        this.server.emit('messageRead', {
          messageId: data.messageId,
          userId: client.userId,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking as read:', error);
      return { error: 'Failed to mark as read' };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { isTyping: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return;
    }

    const user = this.connectedUsers.get(client.id);
    if (user) {
      client.broadcast.emit('userTyping', {
        userId: client.userId,
        userName: user.userName,
        isTyping: data.isTyping,
      });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const message = await this.chatMessageModel.findById(data.messageId).exec();
      if (message && message.userId.toString() === client.userId) {
        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        // Notify all clients
        this.server.emit('messageDeleted', {
          messageId: data.messageId,
        });

        return { success: true };
      }

      return { error: 'Not authorized or message not found' };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { error: 'Failed to delete message' };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; newMessage: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const message = await this.chatMessageModel.findById(data.messageId).exec();
      if (message && message.userId.toString() === client.userId) {
        message.message = data.newMessage;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        // Notify all clients
        this.server.emit('messageEdited', {
          messageId: data.messageId,
          newMessage: data.newMessage,
          editedAt: message.editedAt,
        });

        return { success: true };
      }

      return { error: 'Not authorized or message not found' };
    } catch (error) {
      console.error('Error editing message:', error);
      return { error: 'Failed to edit message' };
    }
  }
}
