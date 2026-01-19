import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop()
  userPhoto?: string;

  @Prop({ required: true, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ required: true })
  message: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  fileUrl?: string;

  @Prop()
  fileName?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy: Types.ObjectId[];

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Index for faster queries
ChatMessageSchema.index({ createdAt: -1 });
ChatMessageSchema.index({ userId: 1 });
