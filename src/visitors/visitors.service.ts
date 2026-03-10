import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visitor, VisitorDocument } from '../schemas/visitor.schema';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { SelfRegisterVisitorDto } from './dto/self-register-visitor.dto';
import { VisitorStatus } from '../schemas/visitor.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../schemas/user.schema';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) { }

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
      status: createDto.isPreApproved
        ? VisitorStatus.APPROVED
        : VisitorStatus.PENDING,
      expectedDate: createDto.expectedDate
        ? new Date(createDto.expectedDate)
        : undefined,
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
    return this.visitorModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getTodayVisitors(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.visitorModel
      .find({
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: today, $lt: tomorrow },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async approveVisitor(visitorId: string) {
    const visitor = await this.visitorModel
      .findById(visitorId)
      .populate('userId');
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.APPROVED;

    // Ensure QR code exists
    if (!visitor.qrCode) {
      const userId =
        visitor.userId instanceof Types.ObjectId
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
      const userId =
        visitor.userId instanceof Types.ObjectId
          ? visitor.userId.toString()
          : (visitor.userId as any)?._id?.toString() || '';

      this.notificationsService
        .sendNotificationToUser(
          userId,
          'Visitor Approved',
          `${visitor.name} has been approved and is on their way`,
          {
            type: 'visitor',
            visitorId: visitorId,
            action: 'approved',
          },
        )
        .catch((err) => {
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
    const saved = await visitor.save();

    if (this.notificationsService && visitor.userId) {
      const uId = String((visitor.userId as any)?._id || visitor.userId);
      this.notificationsService.sendNotificationToUser(
        uId,
        'Visitor Arrived',
        `${visitor.name} has just entered the premises.`,
        { type: 'visitor', visitorId: visitorId, action: 'entry' }
      ).catch(err => console.error('Entry notification failed:', err));
    }

    return saved;
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

  async getVisitorStatusByPhone(phoneNumber: string) {
    const visitor = await this.visitorModel
      .findOne({ phoneNumber })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName email building flat')
      .lean()
      .exec();

    if (!visitor) {
      throw new NotFoundException('No visitor found with this phone number');
    }

    return {
      ...visitor,
      _id: visitor._id.toString(),
      userId:
        visitor.userId instanceof Types.ObjectId
          ? visitor.userId.toString()
          : (visitor.userId as any)?._id?.toString() || visitor.userId,
    };
  }

  async acceptSelfRegisteredVisitor(visitorId: string, userId: string) {
    const visitor = await this.visitorModel.findById(visitorId).exec();
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    // Verify that the visitor belongs to this user
    const visitorUserId =
      visitor.userId instanceof Types.ObjectId
        ? visitor.userId.toString()
        : (visitor.userId as any)?._id?.toString() || '';

    if (visitorUserId !== userId) {
      throw new BadRequestException(
        'You are not authorized to accept this visitor',
      );
    }

    if (visitor.status !== VisitorStatus.PENDING) {
      throw new BadRequestException(`Visitor is already ${visitor.status}`);
    }

    visitor.status = VisitorStatus.APPROVED;

    // Ensure QR code exists
    if (!visitor.qrCode) {
      visitor.qrCode = JSON.stringify({
        visitorId: visitor._id.toString(),
        userId: visitorUserId,
        timestamp: Date.now(),
      });
    }

    return visitor.save();
  }

  async rejectSelfRegisteredVisitor(
    visitorId: string,
    userId: string,
    reason?: string,
  ) {
    const visitor = await this.visitorModel.findById(visitorId).exec();
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    // Verify that the visitor belongs to this user
    const visitorUserId =
      visitor.userId instanceof Types.ObjectId
        ? visitor.userId.toString()
        : (visitor.userId as any)?._id?.toString() || '';

    if (visitorUserId !== userId) {
      throw new BadRequestException(
        'You are not authorized to reject this visitor',
      );
    }

    if (visitor.status !== VisitorStatus.PENDING) {
      throw new BadRequestException(`Visitor is already ${visitor.status}`);
    }

    visitor.status = VisitorStatus.REJECTED;
    return visitor.save();
  }

  async selfRegisterVisitor(selfRegisterDto: SelfRegisterVisitorDto) {
    // Find resident by email
    const resident = await this.userModel
      .findOne({
        email: selfRegisterDto.residentEmail,
        isApprovedByAdmin: true, // Only allow visits to approved residents
      })
      .exec();

    if (!resident) {
      throw new BadRequestException(
        'Resident not found or not approved. Please verify the email address.',
      );
    }

    // Generate QR code data
    const visitorId = new Types.ObjectId();
    const qrData = JSON.stringify({
      visitorId: visitorId.toString(),
      userId: resident._id.toString(),
      timestamp: Date.now(),
    });

    // Parse expected date and time if provided
    let expectedDate: Date | undefined;
    if (selfRegisterDto.expectedDate) {
      expectedDate = new Date(selfRegisterDto.expectedDate);
      if (selfRegisterDto.expectedTime) {
        const [hours, minutes] = selfRegisterDto.expectedTime.split(':');
        expectedDate.setHours(
          parseInt(hours) || 0,
          parseInt(minutes) || 0,
          0,
          0,
        );
      }
    }

    const visitor = new this.visitorModel({
      name: selfRegisterDto.name,
      phoneNumber: selfRegisterDto.phoneNumber,
      type: selfRegisterDto.type,
      userId: resident._id,
      status: VisitorStatus.PENDING, // Always pending for self-registered visitors
      isPreApproved: false,
      expectedDate: expectedDate,
      qrCode: qrData,
    });

    const savedVisitor = await visitor.save();

    // Update QR code with actual visitor ID
    savedVisitor.qrCode = JSON.stringify({
      visitorId: savedVisitor._id.toString(),
      userId: resident._id.toString(),
      timestamp: Date.now(),
    });
    await savedVisitor.save();

    // Send notification to resident about new visitor request
    if (this.notificationsService) {
      this.notificationsService
        .sendNotificationToUser(
          resident._id.toString(),
          'New Visitor Request',
          `${selfRegisterDto.name} wants to visit you${expectedDate ? ` on ${expectedDate.toLocaleDateString()}` : ''}`,
          {
            type: 'visitor',
            visitorId: savedVisitor._id.toString(),
            action: 'request',
          },
        )
        .catch((err) => {
          console.error('Failed to send notification:', err);
        });
    }

    return savedVisitor;
  }
}
