import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { Visitor, VisitorDocument, VisitorStatus, VisitorType } from '../schemas/visitor.schema';
import { Maintenance, MaintenanceDocument, PaymentStatus } from '../schemas/maintenance.schema';
import { Staff, StaffDocument, StaffType, StaffStatus } from '../schemas/staff.schema';
import { Complaint, ComplaintDocument, ComplaintStatus } from '../schemas/complaint.schema';
import { Notice, NoticeDocument, NoticeStatus } from '../schemas/notice.schema';
import { AccessRequest, AccessRequestDocument, AccessRequestStatus } from '../schemas/access-request.schema';
import { Vehicle, VehicleDocument } from '../schemas/vehicle.schema';
import { Package, PackageDocument } from '../schemas/package.schema';
import { DocumentFile, DocumentDocument } from '../schemas/document.schema';
import { EmergencyContact, EmergencyContactDocument } from '../schemas/emergency-contact.schema';
import { Guard, GuardDocument } from '../schemas/guard.schema';
import { Pet, PetDocument } from '../schemas/pet.schema';
import { ChatMessage, ChatMessageDocument } from '../schemas/chat.schema';
import { Event, EventDocument, EventStatus } from '../schemas/event.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Maintenance.name) private maintenanceModel: Model<MaintenanceDocument>,
    @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
    @InjectModel(Complaint.name) private complaintModel: Model<ComplaintDocument>,
    @InjectModel(Notice.name) private noticeModel: Model<NoticeDocument>,
    @InjectModel(AccessRequest.name) private accessRequestModel: Model<AccessRequestDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
    @InjectModel(DocumentFile.name) private documentModel: Model<DocumentDocument>,
    @InjectModel(EmergencyContact.name) private emergencyContactModel: Model<EmergencyContactDocument>,
    @InjectModel(Guard.name) private guardModel: Model<GuardDocument>,
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private jwtService: JwtService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) {}

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
  async guardLogin(phoneNumber: string, password: string) {
    const guard = await this.guardModel.findOne({ phoneNumber, isActive: true }).exec();
    
    if (!guard) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const isPasswordValid = await bcrypt.compare(password, guard.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    // Generate JWT token for guard
    const payload = { guardId: guard.guardId, phoneNumber: guard.phoneNumber, sub: guard._id.toString(), role: 'guard' };
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
    return { message: 'FCM token updated successfully', fcmToken: guard.fcmToken };
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
    const existingGuard = await this.guardModel.findOne({
      $or: [{ guardId: data.guardId }, { phoneNumber: data.phoneNumber }],
    }).exec();

    if (existingGuard) {
      throw new UnauthorizedException('Guard ID or phone number already exists');
    }

    const guard = new this.guardModel(data);
    return guard.save();
  }

  async updateGuard(id: string, data: Partial<{
    name: string;
    email: string;
    shift: string;
    gateNumber: string;
    isActive: boolean;
    isOnDuty: boolean;
    password?: string;
  }>) {
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

  async changePassword(email: string, currentPassword: string, newPassword: string) {
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
    const occupiedFlats = await this.userModel.countDocuments({ isProfileComplete: true });
    
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

    return {
      totalFlats,
      occupiedFlats,
      todayVisitors,
      duesCollected: duesCollected[0]?.total || 0,
      pendingComplaints,
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
        day: period === 'week' 
          ? date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

    const typeCounts = visitors.reduce((acc, visitor) => {
      acc[visitor.type] = (acc[visitor.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComplaintById(id: string) {
    return this.complaintModel
      .findById(id)
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .exec();
  }

  async updateComplaintStatus(id: string, status: string, note?: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new Error('Complaint not found');
    }
    complaint.status = status as ComplaintStatus;
    if (note) {
      complaint.notes = note;
    }
    return complaint.save();
  }

  async assignStaff(id: string, staffId: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new Error('Complaint not found');
    }
    complaint.assignedTo = new Types.ObjectId(staffId);
    complaint.status = ComplaintStatus.ASSIGNED;
    return complaint.save();
  }

  async reassignStaff(id: string, staffId: string) {
    return this.assignStaff(id, staffId);
  }

  async resolveComplaint(id: string) {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) {
      throw new Error('Complaint not found');
    }
    complaint.status = ComplaintStatus.RESOLVED;
    if (complaint.assignedTo) {
      complaint.resolvedBy = complaint.assignedTo;
    }
    return complaint.save();
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

  async getBillingEntries(status?: 'Paid' | 'Unpaid') {
    const query: any = {};
    if (status === 'Paid') {
      query.status = PaymentStatus.PAID;
    } else if (status === 'Unpaid') {
      query.status = { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] };
    }

    const entries = await this.maintenanceModel
      .find(query)
      .populate('userId', 'fullName address')
      .sort({ dueDate: 1 })
      .exec();

    return entries.map((entry) => ({
      id: entry._id.toString(),
      flatNo: (entry.userId as any)?.address || 'N/A',
      resident: {
        name: (entry.userId as any)?.fullName || 'Unknown',
      },
      amount: entry.amount,
      dueDate: entry.dueDate ? entry.dueDate.toISOString() : new Date().toISOString(),
      status: entry.status === PaymentStatus.PAID ? 'Paid' : 'Unpaid',
    }));
  }

  async markAsPaid(id: string) {
    const maintenance = await this.maintenanceModel.findById(id);
    if (!maintenance) {
      throw new Error('Billing entry not found');
    }
    maintenance.status = PaymentStatus.PAID;
    maintenance.paidDate = new Date();
    return maintenance.save();
  }

  async sendReminders(ids: string[]) {
    // In production, this would send email/SMS reminders
    return { success: true, message: 'Reminders sent', count: ids.length };
  }

  async generateBill(data: any) {
    // Generate bills for all users or specific blocks
    const users = await this.userModel.find({ isProfileComplete: true });
    
    const bills = users.map((user) => ({
      userId: user._id,
      title: `Maintenance Fee - ${data.month} ${data.year}`,
      amount: data.maintenanceAmount + data.waterCharges + data.sinkingFund,
      dueDate: new Date(data.dueDate),
      status: 'Pending',
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
      status: new Date(data.expiryDate) > new Date() ? NoticeStatus.ACTIVE : NoticeStatus.EXPIRED,
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
  async getAllStaff(type?: StaffType, search?: string) {
    const query: any = {};

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
      throw new Error('Staff with this phone number already exists for this user');
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

    return this.staffModel.findByIdAndDelete(id).exec();
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
    
    const byType = await this.staffModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const byStatus = await this.staffModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return {
      total,
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
  async getAllResidents(building?: string, residentType?: string, search?: string) {
    const query: any = {};

    if (building) {
      query.address = { $regex: building, $options: 'i' };
    }

    if (residentType) {
      // Store resident type in a custom field or use a flag
      // For now, we'll add a residentType field to user schema
      query.residentType = residentType;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    return this.userModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async getResidentById(id: string) {
    return this.userModel.findById(id).exec();
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

  async getResidentsSummary() {
    const total = await this.userModel.countDocuments({ isProfileComplete: true });
    
    const byType = await this.userModel.aggregate([
      { $match: { isProfileComplete: true } },
      { $group: { _id: '$residentType', count: { $sum: 1 } } },
    ]);

    const byBuilding = await this.userModel.aggregate([
      { $match: { isProfileComplete: true } },
      { $group: { _id: '$building', count: { $sum: 1 } } },
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      byBuilding: byBuilding.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
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

  // Packages
  async getAllPackages() {
    return this.packageModel
      .find()
      .populate('userId', 'fullName building flatNo')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Documents
  async getAllDocuments() {
    return this.documentModel
      .find()
      .populate('userId', 'fullName building flatNo')
      .sort({ createdAt: -1 })
      .exec();
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

  // Emergency Contacts
  async getAllEmergencyContacts() {
    return this.emergencyContactModel.find({ isActive: true }).sort({ contactType: 1, name: 1 }).exec();
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
    return this.petModel.find({ isActive: true }).populate('userId', 'fullName phoneNumber building flatNo').sort({ createdAt: -1 }).exec();
  }

  async getPetById(id: string) {
    const pet = await this.petModel.findById(id).populate('userId', 'fullName phoneNumber building flatNo').exec();
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

  // Chat Management
  async getAllChatMessages(limit: number = 100) {
    return this.chatMessageModel
      .find({ isDeleted: false })
      .populate('userId', 'fullName phoneNumber profilePhoto building flatNo')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async deleteChatMessage(id: string) {
    const message = await this.chatMessageModel.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    message.isDeleted = true;
    message.deletedAt = new Date();
    return message.save();
  }

  // Visitors Management
  async getAllVisitors(status?: string, type?: string, preApproved?: boolean) {
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }
    if (preApproved !== undefined) {
      query.isPreApproved = preApproved;
    }
    const visitors = await this.visitorModel.find(query).populate('userId', 'fullName phoneNumber building flatNo').sort({ createdAt: -1 }).exec();
    
    // Ensure all visitors have QR codes
    for (const visitor of visitors) {
      if (!visitor.qrCode) {
        const userId = visitor.userId instanceof Types.ObjectId 
          ? visitor.userId.toString() 
          : (visitor.userId as any)?._id?.toString() || (visitor.userId as any)?.id?.toString() || '';
        visitor.qrCode = JSON.stringify({
          visitorId: visitor._id.toString(),
          userId: userId,
          timestamp: Date.now(),
        });
        await visitor.save();
      }
    }
    
    return visitors;
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
  async verifyVisitorQR(qrData: string) {
    try {
      console.log('🔍 Verifying QR code:', qrData);
      const data = JSON.parse(qrData);
      console.log('🔍 Parsed QR data:', data);
      
      if (!data.visitorId) {
        throw new UnauthorizedException('Invalid QR code: missing visitorId');
      }
      
      const visitor = await this.visitorModel.findById(data.visitorId)
        .populate('userId', 'fullName phoneNumber building flatNo')
        .exec();
      
      if (!visitor) {
        throw new NotFoundException('Visitor not found');
      }

      // Check if QR code is valid (not expired)
      // Default validity: 24 hours, configurable via environment variable
      const QR_VALIDITY_HOURS = parseInt(process.env.QR_VALIDITY_HOURS || '24', 10);
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
        throw new UnauthorizedException(`QR code expired ${hoursExpired} hour(s) ago. Validity: ${QR_VALIDITY_HOURS} hours.`);
      }

      // Calculate expiration time and remaining validity
      const expirationTime = qrTimestamp + QR_VALIDITY_MS;
      const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
      const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

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
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
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
        throw new NotFoundException('No user found. Please create a user first or provide a valid createdBy.');
      }
    }

    const event = new this.eventModel({
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || EventStatus.PUBLISHED,
      createdBy: createdByUserId,
      invitedUsers: body.invitedUsers ? body.invitedUsers.map((id: string) => new Types.ObjectId(id)) : [],
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
      body.invitedUsers = body.invitedUsers.map((id: string) => new Types.ObjectId(id));
    }

    Object.assign(event, body);
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
  async sendNotificationToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToUser(userId, title, body, data);
  }

  async sendNotificationToGuard(guardId: string, title: string, body: string, data?: Record<string, string>) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToGuard(guardId, title, body, data);
  }

  async sendNotificationToMultipleUsers(userIds: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToMultipleUsers(userIds, title, body, data);
  }

  async sendNotificationToAllUsers(title: string, body: string, data?: Record<string, string>) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToAllUsers(title, body, data);
  }

  async sendNotificationToAllGuards(title: string, body: string, data?: Record<string, string>) {
    if (!this.notificationsService) {
      return { success: false, message: 'Notifications service not available' };
    }
    return this.notificationsService.sendNotificationToAllGuards(title, body, data);
  }
}
