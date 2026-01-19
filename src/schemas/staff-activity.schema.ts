import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StaffActivityDocument = StaffActivity & Document;

export enum ActivityStatus {
  PRESENT = 'Present',
  ABSENT = 'Absent',
}

@Schema({ timestamps: true })
export class StaffActivity {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Staff' })
  staffId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop()
  checkInTime?: Date;

  @Prop()
  checkOutTime?: Date;

  @Prop({ enum: ActivityStatus, default: ActivityStatus.ABSENT })
  status: ActivityStatus;
}

export const StaffActivitySchema = SchemaFactory.createForClass(StaffActivity);
