import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Complaint, ComplaintDocument, ComplaintStatus } from '../schemas/complaint.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name) private complaintModel: Model<ComplaintDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createComplaint(userId: string, createComplaintDto: CreateComplaintDto) {
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
      });

      return await complaint.save();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create complaint: ${error.message}`);
    }
  }

  async getComplaintsByUser(userId: string) {
    return this.complaintModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComplaintById(id: string) {
    const complaint = await this.complaintModel
      .findById(id)
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }
}
