import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visitor, VisitorDocument } from '../schemas/visitor.schema';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { VisitorStatus } from '../schemas/visitor.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) {}

  async createVisitor(userId: string, createDto: CreateVisitorDto) {
    // Generate QR code data (visitor ID + timestamp)
    const qrData = JSON.stringify({
      visitorId: new Types.ObjectId().toString(),
      userId: userId,
      timestamp: Date.now(),
    });

    const visitor = new this.visitorModel({
      ...createDto,
      userId: new Types.ObjectId(userId),
      status: createDto.isPreApproved ? VisitorStatus.APPROVED : VisitorStatus.PENDING,
      expectedDate: createDto.expectedDate ? new Date(createDto.expectedDate) : undefined,
      qrCode: qrData,
    });
    const savedVisitor = await visitor.save();
    
    // Update QR code with actual visitor ID
    savedVisitor.qrCode = JSON.stringify({
      visitorId: savedVisitor._id.toString(),
      userId: userId,
      timestamp: Date.now(),
    });
    return savedVisitor.save();
  }

  async getVisitors(userId: string) {
    return this.visitorModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async getTodayVisitors(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.visitorModel.find({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: today, $lt: tomorrow },
    }).sort({ createdAt: -1 }).exec();
  }

  async approveVisitor(visitorId: string) {
    const visitor = await this.visitorModel.findById(visitorId).populate('userId');
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.APPROVED;
    
    // Ensure QR code exists
    if (!visitor.qrCode) {
      const userId = visitor.userId instanceof Types.ObjectId 
        ? visitor.userId.toString() 
        : (visitor.userId as any)?._id?.toString() || '';
      visitor.qrCode = JSON.stringify({
        visitorId: visitor._id.toString(),
        userId: userId,
        timestamp: Date.now(),
      });
    }
    
    const savedVisitor = await visitor.save();
    
    // Send notification to user
    if (this.notificationsService) {
      const userId = visitor.userId instanceof Types.ObjectId 
        ? visitor.userId.toString() 
        : (visitor.userId as any)?._id?.toString() || '';
      
      this.notificationsService.sendNotificationToUser(
        userId,
        'Visitor Approved',
        `${visitor.name} has been approved and is on their way`,
        {
          type: 'visitor',
          visitorId: visitorId,
          action: 'approved',
        },
      ).catch(err => {
        console.error('Failed to send notification:', err);
      });
    }
    
    return savedVisitor;
  }

  async recordEntry(visitorId: string) {
    const visitor = await this.visitorModel.findById(visitorId);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.INSIDE;
    visitor.entryTime = new Date();
    return visitor.save();
  }

  async recordExit(visitorId: string) {
    const visitor = await this.visitorModel.findById(visitorId);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.LEFT;
    visitor.exitTime = new Date();
    return visitor.save();
  }
}
