import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
    @Prop({ required: true, enum: ['User', 'Guard', 'Admin'] })
    recipientType: string;

    @Prop({ type: Types.ObjectId, required: false }) // Optional for 'Admin' or broadcast 'All' 
    recipientId?: Types.ObjectId;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    body: string;

    @Prop({ default: 'general' })
    type: string;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ type: Object })
    data?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
