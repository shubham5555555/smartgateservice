import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reminder, ReminderStatus } from '../schemas/reminder.schema';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { EscalationService } from '../common/escalation.service';

@Injectable()
export class RemindersService {
  constructor(
    @InjectModel(Reminder.name) private reminderModel: Model<Reminder>,
    @Inject(forwardRef(() => EscalationService))
    private escalationService: EscalationService,
  ) {}

  async create(createReminderDto: CreateReminderDto): Promise<Reminder> {
    const reminder = new this.reminderModel({
      ...createReminderDto,
      createdBy: new Types.ObjectId(createReminderDto.createdBy),
      assignedTo: createReminderDto.assignedTo?.map(
        (id) => new Types.ObjectId(id),
      ),
      relatedComplaint: createReminderDto.relatedComplaint
        ? new Types.ObjectId(createReminderDto.relatedComplaint)
        : undefined,
      relatedMaintenance: createReminderDto.relatedMaintenance
        ? new Types.ObjectId(createReminderDto.relatedMaintenance)
        : undefined,
      relatedEvent: createReminderDto.relatedEvent
        ? new Types.ObjectId(createReminderDto.relatedEvent)
        : undefined,
    });

    // Initialize escalation matrix
    this.escalationService.initializeReminderEscalation(reminder);

    return await reminder.save();
  }

  async findAll(filters?: Record<string, unknown>): Promise<Reminder[]> {
    const query = (filters || {}) as Record<string, any>;

    return await this.reminderModel
      .find(query)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('relatedComplaint', 'title status priority')
      .populate('relatedMaintenance', 'title status')
      .populate('relatedEvent', 'title date')
      .populate('completedBy', 'name role')
      .sort({ dueDate: 1, priority: -1 })
      .exec();
  }

  async findById(id: string): Promise<Reminder> {
    const reminder = await this.reminderModel
      .findById(id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role phoneNumber')
      .populate('relatedComplaint', 'title status priority category')
      .populate('relatedMaintenance', 'title status')
      .populate('relatedEvent', 'title date')
      .populate('completedBy', 'name role')
      .exec();

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return reminder;
  }

  async update(
    id: string,
    updateReminderDto: UpdateReminderDto,
  ): Promise<Reminder> {
    const reminder = await this.reminderModel.findById(id);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    Object.assign(reminder, updateReminderDto);

    if (updateReminderDto.assignedTo) {
      reminder.assignedTo = updateReminderDto.assignedTo.map(
        (id) => new Types.ObjectId(id),
      );
    }

    return await reminder.save();
  }

  async complete(id: string, completedById: string): Promise<Reminder> {
    const reminder = await this.reminderModel.findById(id);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    reminder.status = ReminderStatus.COMPLETED;
    reminder.completedAt = new Date();
    reminder.completedBy = new Types.ObjectId(completedById);

    return await reminder.save();
  }

  async snooze(
    id: string,
    snoozeUntil: Date,
    reason?: string,
  ): Promise<Reminder> {
    const reminder = await this.reminderModel.findById(id);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    reminder.status = ReminderStatus.SNOOZED;
    reminder.snoozeHistory = reminder.snoozeHistory || [];
    reminder.snoozeHistory.push({
      snoozedUntil: snoozeUntil,
      reason,
      timestamp: new Date(),
    });

    return await reminder.save();
  }

  async cancel(id: string): Promise<Reminder> {
    const reminder = await this.reminderModel.findById(id);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    reminder.status = ReminderStatus.CANCELLED;

    return await reminder.save();
  }

  async delete(id: string): Promise<void> {
    const result = await this.reminderModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Reminder not found');
    }
  }

  // Dashboard queries
  async getUpcoming(limit: number = 10): Promise<Reminder[]> {
    const now = new Date();
    return await this.reminderModel
      .find({
        status: { $in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED] },
        dueDate: { $gte: now },
      })
      .populate('createdBy', 'name role')
      .populate('assignedTo', 'name role')
      .populate('relatedComplaint', 'title status')
      .sort({ dueDate: 1 })
      .limit(limit)
      .exec();
  }

  async getOverdue(): Promise<Reminder[]> {
    const now = new Date();
    return await this.reminderModel
      .find({
        status: { $in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED] },
        dueDate: { $lt: now },
      })
      .populate('createdBy', 'name role')
      .populate('assignedTo', 'name role')
      .populate('relatedComplaint', 'title status')
      .sort({ dueDate: 1 })
      .exec();
  }

  async getByStaffId(staffId: string): Promise<Reminder[]> {
    return await this.reminderModel
      .find({
        assignedTo: new Types.ObjectId(staffId),
        status: { $in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED] },
      })
      .populate('createdBy', 'name role')
      .populate('relatedComplaint', 'title status priority')
      .sort({ dueDate: 1, priority: -1 })
      .exec();
  }

  async getDashboardStats() {
    const now = new Date();

    const [total, pending, overdue, completed, cancelled] = await Promise.all([
      this.reminderModel.countDocuments(),
      this.reminderModel.countDocuments({ status: ReminderStatus.PENDING }),
      this.reminderModel.countDocuments({
        status: { $in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED] },
        dueDate: { $lt: now },
      }),
      this.reminderModel.countDocuments({ status: ReminderStatus.COMPLETED }),
      this.reminderModel.countDocuments({ status: ReminderStatus.CANCELLED }),
    ]);

    return {
      total,
      pending,
      overdue,
      completed,
      cancelled,
    };
  }
}
