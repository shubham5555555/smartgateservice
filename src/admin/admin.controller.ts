import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFiles, UnauthorizedException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { CreateStaffAdminDto } from './dto/create-staff-admin.dto';
import { UpdateStaffAdminDto } from './dto/update-staff-admin.dto';
import { StaffType } from '../schemas/staff.schema';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Auth endpoints (no guard)
  @Post('auth/login')
  async login(@Body() loginDto: LoginDto) {
    return this.adminService.login(loginDto.email, loginDto.password);
  }

  // Guard Auth endpoints (no guard)
  @Post('guard/auth/login')
  async guardLogin(@Body() body: { phoneNumber: string; password: string }) {
    return this.adminService.guardLogin(body.phoneNumber, body.password);
  }

  // Guard Management APIs
  @Get('guards')
  @UseGuards(JwtAuthGuard)
  async getAllGuards() {
    return this.adminService.getAllGuards();
  }

  @Get('guards/:id')
  @UseGuards(JwtAuthGuard)
  async getGuardById(@Param('id') id: string) {
    return this.adminService.getGuardById(id);
  }

  @Post('guards')
  @UseGuards(JwtAuthGuard)
  async createGuard(@Body() body: {
    guardId: string;
    phoneNumber: string;
    password: string;
    name: string;
    email?: string;
    shift?: string;
    gateNumber?: string;
  }) {
    return this.adminService.createGuard(body);
  }

  @Put('guards/:id')
  @UseGuards(JwtAuthGuard)
  async updateGuard(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateGuard(id, body);
  }

  @Delete('guards/:id')
  @UseGuards(JwtAuthGuard)
  async deleteGuard(@Param('id') id: string) {
    return this.adminService.deleteGuard(id);
  }

  @Post('guards/:id/reset-password')
  @UseGuards(JwtAuthGuard)
  async resetGuardPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.adminService.resetGuardPassword(id, body.password);
  }

  @Post('guards/:id/generate-password')
  @UseGuards(JwtAuthGuard)
  async generateGuardPassword(@Param('id') id: string) {
    return this.adminService.generateGuardPassword(id);
  }

  @Put('guard/fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateGuardFcmToken(@Request() req, @Body() body: { fcmToken: string }) {
    // Extract phone number from JWT token (for guard login)
    const phoneNumber = req.user?.phoneNumber;
    if (!phoneNumber) {
      throw new UnauthorizedException('Phone number not found in token');
    }
    return this.adminService.updateGuardFcmToken(phoneNumber, body.fcmToken);
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req) {
    return this.adminService.getCurrentUser(req.user);
  }

  @Post('auth/refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@Request() req) {
    return this.adminService.refreshToken(req.user);
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.adminService.changePassword(
      req.user.email,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  // Dashboard APIs (protected)
  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/visitor-trends')
  @UseGuards(JwtAuthGuard)
  async getVisitorTrends(@Query('period') period: 'week' | 'month' = 'week') {
    return this.adminService.getVisitorTrends(period);
  }

  @Get('dashboard/visitor-types')
  @UseGuards(JwtAuthGuard)
  async getVisitorTypes() {
    return this.adminService.getVisitorTypes();
  }

  @Get('dashboard/recent-activity')
  @UseGuards(JwtAuthGuard)
  async getRecentActivity() {
    return this.adminService.getRecentActivity();
  }

  @Get('dashboard/priority-actions')
  @UseGuards(JwtAuthGuard)
  async getPriorityActions() {
    return this.adminService.getPriorityActions();
  }

  // Complaints APIs
  @Get('complaints')
  @UseGuards(JwtAuthGuard)
  async getAllComplaints() {
    return this.adminService.getAllComplaints();
  }

  @Get('complaints/:id')
  @UseGuards(JwtAuthGuard)
  async getComplaintById(@Param('id') id: string) {
    return this.adminService.getComplaintById(id);
  }

  @Put('complaints/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.adminService.updateComplaintStatus(id, body.status, body.note);
  }

  @Post('complaints/:id/assign')
  @UseGuards(JwtAuthGuard)
  async assignStaff(@Param('id') id: string, @Body() body: { staffId: string }) {
    return this.adminService.assignStaff(id, body.staffId);
  }

  @Put('complaints/:id/reassign')
  @UseGuards(JwtAuthGuard)
  async reassignStaff(@Param('id') id: string, @Body() body: { staffId: string }) {
    return this.adminService.reassignStaff(id, body.staffId);
  }

  @Post('complaints/:id/resolve')
  @UseGuards(JwtAuthGuard)
  async resolveComplaint(@Param('id') id: string) {
    return this.adminService.resolveComplaint(id);
  }

  // Billing APIs
  @Get('billing/summary')
  @UseGuards(JwtAuthGuard)
  async getBillingSummary(@Query('month') month: string, @Query('year') year: string) {
    return this.adminService.getBillingSummary(month, year);
  }

  @Get('billing/entries')
  @UseGuards(JwtAuthGuard)
  async getBillingEntries(@Query('status') status?: 'Paid' | 'Unpaid') {
    return this.adminService.getBillingEntries(status);
  }

  @Put('billing/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  async markAsPaid(@Param('id') id: string) {
    return this.adminService.markAsPaid(id);
  }

  @Post('billing/send-reminders')
  @UseGuards(JwtAuthGuard)
  async sendReminders(@Body() body: { ids: string[] }) {
    return this.adminService.sendReminders(body.ids);
  }

  @Post('billing/generate')
  @UseGuards(JwtAuthGuard)
  async generateBill(@Body() body: any) {
    return this.adminService.generateBill(body);
  }

  // Access Control APIs
  @Get('access-control/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingRequests() {
    return this.adminService.getPendingRequests();
  }

  @Post('access-control/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveRequest(@Param('id') id: string) {
    return this.adminService.approveRequest(id);
  }

  @Post('access-control/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectRequest(@Param('id') id: string) {
    return this.adminService.rejectRequest(id);
  }

  @Get('access-control/approved-today')
  @UseGuards(JwtAuthGuard)
  async getApprovedToday() {
    return this.adminService.getApprovedToday();
  }

  @Get('access-control/rejected-today')
  @UseGuards(JwtAuthGuard)
  async getRejectedToday() {
    return this.adminService.getRejectedToday();
  }

  // Notice APIs
  @Get('notices')
  @UseGuards(JwtAuthGuard)
  async getAllNotices() {
    return this.adminService.getAllNotices();
  }

  @Get('notices/:id')
  @UseGuards(JwtAuthGuard)
  async getNoticeById(@Param('id') id: string) {
    return this.adminService.getNoticeById(id);
  }

  @Post('notices')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('attachments', 10))
  async createNotice(
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const data = {
      title: body.title,
      content: body.content,
      category: body.category,
      expiryDate: body.expiryDate,
      attachments: files?.map((f) => f.filename || f.originalname) || [],
    };
    return this.adminService.createNotice(data);
  }

  @Put('notices/:id')
  @UseGuards(JwtAuthGuard)
  async updateNotice(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateNotice(id, body);
  }

  @Delete('notices/:id')
  @UseGuards(JwtAuthGuard)
  async deleteNotice(@Param('id') id: string) {
    return this.adminService.deleteNotice(id);
  }

  // Staff APIs
  @Get('staff')
  @UseGuards(JwtAuthGuard)
  async getAllStaff(
    @Query('type') type?: StaffType,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllStaff(type, search);
  }

  @Get('staff/:id')
  @UseGuards(JwtAuthGuard)
  async getStaffById(@Param('id') id: string) {
    return this.adminService.getStaffById(id);
  }

  @Post('staff')
  @UseGuards(JwtAuthGuard)
  async createStaff(@Body() createStaffDto: CreateStaffAdminDto) {
    return this.adminService.createStaff(createStaffDto);
  }

  @Put('staff/:id')
  @UseGuards(JwtAuthGuard)
  async updateStaff(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffAdminDto) {
    return this.adminService.updateStaff(id, updateStaffDto);
  }

  @Delete('staff/:id')
  @UseGuards(JwtAuthGuard)
  async deleteStaff(@Param('id') id: string) {
    return this.adminService.deleteStaff(id);
  }

  @Get('staff/type/:type')
  @UseGuards(JwtAuthGuard)
  async getStaffByType(@Param('type') type: StaffType) {
    return this.adminService.getStaffByType(type);
  }

  @Get('staff/available')
  @UseGuards(JwtAuthGuard)
  async getAvailableStaff() {
    return this.adminService.getAvailableStaff();
  }

  @Get('staff/stats/summary')
  @UseGuards(JwtAuthGuard)
  async getStaffSummary() {
    return this.adminService.getStaffSummary();
  }

  // Residents APIs
  @Get('residents')
  @UseGuards(JwtAuthGuard)
  async getAllResidents(
    @Query('building') building?: string,
    @Query('residentType') residentType?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllResidents(building, residentType, search);
  }

  @Get('residents/:id')
  @UseGuards(JwtAuthGuard)
  async getResidentById(@Param('id') id: string) {
    return this.adminService.getResidentById(id);
  }

  @Post('residents')
  @UseGuards(JwtAuthGuard)
  async createResident(@Body() createResidentDto: CreateResidentDto) {
    return this.adminService.createResident(createResidentDto);
  }

  @Put('residents/:id')
  @UseGuards(JwtAuthGuard)
  async updateResident(@Param('id') id: string, @Body() updateResidentDto: UpdateResidentDto) {
    return this.adminService.updateResident(id, updateResidentDto);
  }

  @Delete('residents/:id')
  @UseGuards(JwtAuthGuard)
  async deleteResident(@Param('id') id: string) {
    return this.adminService.deleteResident(id);
  }

  @Get('residents/stats/summary')
  @UseGuards(JwtAuthGuard)
  async getResidentsSummary() {
    return this.adminService.getResidentsSummary();
  }

  // Vehicles APIs
  @Get('vehicles')
  @UseGuards(JwtAuthGuard)
  async getAllVehicles() {
    return this.adminService.getAllVehicles();
  }

  // Packages APIs
  @Get('packages')
  @UseGuards(JwtAuthGuard)
  async getAllPackages() {
    return this.adminService.getAllPackages();
  }

  // Documents APIs
  @Get('documents')
  @UseGuards(JwtAuthGuard)
  async getAllDocuments() {
    return this.adminService.getAllDocuments();
  }

  @Put('documents/:id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(@Param('id') id: string) {
    return this.adminService.verifyDocument(id);
  }

  // Emergency Contacts APIs
  @Get('emergency/contacts')
  @UseGuards(JwtAuthGuard)
  async getAllEmergencyContacts() {
    return this.adminService.getAllEmergencyContacts();
  }

  @Post('emergency/contacts')
  @UseGuards(JwtAuthGuard)
  async createEmergencyContact(@Body() body: any) {
    return this.adminService.createEmergencyContact(body);
  }

  @Put('emergency/contacts/:id')
  @UseGuards(JwtAuthGuard)
  async updateEmergencyContact(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEmergencyContact(id, body);
  }

  @Delete('emergency/contacts/:id')
  @UseGuards(JwtAuthGuard)
  async deleteEmergencyContact(@Param('id') id: string) {
    return this.adminService.deleteEmergencyContact(id);
  }

  // Visitors APIs
  @Get('visitors')
  @UseGuards(JwtAuthGuard)
  async getAllVisitors(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('preApproved') preApproved?: string,
  ) {
    return this.adminService.getAllVisitors(status, type, preApproved === 'true');
  }

  @Get('visitors/today')
  @UseGuards(JwtAuthGuard)
  async getTodayVisitors() {
    return this.adminService.getTodayVisitors();
  }

  @Get('visitors/pre-approved')
  @UseGuards(JwtAuthGuard)
  async getPreApprovedVisitors() {
    return this.adminService.getPreApprovedVisitors();
  }

  @Post('visitors/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveVisitor(@Param('id') id: string) {
    return this.adminService.approveVisitor(id);
  }

  @Post('visitors/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectVisitor(@Param('id') id: string) {
    return this.adminService.rejectVisitor(id);
  }

  @Post('visitors/:id/entry')
  @UseGuards(JwtAuthGuard)
  async recordVisitorEntry(@Param('id') id: string) {
    return this.adminService.recordVisitorEntry(id);
  }

  @Post('visitors/:id/exit')
  @UseGuards(JwtAuthGuard)
  async recordVisitorExit(@Param('id') id: string) {
    return this.adminService.recordVisitorExit(id);
  }

  @Post('visitors/verify-qr')
  @UseGuards(JwtAuthGuard)
  async verifyVisitorQR(@Body() body: { qrData: string }) {
    return this.adminService.verifyVisitorQR(body.qrData);
  }

  // Pets Management
  @Get('pets')
  @UseGuards(JwtAuthGuard)
  async getAllPets() {
    return this.adminService.getAllPets();
  }

  @Get('pets/:id')
  @UseGuards(JwtAuthGuard)
  async getPetById(@Param('id') id: string) {
    return this.adminService.getPetById(id);
  }

  @Post('pets')
  @UseGuards(JwtAuthGuard)
  async createPet(@Body() body: any) {
    return this.adminService.createPet(body);
  }

  @Put('pets/:id')
  @UseGuards(JwtAuthGuard)
  async updatePet(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePet(id, body);
  }

  @Delete('pets/:id')
  @UseGuards(JwtAuthGuard)
  async deletePet(@Param('id') id: string) {
    return this.adminService.deletePet(id);
  }

  // Chat Management
  @Get('chat/messages')
  @UseGuards(JwtAuthGuard)
  async getAllChatMessages(@Query('limit') limit?: string) {
    const messageLimit = limit ? parseInt(limit, 10) : 100;
    return this.adminService.getAllChatMessages(messageLimit);
  }

  @Delete('chat/messages/:id')
  @UseGuards(JwtAuthGuard)
  async deleteChatMessage(@Param('id') id: string) {
    return this.adminService.deleteChatMessage(id);
  }

  // Event Management APIs
  @Get('events')
  @UseGuards(JwtAuthGuard)
  async getAllEvents(@Query('status') status?: string) {
    return this.adminService.getAllEvents(status);
  }

  @Get('events/:id')
  @UseGuards(JwtAuthGuard)
  async getEventById(@Param('id') id: string) {
    return this.adminService.getEventById(id);
  }

  @Post('events')
  @UseGuards(JwtAuthGuard)
  async createEvent(@Body() body: any, @Request() req) {
    // Admin JWT doesn't have a userId, so we'll pass undefined
    // The service will find the first user as a fallback
    return this.adminService.createEvent(body);
  }

  @Put('events/:id')
  @UseGuards(JwtAuthGuard)
  async updateEvent(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEvent(id, body);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(id);
  }

  // Notification Management APIs
  @Post('notifications/send-to-user')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToUser(@Body() body: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    return this.adminService.sendNotificationToUser(body.userId, body.title, body.body, body.data);
  }

  @Post('notifications/send-to-guard')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToGuard(@Body() body: {
    guardId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    return this.adminService.sendNotificationToGuard(body.guardId, body.title, body.body, body.data);
  }

  @Post('notifications/send-to-multiple')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToMultiple(@Body() body: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    return this.adminService.sendNotificationToMultipleUsers(body.userIds, body.title, body.body, body.data);
  }

  @Post('notifications/send-to-all-users')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToAllUsers(@Body() body: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    return this.adminService.sendNotificationToAllUsers(body.title, body.body, body.data);
  }

  @Post('notifications/send-to-all-guards')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToAllGuards(@Body() body: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    return this.adminService.sendNotificationToAllGuards(body.title, body.body, body.data);
  }
}
