import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

export enum ComplaintPriority {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum ComplaintStatus {
  OPEN = 'Open',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  ON_HOLD = 'On Hold',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
  REJECTED = 'Rejected',
}

export enum ComplaintCategory {
  PLUMBING = 'Plumbing',
  ELECTRICAL = 'Electrical',
  CIVIL_WORK = 'Civil Work',
  CARPENTRY = 'Carpentry',
  PAINTING = 'Painting',
  CLEANING = 'Cleaning',
  SECURITY = 'Security',
  LIFT = 'Lift',
  PEST_CONTROL = 'Pest Control',
  GARDEN = 'Garden/Landscaping',
  PARKING = 'Parking',
  WATER_SUPPLY = 'Water Supply',
  GARBAGE = 'Garbage/Waste',
  NOISE = 'Noise Complaint',
  OTHER = 'Other',
}

export enum EscalationLevel {
  LEVEL_1 = 'Level 1 - Maintenance Team',
  LEVEL_2 = 'Level 2 - Society Manager',
  LEVEL_3 = 'Level 3 - Admin/Committee',
}

export interface EscalationConfig {
  level1: number; // Hours before escalating to Level 1 (Maintenance)
  level2: number; // Hours before escalating to Level 2 (Manager)
  level3: number; // Hours before escalating to Level 3 (Admin)
}

@Schema({ timestamps: true })
export class Complaint {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: ComplaintPriority, default: ComplaintPriority.MEDIUM })
  priority: ComplaintPriority;

  @Prop({ enum: ComplaintStatus, default: ComplaintStatus.OPEN })
  status: ComplaintStatus;

  @Prop({ required: true })
  flatNo: string;

  @Prop({ required: true })
  block: string;

  @Prop({ type: Types.ObjectId, ref: 'Staff' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Staff' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  notes?: string;

  @Prop({ type: [String], default: [] })
  attachments?: string[]; // URLs to photos/videos

  @Prop({ enum: ComplaintCategory, required: true })
  category: ComplaintCategory;

  @Prop()
  dueDate?: Date; // Expected resolution date

  @Prop()
  resolvedAt?: Date; // When it was actually resolved

  @Prop()
  estimatedTime?: number; // Estimated time to resolve in hours

  @Prop({
    type: [
      {
        action: String,
        comment: String,
        by: { type: Types.ObjectId, ref: 'Staff' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  history?: Array<{
    action: string;
    comment?: string;
    by?: Types.ObjectId;
    timestamp: Date;
  }>;

  @Prop({
    type: [
      {
        comment: String,
        by: { type: Types.ObjectId, ref: 'User' },
        byStaff: { type: Types.ObjectId, ref: 'Staff' },
        isSupport: { type: Boolean, default: false },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  comments?: Array<{
    comment: string;
    by?: Types.ObjectId;
    byStaff?: Types.ObjectId;
    isSupport?: boolean;
    timestamp: Date;
  }>;

  @Prop({ min: 1, max: 5 })
  rating?: number; // Satisfaction rating after resolution

  @Prop()
  feedback?: string; // Feedback after resolution

  // Escalation Matrix Fields
  @Prop({ enum: EscalationLevel, default: EscalationLevel.LEVEL_1 })
  escalationLevel: EscalationLevel;

  @Prop()
  escalationDeadline?: Date; // When to escalate if not resolved

  @Prop({
    type: [
      {
        fromLevel: String,
        toLevel: String,
        reason: String,
        escalatedAt: { type: Date, default: Date.now },
        escalatedBy: String, // 'AUTO' or staff ID
      },
    ],
    default: [],
  })
  escalationHistory?: Array<{
    fromLevel: string;
    toLevel: string;
    reason: string;
    escalatedAt: Date;
    escalatedBy: string;
  }>;

  @Prop({ default: false })
  escalated?: boolean; // Quick flag to check if escalated

  @Prop({ type: Object })
  slaConfig?: EscalationConfig;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
