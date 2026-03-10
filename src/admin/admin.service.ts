import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Visitor,
  VisitorDocument,
  VisitorStatus,
  VisitorType,
} from '../schemas/visitor.schema';
import {
  Maintenance,
  MaintenanceDocument,
  PaymentStatus,
} from '../schemas/maintenance.schema';
import {
  Staff,
  StaffDocument,
  StaffType,
  StaffStatus,
} from '../schemas/staff.schema';
import {
  StaffActivity,
  StaffActivityDocument,
  ActivityStatus,
} from '../schemas/staff-activity.schema';
import {
  Complaint,
  ComplaintDocument,
  ComplaintStatus,
} from '../schemas/complaint.schema';
import { Notice, NoticeDocument, NoticeStatus } from '../schemas/notice.schema';
import {
  AccessRequest,
  AccessRequestDocument,
  AccessRequestStatus,
} from '../schemas/access-request.schema';
import { Vehicle, VehicleDocument } from '../schemas/vehicle.schema';
import { Parcel, ParcelDocument } from '../schemas/parcel.schema';
import { DocumentFile, DocumentDocument } from '../schemas/document.schema';
import {
  EmergencyContact,
  EmergencyContactDocument,
} from '../schemas/emergency-contact.schema';
import { Guard, GuardDocument } from '../schemas/guard.schema';
import { Pet, PetDocument } from '../schemas/pet.schema';
import { Event, EventDocument, EventStatus } from '../schemas/event.schema';
import {
  Reminder,
  ReminderDocument,
  ReminderStatus,
} from '../schemas/reminder.schema';
import { Contact, ContactDocument } from '../schemas/contact.schema';
import {
  Building,
  BuildingDocument,
} from '../schemas/building.schema';
import {
  ParkingSlot,
  ParkingSlotDocument,
  SlotStatus,
  SlotType,
} from '../schemas/parking-slot.schema';
import {
  ParkingApplication,
  ParkingApplicationDocument,
  ApplicationStatus,
} from '../schemas/parking-application.schema';
import {
  AmenityBooking,
  AmenityBookingDocument,
  BookingStatus,
} from '../schemas/amenity-booking.schema';
import { Amenity, AmenityDocument } from '../schemas/amenity.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Inject, forwardRef } from '@nestjs/common';
import { CreateVisitorDto } from '../visitors/dto/create-visitor.dto';
import { EmailService } from '../common/email.service';
import { EscalationService } from '../common/escalation.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
    @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
    @InjectModel(StaffActivity.name)
    private staffActivityModel: Model<StaffActivityDocument>,
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel(Notice.name) private noticeModel: Model<NoticeDocument>,
    @InjectModel(AccessRequest.name)
    private accessRequestModel: Model<AccessRequestDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Parcel.name) private parcelModel: Model<ParcelDocument>,
    @InjectModel(DocumentFile.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(EmergencyContact.name)
    private emergencyContactModel: Model<EmergencyContactDocument>,
    @InjectModel(Guard.name) private guardModel: Model<GuardDocument>,
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Reminder.name) private reminderModel: Model<ReminderDocument>,
    @InjectModel(ParkingSlot.name)
    private parkingSlotModel: Model<ParkingSlotDocument>,
    @InjectModel(ParkingApplication.name)
    private parkingApplicationModel: Model<ParkingApplicationDocument>,
    @InjectModel(AmenityBooking.name)
    private amenityBookingModel: Model<AmenityBookingDocument>,
    @InjectModel(Amenity.name)
    private amenityModel: Model<AmenityDocument>,
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private escalationService: EscalationService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) { }

  // Auth methods
  async login(email: string, password: string) {
    // For admin, we'll use a simple check or create admin user
    // In production, you'd have a separate Admin model
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartgate.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = process.env.ADMIN_PASSWORD_HASHED;

    if (email !== adminEmail) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check password - use bcrypt if hashed password is provided
    let isPasswordValid = false;
    if (hashedPassword) {
      isPasswordValid = await bcrypt.compare(password, hashedPassword);
    } else {
      // For demo, compare plain password
      isPasswordValid = password === adminPassword;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const payload = { email, sub: 'admin', role: 'admin' };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        email,
        role: 'admin',
        name: 'Admin',
      },
    };
  }

  async getCurrentUser(user: any) {
    return {
      email: user.email,
      role: user.role,
      name: 'Admin',
    };
  }

  // Guard Auth
  async guardLogin(loginId: string, password: string) {
    const guard = await this.guardModel
      .findOne({
        $or: [{ phoneNumber: loginId }, { guardId: loginId }],
        isActive: true,
      })
      .exec();

    if (!guard) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const isPasswordValid = await bcrypt.compare(password, guard.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    // Generate JWT token for guard
    const payload = {
      guardId: guard.guardId,
      phoneNumber: guard.phoneNumber,
      sub: guard._id.toString(),
      role: 'guard',
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      guard: {
        id: guard._id.toString(),
        guardId: guard.guardId,
        name: guard.name,
        phoneNumber: guard.phoneNumber,
        email: guard.email,
        gateNumber: guard.gateNumber,
        role: 'guard',
      },
    };
  }

  // Guard Management
  async getAllGuards() {
    return this.guardModel.find().sort({ createdAt: -1 }).exec();
  }

  async updateGuardFcmToken(phoneNumber: string, fcmToken: string) {
    const guard = await this.guardModel.findOneAndUpdate(
      { phoneNumber },
      { fcmToken },
      { new: true },
    );
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }
    return {
      message: 'FCM token updated successfully',
      fcmToken: guard.fcmToken,
    };
  }

  async getGuardById(id: string) {
    const guard = await this.guardModel.findById(id).exec();
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }
    return guard;
  }

  async createGuard(data: {
    guardId: string;
    phoneNumber: string;
    password: string;
    name: string;
    email?: string;
    shift?: string;
    gateNumber?: string;
  }) {
    // Check if guardId or phoneNumber already exists
    const existingGuard = await this.guardModel
      .findOne({
        $or: [{ guardId: data.guardId }, { phoneNumber: data.phoneNumber }],
      })
      .exec();

    if (existingGuard) {
      throw new UnauthorizedException(
        'Guard ID or phone number already exists',
      );
    }

    const guard = new this.guardModel(data);
    return guard.save();
  }

  async updateGuard(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      shift: string;
      gateNumber: string;
      isActive: boolean;
      isOnDuty: boolean;
      password?: string;
    }>,
  ) {
    const guard = await this.guardModel.findById(id).exec();
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    if (data.password) {
      // Set plain password - pre-save hook will hash it automatically
      guard.password = data.password;
      delete data.password; // Remove from data to avoid double assignment
    }

    Object.assign(guard, data);
    return guard.save();
  }

  async deleteGuard(id: string) {
    return this.guardModel.findByIdAndDelete(id).exec();
  }

  async resetGuardPassword(id: string, newPassword: string) {
    const guard = await this.guardModel.findById(id).exec();
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    // Set plain password - pre-save hook will hash it
    guard.password = newPassword;
    await guard.save();
    return guard;
  }

  async generateGuardPassword(id: string) {
    const guard = await this.guardModel.findById(id).exec();
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    // Generate a random 6-digit password
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();

    // Set plain password - pre-save hook will hash it automatically
    guard.password = newPassword;
    await guard.save();

    return {
      guardId: guard.guardId,
      phoneNumber: guard.phoneNumber,
      password: newPassword, // Return plain password for admin to share
    };
  }

  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartgate.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = process.env.ADMIN_PASSWORD_HASHED;

    if (email !== adminEmail) {
      throw new UnauthorizedException('Invalid email');
    }

    // Verify current password
    let isPasswordValid = false;
    if (hashedPassword) {
      isPasswordValid = await bcrypt.compare(currentPassword, hashedPassword);
    } else {
      isPasswordValid = currentPassword === adminPassword;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // In production, save to database
    // For now, return success message
    return {
      message: 'Password changed successfully',
      // Note: In production, update ADMIN_PASSWORD_HASHED in database
    };
  }

  async refreshToken(user: any) {
    // Generate new JWT token
    const payload = { email: user.email, sub: user.sub, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        email: user.email,
        role: user.role,
        name: 'Admin',
      },
    };
  }

  // Dashboard Stats
  async getDashboardStats() {
    const totalFlats = await this.userModel.countDocuments();
    const occupiedFlats = await this.userModel.countDocuments({
      isProfileComplete: true,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayVisitors = await this.visitorModel.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const duesCollected = await this.maintenanceModel.aggregate([
      {
        $match: {
          status: 'Paid',
          paidDate: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const pendingComplaints = await this.complaintModel.countDocuments({
      status: { $in: [ComplaintStatus.OPEN, ComplaintStatus.ASSIGNED] },
    });

    const activeNotices = await this.noticeModel.countDocuments({
      status: NoticeStatus.ACTIVE,
      expiryDate: { $gte: new Date() },
    });

    return {
      totalFlats,
      occupiedFlats,
      todayVisitors,
      duesCollected: duesCollected[0]?.total || 0,
      pendingComplaints,
      activeNotices,
    };
  }

  async getVisitorTrends(period: 'week' | 'month') {
    const days = period === 'week' ? 7 : 30;
    const trends: Array<{ day: string; count: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.visitorModel.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      });

      trends.push({
        day:
          period === 'week'
            ? date
              .toLocaleDateString('en-US', { weekday: 'short' })
              .toUpperCase()
            : date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
        count,
      });
    }

    return trends;
  }

  async getVisitorTypes() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visitors = await this.visitorModel.find({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const typeCounts = visitors.reduce(
      (acc, visitor) => {
        acc[visitor.type] = (acc[visitor.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const total = visitors.length;
    const types = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return types;
  }

  async getRecentActivity() {
    // Combine recent visitor entries and system alerts
    const recentVisitors = await this.visitorModel
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullName')
      .exec();

    return recentVisitors.map((visitor) => ({
      id: visitor._id.toString(),
      type: 'user',
      user: (visitor.userId as any)?.fullName || 'User',
      flat: visitor.type,
      action: `Approved visitor entry: ${visitor.type}`,
      timestamp: (visitor as any).createdAt || new Date(),
    }));
  }

  async getPriorityActions() {
    const highPriorityComplaints = await this.complaintModel
      .find({ priority: 'High', status: { $ne: ComplaintStatus.RESOLVED } })
      .limit(5)
      .exec();

    return highPriorityComplaints.map((complaint) => ({
      id: complaint._id.toString(),
      title: complaint.title,
      description: `Reported by residents`,
      priority: 'high',
    }));
  }

  // Complaints
  async getAllComplaints() {
    return this.complaintModel
      .find()
      .populate('userId', 'fullName phoneNumber building flatNo')
      .populate('assignedTo', 'name role phoneNumber')
      .populate('resolvedBy', 'name role')
      .populate('history.by', 'name role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComplaintById(id: string) {
    const complaint = await this.complaintModel
      .findById(id)
      .populate('userId', 'fullName phoneNumber building flatNo')
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

  async updateComplaintStatus(
    id: string,
    status: string,
    note?: string,
    staffId?: string,
  ) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const historyEntry: any = {
      action: `Status changed from ${complaint.status} to ${status}`,
      comment: note,
      timestamp: new Date(),
    };
    if (staffId) {
      historyEntry.by = new Types.ObjectId(staffId);
    }

    const setFields: any = { status };
    if (note) setFields.notes = note;
    if (
      status === ComplaintStatus.RESOLVED ||
      status === ComplaintStatus.CLOSED
    ) {
      setFields.resolvedAt = new Date();
      if (complaint.assignedTo) {
        setFields.resolvedBy = complaint.assignedTo;
      }
    }

    return this.complaintModel.findByIdAndUpdate(
      id,
      { $set: setFields, $push: { history: historyEntry } },
      { new: true, runValidators: false },
    ).exec();
  }

  async assignStaff(id: string, staffId: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const staff = await this.staffModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return this.complaintModel.findByIdAndUpdate(
      id,
      {
        $set: {
          assignedTo: new Types.ObjectId(staffId),
          status: ComplaintStatus.ASSIGNED,
        },
        $push: {
          history: {
            action: 'Complaint Assigned',
            comment: `Assigned to ${staff.name}`,
            timestamp: new Date(),
          },
        },
      },
      { new: true, runValidators: false },
    ).exec();
  }

  async reassignStaff(id: string, staffId: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const staff = await this.staffModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return this.complaintModel.findByIdAndUpdate(
      id,
      {
        $set: {
          assignedTo: new Types.ObjectId(staffId),
        },
        $push: {
          history: {
            action: 'Complaint Reassigned',
            comment: `Reassigned to ${staff.name}`,
            timestamp: new Date(),
          },
        },
      },
      { new: true, runValidators: false },
    ).exec();
  }

  async resolveComplaint(id: string, notes?: string, staffId?: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const historyEntry: any = {
      action: 'Complaint Resolved',
      comment: notes,
      timestamp: new Date(),
    };
    if (staffId) {
      historyEntry.by = new Types.ObjectId(staffId);
    }

    const setFields: any = {
      status: ComplaintStatus.RESOLVED,
      resolvedAt: new Date(),
    };
    if (notes) setFields.notes = notes;
    if (complaint.assignedTo) {
      setFields.resolvedBy = complaint.assignedTo;
    } else if (staffId) {
      setFields.resolvedBy = new Types.ObjectId(staffId);
    }

    return this.complaintModel.findByIdAndUpdate(
      id,
      { $set: setFields, $push: { history: historyEntry } },
      { new: true, runValidators: false },
    ).exec();
  }

  async addComplaintComment(id: string, comment: string, staffId?: string) {
    const exists = await this.complaintModel.exists({ _id: id });
    if (!exists) {
      throw new NotFoundException('Complaint not found');
    }

    const commentData: any = { comment, timestamp: new Date(), isSupport: true };
    if (staffId) {
      commentData.byStaff = new Types.ObjectId(staffId);
    }

    return this.complaintModel.findByIdAndUpdate(
      id,
      { $push: { comments: commentData } },
      { new: true, runValidators: false },
    ).exec();
  }

  // Reminders
  async getAllReminders() {
    return this.reminderModel
      .find()
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('relatedComplaint', 'title status priority')
      .populate('relatedMaintenance', 'title status')
      .populate('relatedEvent', 'title date')
      .populate('completedBy', 'name role')
      .sort({ dueDate: 1, priority: -1 })
      .exec();
  }

  async getReminderById(id: string) {
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

  async getUpcomingReminders(limit: number = 10) {
    const now = new Date();
    return this.reminderModel
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

  async getOverdueReminders() {
    const now = new Date();
    return this.reminderModel
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

  async getReminderStats() {
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

  // Escalation
  async getEscalationStats() {
    return this.escalationService.getEscalationStats();
  }

  async escalateComplaint(
    id: string,
    toLevel: string,
    reason: string,
    escalatedBy: string,
  ) {
    return this.escalationService.manuallyEscalateComplaint(
      id,
      toLevel as any,
      reason,
      escalatedBy,
    );
  }

  async getComplaintEscalationHistory(id: string) {
    const complaint = await this.complaintModel
      .findById(id)
      .select('escalationHistory escalationLevel escalated')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return {
      currentLevel: complaint.escalationLevel,
      escalated: complaint.escalated,
      history: complaint.escalationHistory || [],
    };
  }

  // Contacts - Emergency & Vendor
  async getAllContacts(type?: string) {
    const query: any = {};
    if (type) {
      query.type = type;
    }
    return this.contactModel
      .find(query)
      .sort({ type: 1, category: 1, name: 1 })
      .exec();
  }

  async getContactById(id: string) {
    const contact = await this.contactModel.findById(id).exec();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async createContact(contactData: any) {
    const contact = new this.contactModel(contactData);
    return contact.save();
  }

  async updateContact(id: string, contactData: any) {
    const contact = await this.contactModel
      .findByIdAndUpdate(id, contactData, { new: true })
      .exec();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async deleteContact(id: string) {
    const contact = await this.contactModel.findByIdAndDelete(id).exec();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async toggleContactActive(id: string) {
    const contact = await this.contactModel.findById(id).exec();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    contact.isActive = !contact.isActive;
    return contact.save();
  }

  // Billing
  async getBillingSummary(month: string, year: string) {
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const startDate = new Date(parseInt(year), monthIndex, 1);
    const endDate = new Date(parseInt(year), monthIndex + 1, 0);

    const bills = await this.maintenanceModel.find({
      dueDate: { $gte: startDate, $lte: endDate },
    });

    const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const paid = bills.filter((b) => b.status === PaymentStatus.PAID);
    const collected = paid.reduce((sum, bill) => sum + bill.amount, 0);
    const pending = totalBilled - collected;

    return { totalBilled, collected, pending };
  }

  async getBillingEntries(status?: 'Paid' | 'Unpaid' | 'Overdue', search?: string) {
    const query: any = {};
    if (status === 'Paid') {
      query.status = PaymentStatus.PAID;
    } else if (status === 'Unpaid') {
      query.status = PaymentStatus.PENDING;
    } else if (status === 'Overdue') {
      query.status = PaymentStatus.OVERDUE;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { month: { $regex: search, $options: 'i' } },
      ];
    }

    const entries = await this.maintenanceModel
      .find(query)
      .populate('userId', 'fullName flatNo building phoneNumber')
      .sort({ dueDate: 1 })
      .exec();

    return entries.map((entry) => ({
      id: entry._id.toString(),
      flatNo: (entry.userId as any)?.flatNo || 'N/A',
      building: (entry.userId as any)?.building || '',
      resident: {
        name: (entry.userId as any)?.fullName || 'Unknown',
        phone: (entry.userId as any)?.phoneNumber || '',
      },
      title: entry.title,
      month: entry.month,
      amount: entry.amount,
      dueDate: entry.dueDate ? entry.dueDate.toISOString() : new Date().toISOString(),
      paidDate: entry.paidDate ? entry.paidDate.toISOString() : null,
      paymentMethod: entry.paymentMethod || null,
      transactionId: entry.transactionId || null,
      status: entry.status === PaymentStatus.PAID
        ? 'Paid'
        : entry.status === PaymentStatus.OVERDUE
          ? 'Overdue'
          : 'Pending',
    }));
  }

  async getMaintenanceOverallStats() {
    const [total, paid, pending, overdue] = await Promise.all([
      this.maintenanceModel.countDocuments(),
      this.maintenanceModel.countDocuments({ status: PaymentStatus.PAID }),
      this.maintenanceModel.countDocuments({ status: PaymentStatus.PENDING }),
      this.maintenanceModel.countDocuments({ status: PaymentStatus.OVERDUE }),
    ]);

    const [totalAmountResult, collectedResult, pendingAmountResult] = await Promise.all([
      this.maintenanceModel.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      this.maintenanceModel.aggregate([
        { $match: { status: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.maintenanceModel.aggregate([
        { $match: { status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      totalBills: total,
      paidBills: paid,
      pendingBills: pending,
      overdueBills: overdue,
      totalBilled: totalAmountResult[0]?.total || 0,
      collected: collectedResult[0]?.total || 0,
      outstanding: pendingAmountResult[0]?.total || 0,
    };
  }

  async markBillingAsPaid(
    id: string,
    paymentMethod: string,
    transactionId?: string,
  ) {
    const maintenance = await this.maintenanceModel.findById(id);
    if (!maintenance) {
      throw new NotFoundException('Billing entry not found');
    }
    maintenance.status = PaymentStatus.PAID;
    maintenance.paidDate = new Date();
    maintenance.paymentMethod = paymentMethod;
    if (transactionId) maintenance.transactionId = transactionId;
    return maintenance.save();
  }

  async markBulkOverdue() {
    const now = new Date();
    const result = await this.maintenanceModel.updateMany(
      { status: PaymentStatus.PENDING, dueDate: { $lt: now } },
      { $set: { status: PaymentStatus.OVERDUE } },
    );
    return { updated: result.modifiedCount };
  }

  async sendReminders(ids: string[]) {
    // In production, this would send email/SMS reminders
    return { success: true, message: 'Reminders sent', count: ids.length };
  }

  async generateBill(data: any) {
    // Generate bills for all users or specific blocks
    const users = await this.userModel.find({ isProfileComplete: true });

    // Validate and parse dueDate
    let dueDate: Date;
    if (data.dueDate) {
      // Try to parse the date - handle different formats
      // Format could be: "dd-MM-yyyy", "yyyy-MM-dd", ISO string, etc.
      let parsedDate: Date;

      // Check if it's in dd-MM-yyyy format
      if (typeof data.dueDate === 'string' && data.dueDate.includes('-')) {
        const parts = data.dueDate.split('-');
        if (parts.length === 3) {
          // Try dd-MM-yyyy format
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            parsedDate = new Date(year, month, day);
          } else {
            // Try yyyy-MM-dd format
            const year2 = parseInt(parts[0], 10);
            const month2 = parseInt(parts[1], 10) - 1;
            const day2 = parseInt(parts[2], 10);
            if (!isNaN(year2) && !isNaN(month2) && !isNaN(day2)) {
              parsedDate = new Date(year2, month2, day2);
            } else {
              parsedDate = new Date(data.dueDate);
            }
          }
        } else {
          parsedDate = new Date(data.dueDate);
        }
      } else {
        parsedDate = new Date(data.dueDate);
      }

      // Check if date is valid
      if (isNaN(parsedDate.getTime())) {
        // If invalid, calculate due date from month and year
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        const monthIndex = monthNames.indexOf(data.month);
        if (monthIndex >= 0 && data.year) {
          // Last day of the specified month
          dueDate = new Date(parseInt(data.year), monthIndex + 1, 0);
        } else {
          // Default to end of current month if month/year parsing fails
          const now = new Date();
          dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
      } else {
        dueDate = parsedDate;
      }
    } else {
      // If no dueDate provided, calculate from month and year
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const monthIndex = monthNames.indexOf(data.month);
      if (monthIndex >= 0 && data.year) {
        // Last day of the specified month
        dueDate = new Date(parseInt(data.year), monthIndex + 1, 0);
      } else {
        // Default to end of current month
        const now = new Date();
        dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    // Ensure dueDate is valid before proceeding
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid due date provided');
    }

    const bills = users.map((user) => ({
      userId: user._id,
      title: `Maintenance Fee - ${data.month} ${data.year}`,
      amount:
        (data.maintenanceAmount || 0) +
        (data.waterCharges || 0) +
        (data.sinkingFund || 0),
      dueDate: dueDate,
      status: PaymentStatus.PENDING,
      month: `${data.month} ${data.year}`,
    }));

    await this.maintenanceModel.insertMany(bills);
    return { success: true, count: bills.length };
  }

  // Access Control
  async getPendingRequests() {
    return this.accessRequestModel
      .find({ status: AccessRequestStatus.PENDING })
      .sort({ createdAt: -1 })
      .exec();
  }

  async approveRequest(id: string) {
    const request = await this.accessRequestModel.findById(id);
    if (!request) {
      throw new Error('Request not found');
    }
    request.status = AccessRequestStatus.APPROVED;
    return request.save();
  }

  async rejectRequest(id: string) {
    const request = await this.accessRequestModel.findById(id);
    if (!request) {
      throw new Error('Request not found');
    }
    request.status = AccessRequestStatus.REJECTED;
    return request.save();
  }

  async getApprovedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.accessRequestModel.find({
      status: AccessRequestStatus.APPROVED,
      updatedAt: { $gte: today, $lt: tomorrow },
    });
  }

  async getRejectedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.accessRequestModel.find({
      status: AccessRequestStatus.REJECTED,
      updatedAt: { $gte: today, $lt: tomorrow },
    });
  }

  // Notices
  async getAllNotices() {
    return this.noticeModel.find().sort({ createdAt: -1 }).exec();
  }

  async getNoticeById(id: string) {
    return this.noticeModel.findById(id).exec();
  }

  async createNotice(data: any) {
    const notice = new this.noticeModel({
      ...data,
      expiryDate: new Date(data.expiryDate),
      status:
        new Date(data.expiryDate) > new Date()
          ? NoticeStatus.ACTIVE
          : NoticeStatus.EXPIRED,
    });
    return notice.save();
  }

  async updateNotice(id: string, data: any) {
    return this.noticeModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteNotice(id: string) {
    return this.noticeModel.findByIdAndDelete(id).exec();
  }

  // Staff Management
  async getAllStaff(type?: StaffType, search?: string, includeInactive = false) {
    const query: any = {};

    if (!includeInactive) {
      query.isActive = true;
    }

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
      ];
    }

    return this.staffModel
      .find(query)
      .populate('userId', 'fullName email phoneNumber building flatNo')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getStaffById(id: string) {
    const staff = await this.staffModel
      .findById(id)
      .populate('userId', 'fullName email phoneNumber building flatNo')
      .exec();

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async createStaff(createStaffDto: any) {
    // Verify user exists
    const user = await this.userModel.findById(createStaffDto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if staff with same phone already exists for this user
    const existingStaff = await this.staffModel.findOne({
      userId: new Types.ObjectId(createStaffDto.userId),
      phoneNumber: createStaffDto.phoneNumber,
    });

    if (existingStaff) {
      throw new Error(
        'Staff with this phone number already exists for this user',
      );
    }

    const staff = new this.staffModel({
      ...createStaffDto,
      userId: new Types.ObjectId(createStaffDto.userId),
    });

    return staff.save();
  }

  async updateStaff(id: string, updateStaffDto: any) {
    const staff = await this.staffModel.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    Object.assign(staff, updateStaffDto);
    return staff.save();
  }

  async deleteStaff(id: string) {
    const staff = await this.staffModel.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }
    staff.isActive = false;
    return staff.save();
  }

  async toggleStaffActive(id: string) {
    const staff = await this.staffModel.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }
    staff.isActive = !staff.isActive;
    return staff.save();
  }

  async getStaffActivityAdmin(staffId: string, month?: number, year?: number) {
    const staff = await this.staffModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const query: any = { staffId: new Types.ObjectId(staffId) };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const activities = await this.staffActivityModel
      .find(query)
      .sort({ date: -1 })
      .exec();

    const present = activities.filter(
      (a) => a.status === ActivityStatus.PRESENT,
    ).length;
    const absent = activities.filter(
      (a) => a.status === ActivityStatus.ABSENT,
    ).length;

    return { staff, activities, stats: { present, absent, total: activities.length } };
  }

  async adminCheckIn(staffId: string) {
    const staff = await this.staffModel.findById(staffId);
    if (!staff) throw new NotFoundException('Staff not found');

    staff.status = StaffStatus.INSIDE;
    await staff.save();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activity = await this.staffActivityModel.findOne({
      staffId: new Types.ObjectId(staffId),
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (!activity) {
      activity = new this.staffActivityModel({
        staffId: new Types.ObjectId(staffId),
        date: today,
        checkInTime: new Date(),
        status: ActivityStatus.PRESENT,
      });
    } else {
      activity.checkInTime = new Date();
      activity.status = ActivityStatus.PRESENT;
    }

    await activity.save();
    return { staff, activity };
  }

  async adminCheckOut(staffId: string) {
    const staff = await this.staffModel.findById(staffId);
    if (!staff) throw new NotFoundException('Staff not found');

    staff.status = StaffStatus.OUTSIDE;
    await staff.save();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activity = await this.staffActivityModel.findOne({
      staffId: new Types.ObjectId(staffId),
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (activity) {
      activity.checkOutTime = new Date();
      await activity.save();
    }

    return { staff, activity };
  }

  async getStaffByType(type: StaffType) {
    return this.staffModel
      .find({ type, isActive: true })
      .populate('userId', 'fullName building flatNo')
      .exec();
  }

  async getAvailableStaff() {
    return this.staffModel
      .find({ status: StaffStatus.OUTSIDE, isActive: true })
      .populate('userId', 'fullName building flatNo')
      .exec();
  }

  async getStaffSummary() {
    const total = await this.staffModel.countDocuments({ isActive: true });
    const inactive = await this.staffModel.countDocuments({ isActive: false });

    const byType = await this.staffModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const byStatus = await this.staffModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const presentToday = await this.staffActivityModel.countDocuments({
      date: { $gte: todayStart, $lt: todayEnd },
      status: ActivityStatus.PRESENT,
    });

    return {
      total,
      inactive,
      presentToday,
      byType: byType.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
    };
  }

  // Residents
  async getAllResidents(
    building?: string,
    residentType?: string,
    search?: string,
    pendingApproval?: boolean,
  ) {
    const query: any = {};

    if (building) {
      query.$or = [
        { building: { $regex: building, $options: 'i' } },
        { block: { $regex: building, $options: 'i' } },
        { address: { $regex: building, $options: 'i' } },
      ];
    }

    if (residentType) {
      query.role = residentType;
    }

    if (pendingApproval !== undefined) {
      query.isApprovedByAdmin = !pendingApproval;
    }

    if (search) {
      const searchQuery = {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { flat: { $regex: search, $options: 'i' } },
          { flatNo: { $regex: search, $options: 'i' } },
          { building: { $regex: search, $options: 'i' } },
          { block: { $regex: search, $options: 'i' } },
        ],
      };

      if (query.$or) {
        // Combine building query with search query
        query.$and = [{ $or: query.$or }, searchQuery];
        delete query.$or;
      } else {
        Object.assign(query, searchQuery);
      }
    }

    const residents = await this.userModel
      .find(query)
      .select(
        'email fullName phoneNumber role residentType block flat flatNo building isEmailVerified isApprovedByAdmin isProfileComplete emergencyContact emergencyPhone aadharNumber createdAt updatedAt',
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Map and clean the response
    return residents.map((user: any) => {
      const userId = user._id
        ? typeof user._id === 'object'
          ? user._id.toString()
          : String(user._id)
        : null;

      return {
        id: userId,
        _id: userId,
        email: user.email || null,
        fullName: user.fullName || null,
        phoneNumber: user.phoneNumber || null,
        role: user.role || null,
        residentType: user.residentType || null,
        block: user.block || null,
        flat: user.flat || null,
        flatNo: user.flatNo || null,
        building: user.building || null,
        isEmailVerified: user.isEmailVerified || false,
        isApprovedByAdmin: user.isApprovedByAdmin || false,
        isProfileComplete: user.isProfileComplete || false,
        emergencyContact: user.emergencyContact || null,
        emergencyPhone: user.emergencyPhone || null,
        aadharNumber: user.aadharNumber || null,
        createdAt: user.createdAt
          ? new Date(user.createdAt).toISOString()
          : null,
        updatedAt: user.updatedAt
          ? new Date(user.updatedAt).toISOString()
          : null,
      };
    });
  }

  async getResidentById(id: string) {
    // Validate id is a valid ObjectId format
    if (!id || id === 'pending' || typeof id !== 'string' || id.length !== 24) {
      throw new BadRequestException('Invalid resident ID');
    }

    const user = await this.userModel
      .findById(id)
      .select(
        'email fullName phoneNumber role residentType block flat flatNo building isEmailVerified isApprovedByAdmin isProfileComplete emergencyContact emergencyPhone aadharNumber createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('Resident not found');
    }

    // Map and clean the response
    const userId = user._id
      ? typeof user._id === 'object'
        ? user._id.toString()
        : String(user._id)
      : null;
    const userAny = user as any; // Type assertion for lean() result

    return {
      id: userId,
      _id: userId,
      email: user.email || null,
      fullName: user.fullName || null,
      phoneNumber: user.phoneNumber || null,
      role: user.role || null,
      residentType: userAny.residentType || null,
      block: user.block || null,
      flat: user.flat || null,
      flatNo: user.flatNo || null,
      building: user.building || null,
      isEmailVerified: user.isEmailVerified || false,
      isApprovedByAdmin: user.isApprovedByAdmin || false,
      isProfileComplete: user.isProfileComplete || false,
      emergencyContact: userAny.emergencyContact || null,
      emergencyPhone: userAny.emergencyPhone || null,
      aadharNumber: userAny.aadharNumber || null,
      createdAt: userAny.createdAt
        ? new Date(userAny.createdAt).toISOString()
        : null,
      updatedAt: userAny.updatedAt
        ? new Date(userAny.updatedAt).toISOString()
        : null,
    };
  }

  async createResident(createResidentDto: any) {
    // Check if user with email or phone already exists
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: createResidentDto.email },
        { phoneNumber: createResidentDto.phoneNumber },
      ],
    });

    if (existingUser) {
      throw new Error('User with this email or phone number already exists');
    }

    // Format address with building and flat number
    const address = `${createResidentDto.building}, Flat ${createResidentDto.flatNo}`;

    const user = new this.userModel({
      fullName: createResidentDto.fullName,
      email: createResidentDto.email,
      phoneNumber: createResidentDto.phoneNumber,
      address: address,
      building: createResidentDto.building,
      flatNo: createResidentDto.flatNo,
      residentType: createResidentDto.residentType,
      emergencyContact: createResidentDto.emergencyContact,
      emergencyPhone: createResidentDto.emergencyPhone,
      aadharNumber: createResidentDto.aadharNumber,
      panNumber: createResidentDto.panNumber,
      isProfileComplete: true,
      createdAt: new Date(),
    });

    return user.save();
  }

  async updateResident(id: string, updateResidentDto: any) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new Error('Resident not found');
    }

    // Update address if building or flatNo changed
    if (updateResidentDto.building || updateResidentDto.flatNo) {
      const building = updateResidentDto.building || user.building;
      const flatNo = updateResidentDto.flatNo || user.flatNo;
      updateResidentDto.address = `${building}, Flat ${flatNo}`;
    }

    Object.assign(user, updateResidentDto);
    return user.save();
  }

  async deleteResident(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async verifyResidentId(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Resident not found');
    }

    // Fetch owner details if it's a family member or tenant linked to an owner
    let ownerName: string | undefined = undefined;
    if (user.parentUserId) {
      const owner = await this.userModel.findById(user.parentUserId);
      if (owner) {
        ownerName = owner.fullName;
      }
    }

    return {
      userId: user._id,
      fullName: user.fullName,
      role: user.role,
      block: user.block,
      flat: user.flat,
      profilePhoto: user.profilePhoto,
      isApproved: user.isApprovedByAdmin,
      relation: user.relation,
      ownerName: ownerName,
    };
  }

  async getResidentsWithSubUsers(
    building?: string,
    search?: string,
    role?: string,
  ) {
    const query: any = { parentUserId: { $exists: false } };

    if (role && role !== 'all') {
      query.role = role;
    } else {
      // Only get owners/main residents (not sub-users)
      query.role = { $in: ['Owner', 'Tenant', 'Family Member', null] };
    }

    if (building) {
      query.building = { $regex: building, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { flat: { $regex: search, $options: 'i' } },
        { flatNo: { $regex: search, $options: 'i' } },
      ];
    }

    const residents = await this.userModel
      .find(query)
      .select('_id fullName email phoneNumber role relation parentUserId building block flat flatNo isEmailVerified isApprovedByAdmin isProfileComplete createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // For each resident, fetch their sub-users
    const result = await Promise.all(
      residents.map(async (resident: any) => {
        const residentId = resident._id ? resident._id.toString() : null;
        const subUsers = await this.userModel
          .find({ parentUserId: residentId })
          .select('_id fullName email phoneNumber role relation building block flat flatNo isEmailVerified isApprovedByAdmin createdAt')
          .lean()
          .exec();

        return {
          id: residentId,
          _id: residentId,
          fullName: resident.fullName || null,
          email: resident.email || null,
          phoneNumber: resident.phoneNumber || null,
          role: resident.role || null,
          building: resident.building || null,
          block: resident.block || null,
          flat: resident.flat || null,
          flatNo: resident.flatNo || null,
          isEmailVerified: resident.isEmailVerified || false,
          isApprovedByAdmin: resident.isApprovedByAdmin || false,
          isProfileComplete: resident.isProfileComplete || false,
          createdAt: resident.createdAt ? new Date(resident.createdAt).toISOString() : null,
          subUsers: subUsers.map((su: any) => ({
            id: su._id ? su._id.toString() : null,
            _id: su._id ? su._id.toString() : null,
            fullName: su.fullName || null,
            email: su.email || null,
            phoneNumber: su.phoneNumber || null,
            role: su.role || null,
            relation: su.relation || null,
            building: su.building || null,
            block: su.block || null,
            flat: su.flat || null,
            flatNo: su.flatNo || null,
            isEmailVerified: su.isEmailVerified || false,
            isApprovedByAdmin: su.isApprovedByAdmin || false,
            createdAt: su.createdAt ? new Date(su.createdAt).toISOString() : null,
          })),
        };
      }),
    );

    return result;
  }

    async getResidentsSummary() {
    const total = await this.userModel.countDocuments({
      isProfileComplete: true,
    });

    const byType = await this.userModel.aggregate([
      { $match: { isProfileComplete: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const byBuilding = await this.userModel.aggregate([
      { $match: { isProfileComplete: true } },
      { $group: { _id: '$building', count: { $sum: 1 } } },
    ]);

    return {
      total,
      byType: byType.reduce((acc: any, item: any) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      byBuilding: byBuilding.reduce((acc: any, item: any) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
    };
  }

  async getPendingResidents() {
    try {
      console.log('🔍 getPendingResidents called');

      // Get users who have completed profile (have password OR isProfileComplete: true) but are not approved
      // Use find with explicit select to ensure only needed fields are returned
      const query = this.userModel.find({
        $or: [
          // Users who have password (completed profile) but not approved
          {
            password: { $exists: true, $ne: null },
            isApprovedByAdmin: false,
          },
          // Users who have isProfileComplete: true but not approved
          {
            isProfileComplete: true,
            isApprovedByAdmin: false,
          },
        ],
      });

      // Explicitly select only the fields we want - this is critical
      query.select(
        'email fullName phoneNumber role block flat flatNo building isEmailVerified isApprovedByAdmin isProfileComplete createdAt updatedAt',
      );

      // Sort and use lean for better performance
      query.sort({ createdAt: -1 });
      query.lean();

      const pendingResidents = await query.exec();

      console.log(
        '🔍 Query executed, result type:',
        Array.isArray(pendingResidents) ? 'array' : typeof pendingResidents,
      );
      console.log(
        '🔍 Result length:',
        Array.isArray(pendingResidents) ? pendingResidents.length : 'N/A',
      );

      if (!Array.isArray(pendingResidents)) {
        console.error(
          '❌ ERROR: pendingResidents is not an array!',
          typeof pendingResidents,
        );
        return [];
      }

      // Debug: Log the raw results
      console.log('Raw pending residents count:', pendingResidents.length);
      if (pendingResidents.length > 0) {
        console.log('Sample raw user keys:', Object.keys(pendingResidents[0]));
        console.log(
          'Sample raw user (first 200 chars):',
          JSON.stringify(pendingResidents[0]).substring(0, 200),
        );
      }

      // Map and structure the response properly - explicitly construct clean objects
      const cleanedResidents = pendingResidents.map((user: any) => {
        // Convert _id to string safely
        const userId = user._id
          ? typeof user._id === 'object'
            ? user._id.toString()
            : String(user._id)
          : null;

        // Explicitly construct clean object - DO NOT use spread operator
        const cleanUser = {
          id: userId,
          _id: userId,
          email: user.email || null,
          fullName: user.fullName || null,
          phoneNumber: user.phoneNumber || null,
          role: user.role || null,
          block: user.block || null,
          flat: user.flat || null,
          flatNo: user.flatNo || null,
          building: user.building || null,
          isEmailVerified: user.isEmailVerified || false,
          isApprovedByAdmin: user.isApprovedByAdmin || false,
          isProfileComplete: user.isProfileComplete || false,
          createdAt: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : null,
          updatedAt: user.updatedAt
            ? new Date(user.updatedAt).toISOString()
            : null,
        };

        // Double-check: explicitly remove any unwanted fields (shouldn't be needed but safety)
        delete (cleanUser as any).password;
        delete (cleanUser as any).emailOtp;
        delete (cleanUser as any).emailOtpExpiresAt;
        delete (cleanUser as any).passwordResetOtp;
        delete (cleanUser as any).passwordResetOtpExpiresAt;
        delete (cleanUser as any).otp;
        delete (cleanUser as any).otpExpiresAt;
        delete (cleanUser as any).fcmToken;
        delete (cleanUser as any).__v;

        return cleanUser;
      });

      console.log('Cleaned residents count:', cleanedResidents.length);
      if (cleanedResidents.length > 0) {
        console.log(
          'Sample cleaned user keys:',
          Object.keys(cleanedResidents[0]),
        );
        console.log(
          'Sample cleaned user:',
          JSON.stringify(cleanedResidents[0], null, 2),
        );
      }

      return cleanedResidents;
    } catch (error) {
      console.error('Error fetching pending residents:', error);
      console.error('Error stack:', error.stack);
      throw new BadRequestException(
        `Failed to fetch pending residents: ${error.message}`,
      );
    }
  }

  async approveResident(id: string) {
    // Validate id is a valid ObjectId format
    if (!id || id === 'pending' || typeof id !== 'string' || id.length !== 24) {
      throw new BadRequestException('Invalid resident ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Resident not found');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException('Email not verified');
    }

    if (!user.password) {
      throw new BadRequestException('Profile not completed');
    }

    user.isApprovedByAdmin = true;
    await user.save();

    // Send welcome email
    if (user.email && user.fullName) {
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.fullName);
      } catch (error) {
        // Log error but don't fail the approval
        console.error('Failed to send welcome email:', error);
      }
    }

    return {
      message: 'Resident approved successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isApprovedByAdmin: user.isApprovedByAdmin,
      },
    };
  }

  async rejectResident(id: string, reason?: string) {
    // Validate id is a valid ObjectId format
    if (!id || id === 'pending' || typeof id !== 'string' || id.length !== 24) {
      throw new BadRequestException('Invalid resident ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Resident not found');
    }

    // Optionally delete or mark as rejected
    // For now, we'll just delete the user
    await this.userModel.findByIdAndDelete(id);

    return {
      message: 'Resident registration rejected',
      reason: reason || 'Registration rejected by admin',
    };
  }

  // Vehicles
  async getAllVehicles() {
    return this.vehicleModel
      .find({ isActive: true })
      .populate('userId', 'fullName building flatNo')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Parcels
  async getAllParcels(status?: string, search?: string) {
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { trackingNumber: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
      ];
    }
    return this.parcelModel
      .find(query)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getParcelsStats() {
    const [total, pending, collected, returned] = await Promise.all([
      this.parcelModel.countDocuments(),
      this.parcelModel.countDocuments({ status: 'Pending' }),
      this.parcelModel.countDocuments({ status: 'Collected' }),
      this.parcelModel.countDocuments({ status: 'Returned' }),
    ]);
    return { total, pending, collected, returned };
  }

  async getPendingParcels() {
    return this.parcelModel
      .find({ status: 'Pending' })
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getParcelById(id: string) {
    const parcelEntry = await this.parcelModel
      .findById(id)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .exec();
    if (!parcelEntry) {
      throw new NotFoundException('Parcel not found');
    }
    return parcelEntry;
  }

  async adminCreateParcel(dto: any) {
    const parcel = new this.parcelModel({
      ...dto,
      status: 'Pending',
    });
    return parcel.save();
  }

  async updateParcelStatus(
    id: string,
    status: string,
    collectedBy?: string,
    notes?: string,
  ) {
    const parcelEntry = await this.parcelModel.findById(id);
    if (!parcelEntry) {
      throw new NotFoundException('Parcel not found');
    }

    parcelEntry.status = status as any;
    if (status === 'Collected') {
      parcelEntry.collectedBy = collectedBy || 'Guard';
      parcelEntry.collectedAt = new Date();
    }
    if (status === 'Returned') {
      parcelEntry.returnedAt = new Date();
    }
    if (notes) {
      parcelEntry.notes = notes;
    }

    return parcelEntry.save();
  }

  async returnParcel(id: string, notes?: string) {
    return this.updateParcelStatus(id, 'Returned', undefined, notes);
  }

  // Documents
  async getAllDocuments(search?: string, filter?: 'all' | 'verified' | 'pending') {
    const query: any = {};
    if (filter === 'verified') query.isVerified = true;
    if (filter === 'pending') query.isVerified = false;

    let docs = await this.documentModel
      .find(query)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ createdAt: -1 })
      .exec();

    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.documentType.toLowerCase().includes(s) ||
          d.documentNumber.toLowerCase().includes(s) ||
          (d.userId as any)?.fullName?.toLowerCase().includes(s),
      );
    }
    return docs;
  }

  async getDocumentStats() {
    const total = await this.documentModel.countDocuments();
    const verified = await this.documentModel.countDocuments({ isVerified: true });
    const pending = await this.documentModel.countDocuments({ isVerified: false });
    const expiringInDays = 30;
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + expiringInDays);
    const expiringSoon = await this.documentModel.countDocuments({
      expiryDate: { $lte: expiringDate, $gte: new Date() },
    });
    return { total, verified, pending, expiringSoon };
  }

  async verifyDocument(id: string) {
    const document = await this.documentModel.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    document.isVerified = true;
    document.verifiedAt = new Date();
    return document.save();
  }

  async deleteAdminDocument(id: string) {
    const document = await this.documentModel.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.documentModel.findByIdAndDelete(id).exec();
  }

  // Emergency Contacts
  async getAllEmergencyContacts() {
    return this.emergencyContactModel
      .find({ isActive: true })
      .sort({ contactType: 1, name: 1 })
      .exec();
  }

  async createEmergencyContact(data: any) {
    const contact = new this.emergencyContactModel(data);
    return contact.save();
  }

  async updateEmergencyContact(id: string, data: any) {
    const contact = await this.emergencyContactModel.findById(id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    Object.assign(contact, data);
    return contact.save();
  }

  async deleteEmergencyContact(id: string) {
    return this.emergencyContactModel.findByIdAndDelete(id).exec();
  }

  // Pets Management
  async getAllPets() {
    return this.petModel
      .find({ isActive: true })
      .populate('userId', 'fullName phoneNumber building flatNo')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPetById(id: string) {
    const pet = await this.petModel
      .findById(id)
      .populate('userId', 'fullName phoneNumber building flatNo')
      .exec();
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    return pet;
  }

  async createPet(data: any) {
    const pet = new this.petModel(data);
    return pet.save();
  }

  async updatePet(id: string, data: any) {
    const pet = await this.petModel.findById(id);
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    Object.assign(pet, data);
    return pet.save();
  }

  async deletePet(id: string) {
    const pet = await this.petModel.findById(id);
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    pet.isActive = false;
    return pet.save();
  }

  // Visitors Management
  async getAllVisitors(
    status?: string,
    type?: string,
    preApproved?: boolean,
    search?: string,
  ) {
    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (preApproved !== undefined) query.isPreApproved = preApproved;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }

    const visitors = await this.visitorModel
      .find(query)
      .populate('userId', 'fullName phoneNumber building flatNo')
      .sort({ createdAt: -1 })
      .exec();

    return visitors;
  }

  async getVisitorStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, todayCount, inside, pending, preApproved] = await Promise.all([
      this.visitorModel.countDocuments(),
      this.visitorModel.countDocuments({ createdAt: { $gte: today } }),
      this.visitorModel.countDocuments({ status: VisitorStatus.INSIDE }),
      this.visitorModel.countDocuments({ status: VisitorStatus.PENDING }),
      this.visitorModel.countDocuments({ isPreApproved: true }),
    ]);
    return { total, today: todayCount, inside, pending, preApproved };
  }

  async getTodayVisitors() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.visitorModel
      .find({
        createdAt: { $gte: today },
      })
      .populate('userId', 'fullName phoneNumber building flatNo')
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteVisitor(id: string) {
    const visitor = await this.visitorModel.findById(id);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    return this.visitorModel.findByIdAndDelete(id).exec();
  }

  async getVisitorStatus(id: string) {
    const visitor = await this.visitorModel
      .findById(id)
      .select('status entryTime exitTime')
      .lean()
      .exec();
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    return visitor;
  }

  async lookupResidentByFlat(building: string, flatNo: string) {
    const residents = await this.userModel
      .find({
        $or: [
          { building: { $regex: `^${building}$`, $options: 'i' }, flatNo: { $regex: `^${flatNo}$`, $options: 'i' } },
          { building: { $regex: `^${building}$`, $options: 'i' }, flat: { $regex: `^${flatNo}$`, $options: 'i' } },
        ],
        isApprovedByAdmin: true,
      })
      .select('fullName phoneNumber building flatNo block profilePhoto')
      .lean()
      .exec();

    if (!residents || residents.length === 0) {
      return [];
    }

    return residents.map(r => ({
      id: r._id?.toString(),
      fullName: r.fullName,
      phoneNumber: r.phoneNumber,
      building: r.building,
      flatNo: r.flatNo || (r as any).flat,
      block: r.block,
      profilePhoto: r.profilePhoto,
    }));
  }

  async getPreApprovedVisitors() {
    return this.visitorModel
      .find({ isPreApproved: true })
      .populate('userId', 'fullName phoneNumber building flatNo')
      .sort({ expectedDate: 1 })
      .exec();
  }

  async approveVisitor(id: string) {
    const visitor = await this.visitorModel.findById(id);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.APPROVED;
    return visitor.save();
  }

  async rejectVisitor(id: string) {
    const visitor = await this.visitorModel.findById(id);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.REJECTED;
    return visitor.save();
  }

  async recordVisitorEntry(id: string) {
    const visitor = await this.visitorModel.findById(id);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    // Check if the visitor pass was created more than 24 hours ago
    const timeSinceCreation = Date.now() - (visitor as any).createdAt.getTime();
    if (timeSinceCreation > 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Cannot record entry. This visitor pass has expired (created more than 24 hours ago).');
    }

    visitor.status = VisitorStatus.INSIDE;
    visitor.entryTime = new Date();
    return visitor.save();
  }

  async recordVisitorExit(id: string) {
    const visitor = await this.visitorModel.findById(id);
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }
    visitor.status = VisitorStatus.LEFT;
    visitor.exitTime = new Date();
    return visitor.save();
  }

  // QR Code Verification
  async createVisitor(createDto: CreateVisitorDto & { userId?: string }) {
    // Admin/Guard can create visitors
    // Find first user as default if userId not provided
    let userId: Types.ObjectId;
    if (createDto.userId) {
      userId = new Types.ObjectId(createDto.userId);
    } else {
      const firstUser = await this.userModel.findOne().exec();
      if (!firstUser) {
        throw new NotFoundException(
          'No users found. Please create a user first.',
        );
      }
      userId = firstUser._id;
    }

    // Generate QR code data
    const qrData = JSON.stringify({
      visitorId: new Types.ObjectId().toString(),
      userId: userId.toString(),
      timestamp: Date.now(),
    });

    const visitor = new this.visitorModel({
      name: createDto.name,
      type: createDto.type,
      phoneNumber: createDto.phoneNumber,
      profilePhoto: createDto.profilePhoto,
      isPreApproved: createDto.isPreApproved,
      expectedDate: createDto.expectedDate
        ? new Date(createDto.expectedDate)
        : undefined,
      vehicleNumber: (createDto as any).vehicleNumber,
      guestCount: (createDto as any).guestCount ?? 1,
      userId: userId,
      status: createDto.isPreApproved
        ? VisitorStatus.APPROVED
        : VisitorStatus.PENDING,
      qrCode: qrData,
    });

    const savedVisitor = await visitor.save();

    // Update QR code with actual visitor ID
    savedVisitor.qrCode = JSON.stringify({
      visitorId: savedVisitor._id.toString(),
      userId: userId.toString(),
      timestamp: Date.now(),
    });

    return savedVisitor.save();
  }

  async verifyVisitorQR(qrData: string) {
    try {
      console.log('🔍 Verifying QR code:', qrData);
      const data = JSON.parse(qrData);
      console.log('🔍 Parsed QR data:', data);

      if (!data.visitorId) {
        throw new UnauthorizedException('Invalid QR code: missing visitorId');
      }

      const visitor = await this.visitorModel
        .findById(data.visitorId)
        .populate('userId', 'fullName phoneNumber building flatNo')
        .exec();

      if (!visitor) {
        throw new NotFoundException('Visitor not found');
      }

      // Check if QR code is valid (not expired)
      // Default validity: 24 hours, configurable via environment variable
      const QR_VALIDITY_HOURS = parseInt(
        process.env.QR_VALIDITY_HOURS || '24',
        10,
      );
      const QR_VALIDITY_MS = QR_VALIDITY_HOURS * 60 * 60 * 1000;

      const qrTimestamp = data.timestamp;
      if (!qrTimestamp) {
        throw new UnauthorizedException('Invalid QR code: missing timestamp');
      }

      const now = Date.now();
      const timeElapsed = now - qrTimestamp;
      const timeRemaining = QR_VALIDITY_MS - timeElapsed;

      if (timeElapsed > QR_VALIDITY_MS) {
        const hoursExpired = Math.floor(timeElapsed / (60 * 60 * 1000));
        throw new UnauthorizedException(
          `QR code expired ${hoursExpired} hour(s) ago. Validity: ${QR_VALIDITY_HOURS} hours.`,
        );
      }

      // Calculate expiration time and remaining validity
      const expirationTime = qrTimestamp + QR_VALIDITY_MS;
      const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
      const minutesRemaining = Math.floor(
        (timeRemaining % (60 * 60 * 1000)) / (60 * 1000),
      );

      return {
        visitor: {
          id: visitor._id.toString(),
          name: visitor.name,
          type: visitor.type,
          status: visitor.status,
          phoneNumber: visitor.phoneNumber,
          isPreApproved: visitor.isPreApproved,
          userId: visitor.userId,
        },
        isValid: true,
        validity: {
          createdAt: new Date(qrTimestamp).toISOString(),
          expiresAt: new Date(expirationTime).toISOString(),
          hoursRemaining,
          minutesRemaining,
          validityHours: QR_VALIDITY_HOURS,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid QR code');
    }
  }

  // Event Management
  async getAllEvents(status?: string) {
    const query: any = {};
    if (status) {
      query.status = status;
    }
    return this.eventModel
      .find(query)
      .populate('createdBy', 'fullName phoneNumber building flatNo')
      .sort({ startDate: -1 })
      .exec();
  }

  async getEventById(id: string) {
    const event = await this.eventModel
      .findById(id)
      .populate('createdBy', 'fullName phoneNumber building flatNo')
      .exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async createEvent(body: any) {
    // For admin-created events, we need to set createdBy
    // Since admin JWT doesn't have a userId, we'll use the first user as fallback
    let createdByUserId: Types.ObjectId;

    if (body.createdBy && Types.ObjectId.isValid(body.createdBy)) {
      // Use provided createdBy if it's a valid ObjectId
      createdByUserId = new Types.ObjectId(body.createdBy);
    } else {
      // Try to find the first user (as a fallback for admin-created events)
      // In production, you should have a dedicated admin user
      const firstUser = await this.userModel.findOne().exec();
      if (firstUser) {
        createdByUserId = firstUser._id;
      } else {
        // If no users exist, we'll need to create a system admin user
        // For now, throw an error - in production, create a system admin user
        throw new NotFoundException(
          'No user found. Please create a user first or provide a valid createdBy.',
        );
      }
    }

    const event = new this.eventModel({
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || EventStatus.PUBLISHED,
      createdBy: createdByUserId,
      invitedUsers: body.invitedUsers
        ? body.invitedUsers.map((id: string) => new Types.ObjectId(id))
        : [],
    });
    return event.save();
  }

  async updateEvent(id: string, body: any) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (body.startDate) body.startDate = new Date(body.startDate);
    if (body.endDate) body.endDate = new Date(body.endDate);
    if (body.invitedUsers) {
      body.invitedUsers = body.invitedUsers.map(
        (id: string) => new Types.ObjectId(id),
      );
    }

    Object.assign(event, body);
    return event.save();
  }

  async updateEventStatus(id: string, status: string) {
    const validStatuses = ['Draft', 'Published', 'Cancelled', 'Completed'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    event.status = status as any;
    return event.save();
  }

  async deleteEvent(id: string) {
    const event = await this.eventModel.findByIdAndDelete(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return { message: 'Event deleted successfully' };
  }

  // Notification Management
  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToUser(
      userId,
      title,
      body,
      data,
    );
  }

  async sendNotificationToGuard(
    guardId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToGuard(
      guardId,
      title,
      body,
      data,
    );
  }

  async sendNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToMultipleUsers(
      userIds,
      title,
      body,
      data,
    );
  }

  async sendNotificationToAllUsers(
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToAllUsers(
      title,
      body,
      data,
    );
  }

  async sendNotificationToAllGuards(
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToAllGuards(
      title,
      body,
      data,
    );
  }

  // Parking Management
  async getAllParkingSlots() {
    return this.parkingSlotModel
      .find()
      .populate('assignedTo', 'fullName building flatNo phoneNumber')
      .sort({ floor: 1, slotNumber: 1 })
      .exec();
  }

  async getAllParkingApplications() {
    return this.parkingApplicationModel
      .find()
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async assignParkingSlot(
    slotId: string,
    userId: string,
    licensePlate?: string,
    vehicleName?: string,
  ) {
    const slot = await this.parkingSlotModel.findById(slotId);
    if (!slot) {
      throw new NotFoundException('Parking slot not found');
    }

    if (slot.status === SlotStatus.OCCUPIED) {
      throw new BadRequestException('Parking slot is already occupied');
    }

    slot.assignedTo = new Types.ObjectId(userId);
    slot.status = SlotStatus.OCCUPIED;
    if (licensePlate) slot.licensePlate = licensePlate;
    if (vehicleName) slot.vehicleName = vehicleName;

    return slot.save();
  }

  async approveParkingApplication(applicationId: string, slotId?: string) {
    const application =
      await this.parkingApplicationModel.findById(applicationId);
    if (!application) {
      throw new NotFoundException('Parking application not found');
    }

    application.status = ApplicationStatus.APPROVED;

    // If slotId is provided, assign the slot
    if (slotId) {
      await this.assignParkingSlot(
        slotId,
        application.userId.toString(),
        application.licensePlate,
        application.vehicle,
      );
    }

    return application.save();
  }

  async rejectParkingApplication(applicationId: string) {
    const application =
      await this.parkingApplicationModel.findById(applicationId);
    if (!application) {
      throw new NotFoundException('Parking application not found');
    }

    application.status = ApplicationStatus.REJECTED;
    return application.save();
  }

  async getParkingByBuilding() {
    const buildings = await this.buildingModel
      .find({ isActive: true })
      .select('_id name address')
      .lean()
      .exec();

    const results = await Promise.all(
      buildings.map(async (b) => {
        const buildingId = b._id;
        const slots = await this.parkingSlotModel
          .find({ building: buildingId })
          .lean()
          .exec();

        const total = slots.length;
        const occupied = slots.filter(
          (s) => s.status === SlotStatus.OCCUPIED,
        ).length;
        const vacant = total - occupied;

        const byType: Record<string, { total: number; occupied: number }> = {};
        for (const s of slots) {
          const t = s.parkingType ?? s.slotType ?? 'Unknown';
          if (!byType[t]) byType[t] = { total: 0, occupied: 0 };
          byType[t].total++;
          if (s.status === SlotStatus.OCCUPIED) byType[t].occupied++;
        }

        return {
          building: b,
          stats: { total, occupied, vacant },
          byType,
        };
      }),
    );

    return results;
  }

  async getParkingSlotsByBuilding(buildingId: string) {
    return this.parkingSlotModel
      .find({ building: new Types.ObjectId(buildingId) })
      .populate('assignedTo', 'fullName flatNo phoneNumber')
      .sort({ floor: 1, slotNumber: 1 })
      .exec();
  }

  async bulkCreateParkingSlots(
    buildingId: string,
    floor: string,
    parkingType: string,
    prefix: string,
    startNumber: number,
    count: number,
  ) {
    const building = await this.buildingModel.findById(buildingId);
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    const slots = Array.from({ length: count }, (_, i) => ({
      building: new Types.ObjectId(buildingId),
      buildingName: building.name,
      slotNumber: `${prefix}${String(startNumber + i).padStart(3, '0')}`,
      floor,
      parkingType,
      slotType: SlotType.MAIN,
      status: SlotStatus.VACANT,
    }));

    return this.parkingSlotModel.insertMany(slots);
  }

  async deleteParkingSlot(slotId: string) {
    const slot = await this.parkingSlotModel.findById(slotId);
    if (!slot) {
      throw new NotFoundException('Parking slot not found');
    }
    if (slot.status === SlotStatus.OCCUPIED) {
      throw new BadRequestException(
        'Cannot delete an occupied slot. Release it first.',
      );
    }
    await this.parkingSlotModel.findByIdAndDelete(slotId);
    return { message: 'Slot deleted successfully' };
  }

  async releaseParkingSlot(slotId: string) {
    const slot = await this.parkingSlotModel.findById(slotId);
    if (!slot) {
      throw new NotFoundException('Parking slot not found');
    }
    slot.status = SlotStatus.VACANT;
    slot.assignedTo = undefined;
    slot.licensePlate = undefined;
    slot.vehicleName = undefined;
    return slot.save();
  }

  // Maintenance Management
  async getAllMaintenance(status?: string) {
    const query: any = {};
    if (status) {
      query.status = status;
    }

    return this.maintenanceModel
      .find(query)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ dueDate: 1 })
      .exec();
  }

  async markMaintenancePaid(
    id: string,
    paymentMethod: string,
    transactionId: string,
  ) {
    const maintenance = await this.maintenanceModel.findById(id);
    if (!maintenance) {
      throw new NotFoundException('Maintenance record not found');
    }

    maintenance.status = PaymentStatus.PAID;
    maintenance.paidDate = new Date();
    maintenance.paymentMethod = paymentMethod;
    maintenance.transactionId = transactionId;

    return maintenance.save();
  }

  // Amenities Booking Management
  // ──────────────────────────────────────────────
  // Amenity Configuration CRUD
  // ──────────────────────────────────────────────

  async getAllAmenityConfigs() {
    return this.amenityModel.find().sort({ name: 1 }).exec();
  }

  async createAmenityConfig(data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    fee: number;
    maxCapacityPerSlot?: number;
    availableSlots?: string[];
    rules?: string;
    isActive?: boolean;
  }) {
    const existing = await this.amenityModel.findOne({ name: data.name });
    if (existing) {
      throw new BadRequestException(
        `An amenity named "${data.name}" already exists`,
      );
    }
    const amenity = new this.amenityModel(data);
    return amenity.save();
  }

  async updateAmenityConfig(
    id: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      fee?: number;
      maxCapacityPerSlot?: number;
      availableSlots?: string[];
      rules?: string;
      isActive?: boolean;
    },
  ) {
    const amenity = await this.amenityModel.findById(id);
    if (!amenity) throw new NotFoundException('Amenity not found');
    Object.assign(amenity, data);
    return amenity.save();
  }

  async deleteAmenityConfig(id: string) {
    const amenity = await this.amenityModel.findById(id);
    if (!amenity) throw new NotFoundException('Amenity not found');
    await this.amenityModel.deleteOne({ _id: id });
    return { success: true };
  }

  async getAmenityStats() {
    const [total, confirmed, pending, cancelled, completed] = await Promise.all([
      this.amenityBookingModel.countDocuments(),
      this.amenityBookingModel.countDocuments({ status: BookingStatus.CONFIRMED }),
      this.amenityBookingModel.countDocuments({ status: BookingStatus.PENDING }),
      this.amenityBookingModel.countDocuments({ status: BookingStatus.CANCELLED }),
      this.amenityBookingModel.countDocuments({ status: BookingStatus.COMPLETED }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = await this.amenityBookingModel.countDocuments({
      bookingDate: { $gte: today },
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
    });

    const [revenueResult, pendingPaymentResult] = await Promise.all([
      this.amenityBookingModel.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$fee' } } },
      ]),
      this.amenityBookingModel.aggregate([
        { $match: { paymentStatus: 'Payment Pending' } },
        { $group: { _id: null, total: { $sum: '$fee' } } },
      ]),
    ]);

    return {
      total,
      confirmed,
      pending,
      cancelled,
      completed,
      upcoming,
      totalRevenue: revenueResult[0]?.total || 0,
      pendingPayment: pendingPaymentResult[0]?.total || 0,
    };
  }

  async getAllAmenityBookings(status?: string, amenityType?: string, date?: string) {
    const query: any = {};
    if (status) query.status = status;
    if (amenityType) query.amenityType = amenityType;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      query.bookingDate = {
        $gte: d,
        $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    return this.amenityBookingModel
      .find(query)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .sort({ bookingDate: -1, timeSlot: 1 })
      .exec();
  }

  async getAmenityBookingById(id: string) {
    const booking = await this.amenityBookingModel
      .findById(id)
      .populate('userId', 'fullName building flatNo phoneNumber')
      .exec();

    if (!booking) {
      throw new NotFoundException('Amenity booking not found');
    }

    return booking;
  }

  async approveAmenityBooking(id: string) {
    const booking = await this.amenityBookingModel.findById(id);
    if (!booking) throw new NotFoundException('Amenity booking not found');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be approved');
    }
    booking.status = BookingStatus.CONFIRMED;
    return booking.save();
  }

  async completeAmenityBooking(id: string) {
    const booking = await this.amenityBookingModel.findById(id);
    if (!booking) throw new NotFoundException('Amenity booking not found');
    booking.status = BookingStatus.COMPLETED;
    (booking as any).completedAt = new Date();
    return booking.save();
  }

  async markAmenityPaymentPaid(
    id: string,
    paymentMethod: string,
    transactionId?: string,
  ) {
    const booking = await this.amenityBookingModel.findById(id);
    if (!booking) throw new NotFoundException('Amenity booking not found');
    (booking as any).paymentStatus = 'Paid';
    (booking as any).paymentMethod = paymentMethod;
    if (transactionId) (booking as any).transactionId = transactionId;
    (booking as any).paidAt = new Date();
    return booking.save();
  }

  async cancelAmenityBooking(id: string) {
    const booking = await this.amenityBookingModel.findById(id);
    if (!booking) {
      throw new NotFoundException('Amenity booking not found');
    }

    const bookingDate = new Date(booking.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Cannot cancel past bookings');
    }

    booking.status = BookingStatus.CANCELLED;
    (booking as any).cancelledAt = new Date();
    return booking.save();
  }
}
