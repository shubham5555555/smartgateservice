import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Complaint,
  ComplaintDocument,
  ComplaintStatus,
} from '../schemas/complaint.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { EscalationService } from '../common/escalation.service';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => EscalationService))
    private escalationService: EscalationService,
  ) {}

  async createComplaint(
    userId: string,
    createComplaintDto: CreateComplaintDto,
  ) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const complaint = new this.complaintModel({
        ...createComplaintDto,
        userId: new Types.ObjectId(userId),
        flatNo: user.flatNo || 'N/A',
        block: user.building || user.block || 'N/A',
        status: ComplaintStatus.OPEN,
        history: [
          {
            action: 'Complaint Created',
            comment: 'Complaint filed by resident',
            timestamp: new Date(),
          },
        ],
      });

      if (createComplaintDto.dueDate) {
        complaint.dueDate = new Date(createComplaintDto.dueDate);
      }

      await this.escalationService.initializeComplaintEscalation(complaint);

      return await complaint.save();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create complaint: ${error.message}`,
      );
    }
  }

  async getComplaintsByUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build list of userIds whose complaints to fetch
    const userIds: Types.ObjectId[] = [new Types.ObjectId(userId)];

    // If owner, also include sub-users' complaints
    if (user.role === UserRole.OWNER) {
      const subUsers = await this.userModel
        .find({ parentUserId: userId })
        .select('_id')
        .lean();
      subUsers.forEach((su: any) => userIds.push(new Types.ObjectId(su._id.toString())));
    }

    const complaints = await this.complaintModel
      .find({ userId: { $in: userIds } })
      .populate('userId', 'fullName role relation')
      .populate('assignedTo', 'name role phoneNumber')
      .populate('resolvedBy', 'name role')
      .populate('history.by', 'name role')
      .populate('comments.by', 'fullName')
      .populate('comments.byStaff', 'name role')
      .sort({ createdAt: -1 })
      .exec();

    return complaints;
  }

  async getComplaintById(id: string) {
    const complaint = await this.complaintModel
      .findById(id)
      .populate('userId', 'fullName phoneNumber building flatNo role relation')
      .populate('assignedTo', 'name role phoneNumber')
      .populate('resolvedBy', 'name role')
      .populate('history.by', 'name role')
      .populate('comments.by', 'fullName')
      .populate('comments.byStaff', 'name role')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }

  async addComment(
    complaintId: string,
    comment: string,
    userId?: string,
    staffId?: string,
  ) {
    const complaint = await this.complaintModel.findById(complaintId);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const commentData: any = {
      comment,
      timestamp: new Date(),
    };

    if (userId) {
      commentData.by = new Types.ObjectId(userId);
    }
    if (staffId) {
      commentData.byStaff = new Types.ObjectId(staffId);
    }

    complaint.comments = complaint.comments || [];
    complaint.comments.push(commentData);

    return await complaint.save();
  }

  async addToHistory(
    complaintId: string,
    action: string,
    comment?: string,
    staffId?: string,
  ) {
    const complaint = await this.complaintModel.findById(complaintId);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const historyEntry: any = {
      action,
      comment,
      timestamp: new Date(),
    };

    if (staffId) {
      historyEntry.by = new Types.ObjectId(staffId);
    }

    complaint.history = complaint.history || [];
    complaint.history.push(historyEntry);

    return await complaint.save();
  }
}
