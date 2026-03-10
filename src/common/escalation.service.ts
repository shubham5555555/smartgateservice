import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Complaint,
  ComplaintDocument,
  ComplaintStatus,
  EscalationLevel as ComplaintEscalationLevel,
} from '../schemas/complaint.schema';
import {
  Reminder,
  ReminderDocument,
  ReminderStatus,
  EscalationLevel as ReminderEscalationLevel,
} from '../schemas/reminder.schema';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* Note: The above eslint disable is required due to Mongoose's type system
   limitations with enums and Document types. This is safe in runtime. */

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  // Default SLA configuration in hours
  private readonly DEFAULT_SLA = {
    CRITICAL: { level1: 4, level2: 12, level3: 24 },
    HIGH: { level1: 24, level2: 48, level3: 72 },
    MEDIUM: { level1: 48, level2: 96, level3: 168 },
    LOW: { level1: 72, level2: 168, level3: 336 },
  };

  constructor(
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel(Reminder.name)
    private reminderModel: Model<ReminderDocument>,
  ) {}

  // Run every hour to check for escalations
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoEscalation() {
    this.logger.log('Starting auto-escalation check...');

    try {
      await Promise.all([this.escalateComplaints(), this.escalateReminders()]);

      this.logger.log('Auto-escalation check completed');
    } catch (error) {
      this.logger.error('Error in auto-escalation:', error);
    }
  }

  // Escalate overdue complaints
  async escalateComplaints() {
    const now = new Date();

    // Find complaints that are not resolved and past their escalation deadline
    const overdueComplaints = await this.complaintModel
      .find({
        status: {
          $nin: [
            ComplaintStatus.RESOLVED,
            ComplaintStatus.CLOSED,
            ComplaintStatus.REJECTED,
          ],
        },
        escalationDeadline: { $lt: now },
      })
      .exec();

    this.logger.log(`Found ${overdueComplaints.length} complaints to escalate`);

    for (const complaint of overdueComplaints) {
      await this.escalateComplaint(complaint);
    }
  }

  // Escalate a single complaint to the next level
  async escalateComplaint(complaint: ComplaintDocument) {
    const currentLevel: ComplaintEscalationLevel =
      complaint.escalationLevel || ComplaintEscalationLevel.LEVEL_1;
    let nextLevel: string | null = null;
    let nextDeadline: Date | null = null;

    const hoursSinceCreation = this.getHoursSince(complaint.createdAt);
    const sla = this.getSLAForPriority(complaint.priority);

    // Determine next escalation level
    if (
      currentLevel === ComplaintEscalationLevel.LEVEL_1 &&
      hoursSinceCreation >= sla.level1
    ) {
      nextLevel = ComplaintEscalationLevel.LEVEL_2;
      nextDeadline = this.addHours(new Date(), sla.level2 - sla.level1);
    } else if (
      currentLevel === ComplaintEscalationLevel.LEVEL_2 &&
      hoursSinceCreation >= sla.level2
    ) {
      nextLevel = ComplaintEscalationLevel.LEVEL_3;
      nextDeadline = this.addHours(new Date(), sla.level3 - sla.level2);
    }

    if (nextLevel) {
      // Add to escalation history
      complaint.escalationHistory = complaint.escalationHistory || [];
      complaint.escalationHistory.push({
        fromLevel: currentLevel,
        toLevel: nextLevel,
        reason: 'Auto-escalated due to SLA breach',
        escalatedAt: new Date(),
        escalatedBy: 'AUTO',
      });

      // Update escalation level and deadline
      complaint.escalationLevel = nextLevel as any;
      complaint.escalationDeadline = nextDeadline ?? undefined;
      complaint.escalated = true;

      // Add to activity history
      complaint.history = complaint.history || [];
      complaint.history.push({
        action: `Escalated to ${nextLevel}`,
        comment: 'Automatically escalated due to SLA breach',
        timestamp: new Date(),
      });

      await complaint.save();

      this.logger.log(
        `Complaint ${String(complaint._id)} escalated from ${currentLevel} to ${nextLevel}`,
      );

      // TODO: Send notification to next level assignees
    }
  }

  // Escalate overdue reminders
  async escalateReminders() {
    const now = new Date();

    const overdueReminders = await this.reminderModel
      .find({
        status: { $nin: [ReminderStatus.COMPLETED, ReminderStatus.CANCELLED] },
        escalationDeadline: { $lt: now },
      })
      .exec();

    this.logger.log(`Found ${overdueReminders.length} reminders to escalate`);

    for (const reminder of overdueReminders) {
      await this.escalateReminder(reminder);
    }
  }

  // Escalate a single reminder
  async escalateReminder(reminder: ReminderDocument) {
    const currentLevel =
      reminder.escalationLevel || ReminderEscalationLevel.LEVEL_1;
    let nextLevel: ReminderEscalationLevel | null = null;

    // Determine next escalation level
    if (currentLevel === ReminderEscalationLevel.LEVEL_1) {
      nextLevel = ReminderEscalationLevel.LEVEL_2;
    } else if (currentLevel === ReminderEscalationLevel.LEVEL_2) {
      nextLevel = ReminderEscalationLevel.LEVEL_3;
    }

    if (nextLevel) {
      reminder.escalationHistory = reminder.escalationHistory || [];
      reminder.escalationHistory.push({
        fromLevel: currentLevel,
        toLevel: nextLevel,
        reason: 'Auto-escalated - reminder overdue',
        escalatedAt: new Date(),
        escalatedBy: 'AUTO',
      });

      reminder.escalationLevel = nextLevel;
      reminder.escalated = true;
      // Set next escalation deadline to 24 hours from now
      reminder.escalationDeadline = this.addHours(new Date(), 24);

      await reminder.save();

      this.logger.log(
        `Reminder ${String(reminder._id)} escalated from ${currentLevel} to ${nextLevel}`,
      );
    }
  }

  // Manual escalation by admin/staff
  async manuallyEscalateComplaint(
    complaintId: string,
    toLevel: ComplaintEscalationLevel,
    reason: string,
    escalatedBy: string,
  ) {
    const complaint = await this.complaintModel.findById(complaintId);
    if (!complaint) {
      throw new Error('Complaint not found');
    }

    const currentLevel: ComplaintEscalationLevel = complaint.escalationLevel;

    complaint.escalationHistory = complaint.escalationHistory || [];
    complaint.escalationHistory.push({
      fromLevel: currentLevel,
      toLevel: toLevel,
      reason,
      escalatedAt: new Date(),
      escalatedBy,
    });

    complaint.escalationLevel = toLevel;
    complaint.escalated = true;
    complaint.escalationDeadline = undefined; // Clear auto-escalation when manually escalated

    complaint.history = complaint.history || [];
    complaint.history.push({
      action: `Manually escalated to ${toLevel}`,
      comment: reason,
      timestamp: new Date(),
    });

    await complaint.save();

    this.logger.log(
      `Complaint ${complaintId} manually escalated to ${toLevel} by ${escalatedBy}`,
    );

    return complaint;
  }

  // Initialize escalation tracking for a new complaint
  initializeComplaintEscalation(complaint: ComplaintDocument) {
    const sla =
      complaint.slaConfig || this.getSLAForPriority(complaint.priority);

    complaint.escalationLevel = ComplaintEscalationLevel.LEVEL_1;
    complaint.escalationDeadline = this.addHours(
      complaint.createdAt ?? new Date(),
      sla.level1,
    );
    complaint.slaConfig = sla;
    complaint.escalated = false;

    return complaint;
  }

  // Initialize escalation for a new reminder
  initializeReminderEscalation(reminder: ReminderDocument) {
    reminder.escalationLevel = ReminderEscalationLevel.LEVEL_1;
    // Set escalation deadline to due date + 24 hours
    reminder.escalationDeadline = this.addHours(reminder.dueDate, 24);
    reminder.escalated = false;

    return reminder;
  }

  // Get SLA hours based on priority
  private getSLAForPriority(priority: string): {
    level1: number;
    level2: number;
    level3: number;
  } {
    const normalizedPriority =
      priority.toUpperCase() as keyof typeof this.DEFAULT_SLA;
    return this.DEFAULT_SLA[normalizedPriority] || this.DEFAULT_SLA.MEDIUM;
  }

  // Calculate hours between two dates
  private getHoursSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60));
  }

  // Add hours to a date
  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  // Get escalation statistics
  async getEscalationStats() {
    const [
      totalEscalated,
      level1Complaints,
      level2Complaints,
      level3Complaints,
      overdueComplaints,
      level1Reminders,
      level2Reminders,
      level3Reminders,
    ] = await Promise.all([
      this.complaintModel.countDocuments({ escalated: true }),
      this.complaintModel.countDocuments({
        escalationLevel: ComplaintEscalationLevel.LEVEL_1,
      }),
      this.complaintModel.countDocuments({
        escalationLevel: ComplaintEscalationLevel.LEVEL_2,
      }),
      this.complaintModel.countDocuments({
        escalationLevel: ComplaintEscalationLevel.LEVEL_3,
      }),
      this.complaintModel.countDocuments({
        escalationDeadline: { $lt: new Date() },
        status: { $nin: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
      }),
      this.reminderModel.countDocuments({
        escalationLevel: ReminderEscalationLevel.LEVEL_1,
      }),
      this.reminderModel.countDocuments({
        escalationLevel: ReminderEscalationLevel.LEVEL_2,
      }),
      this.reminderModel.countDocuments({
        escalationLevel: ReminderEscalationLevel.LEVEL_3,
      }),
    ]);

    return {
      complaints: {
        totalEscalated,
        level1: level1Complaints,
        level2: level2Complaints,
        level3: level3Complaints,
        overdue: overdueComplaints,
      },
      reminders: {
        level1: level1Reminders,
        level2: level2Reminders,
        level3: level3Reminders,
      },
    };
  }
}
