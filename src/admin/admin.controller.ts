import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
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
import { CreateVisitorDto } from '../visitors/dto/create-visitor.dto';
import { S3Service } from '../common/s3.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly s3Service: S3Service,
  ) { }

  // Auth endpoints (no guard)
  @Post('auth/login')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticates an admin user with email and password. Returns a JWT token for accessing protected endpoints.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'admin_id',
          email: 'admin@smartgate.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.adminService.login(loginDto.email, loginDto.password);
  }

  // Guard Auth endpoints (no guard)
  @Post('guard/auth/login')
  async guardLogin(@Body() body: { phoneNumber: string; password: string }) {
    return this.adminService.guardLogin(body.phoneNumber, body.password);
  }

  @Get('guard/profile')
  @UseGuards(JwtAuthGuard)
  async getGuardProfile(@Request() req) {
    return this.adminService.getGuardById(req.user.userId);
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
  async createGuard(
    @Body()
    body: {
      guardId: string;
      phoneNumber: string;
      password: string;
      name: string;
      email?: string;
      shift?: string;
      gateNumber?: string;
    },
  ) {
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
  async resetGuardPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.adminService.resetGuardPassword(id, body.password);
  }

  @Post('guards/:id/generate-password')
  @UseGuards(JwtAuthGuard)
  async generateGuardPassword(@Param('id') id: string) {
    return this.adminService.generateGuardPassword(id);
  }

  @Put('guard/fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateGuardFcmToken(
    @Request() req,
    @Body() body: { fcmToken: string },
  ) {
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
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
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
  async assignStaff(
    @Param('id') id: string,
    @Body() body: { staffId: string },
  ) {
    return this.adminService.assignStaff(id, body.staffId);
  }

  @Put('complaints/:id/reassign')
  @UseGuards(JwtAuthGuard)
  async reassignStaff(
    @Param('id') id: string,
    @Body() body: { staffId: string },
  ) {
    return this.adminService.reassignStaff(id, body.staffId);
  }

  @Post('complaints/:id/resolve')
  @UseGuards(JwtAuthGuard)
  async resolveComplaint(@Param('id') id: string) {
    return this.adminService.resolveComplaint(id);
  }

  // Reminders APIs
  @Get('reminders')
  @UseGuards(JwtAuthGuard)
  async getAllReminders() {
    return this.adminService.getAllReminders();
  }

  @Get('reminders/stats')
  @UseGuards(JwtAuthGuard)
  async getReminderStats() {
    return this.adminService.getReminderStats();
  }

  @Get('reminders/upcoming')
  @UseGuards(JwtAuthGuard)
  async getUpcomingReminders(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getUpcomingReminders(parsedLimit);
  }

  @Get('reminders/overdue')
  @UseGuards(JwtAuthGuard)
  async getOverdueReminders() {
    return this.adminService.getOverdueReminders();
  }

  @Get('reminders/:id')
  @UseGuards(JwtAuthGuard)
  async getReminderById(@Param('id') id: string) {
    return this.adminService.getReminderById(id);
  }

  // Escalation APIs
  @Get('escalation/stats')
  @UseGuards(JwtAuthGuard)
  async getEscalationStats() {
    return this.adminService.getEscalationStats();
  }

  @Post('complaints/:id/escalate')
  @UseGuards(JwtAuthGuard)
  async escalateComplaint(
    @Param('id') id: string,
    @Body() body: { toLevel: string; reason: string; escalatedBy: string },
  ) {
    return this.adminService.escalateComplaint(
      id,
      body.toLevel,
      body.reason,
      body.escalatedBy,
    );
  }

  @Get('complaints/:id/escalation-history')
  @UseGuards(JwtAuthGuard)
  async getComplaintEscalationHistory(@Param('id') id: string) {
    return this.adminService.getComplaintEscalationHistory(id);
  }

  @Post('complaints/:id/comments')
  @UseGuards(JwtAuthGuard)
  async addComplaintComment(
    @Param('id') id: string,
    @Body() body: { comment: string; staffId?: string },
  ) {
    return this.adminService.addComplaintComment(id, body.comment, body.staffId);
  }

  // Contacts APIs (Emergency & Vendor)
  @Get('contacts')
  @UseGuards(JwtAuthGuard)
  async getAllContacts(@Query('type') type?: string) {
    return this.adminService.getAllContacts(type);
  }

  @Get('contacts/:id')
  @UseGuards(JwtAuthGuard)
  async getContactById(@Param('id') id: string) {
    return this.adminService.getContactById(id);
  }

  @Post('contacts')
  @UseGuards(JwtAuthGuard)
  async createContact(@Body() contactData: any) {
    return this.adminService.createContact(contactData);
  }

  @Put('contacts/:id')
  @UseGuards(JwtAuthGuard)
  async updateContact(@Param('id') id: string, @Body() contactData: any) {
    return this.adminService.updateContact(id, contactData);
  }

  @Put('contacts/:id/toggle-active')
  @UseGuards(JwtAuthGuard)
  async toggleContactActive(@Param('id') id: string) {
    return this.adminService.toggleContactActive(id);
  }

  @Delete('contacts/:id')
  @UseGuards(JwtAuthGuard)
  async deleteContact(@Param('id') id: string) {
    return this.adminService.deleteContact(id);
  }

  // Billing APIs
  @Get('billing/stats')
  @UseGuards(JwtAuthGuard)
  async getMaintenanceOverallStats() {
    return this.adminService.getMaintenanceOverallStats();
  }

  @Get('billing/summary')
  @UseGuards(JwtAuthGuard)
  async getBillingSummary(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.adminService.getBillingSummary(month, year);
  }

  @Get('billing/entries')
  @UseGuards(JwtAuthGuard)
  async getBillingEntries(
    @Query('status') status?: 'Paid' | 'Unpaid' | 'Overdue',
    @Query('search') search?: string,
  ) {
    return this.adminService.getBillingEntries(status, search);
  }

  @Put('billing/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  async markAsPaid(
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; transactionId?: string },
  ) {
    return this.adminService.markBillingAsPaid(
      id,
      body.paymentMethod,
      body.transactionId,
    );
  }

  @Post('billing/mark-overdue')
  @UseGuards(JwtAuthGuard)
  async markBulkOverdue() {
    return this.adminService.markBulkOverdue();
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
  @ApiOperation({
    summary: 'Create notice with attachments',
    description: 'Creates a notice and uploads attachment files to S3.',
  })
  @ApiConsumes('multipart/form-data')
  async createNotice(
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let attachmentUrls: string[] = [];

    if (files && files.length > 0) {
      attachmentUrls = await Promise.all(
        files.map((file) =>
          this.s3Service.uploadFile(file, 'notices/attachments'),
        ),
      );
    }

    const data = {
      title: body.title,
      content: body.content,
      category: body.category,
      expiryDate: body.expiryDate,
      attachments: attachmentUrls,
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
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.adminService.getAllStaff(type, search, includeInactive === 'true');
  }

  // Specific routes MUST come before /:id to avoid NestJS matching them as the id param
  @Get('staff/available')
  @UseGuards(JwtAuthGuard)
  async getAvailableStaff() {
    return this.adminService.getAvailableStaff();
  }

  @Get('staff/type/:type')
  @UseGuards(JwtAuthGuard)
  async getStaffByType(@Param('type') type: StaffType) {
    return this.adminService.getStaffByType(type);
  }

  @Get('staff/stats/summary')
  @UseGuards(JwtAuthGuard)
  async getStaffSummary() {
    return this.adminService.getStaffSummary();
  }

  @Get('staff/:id/activity')
  @UseGuards(JwtAuthGuard)
  async getStaffActivityAdmin(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.adminService.getStaffActivityAdmin(
      id,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
  }

  @Post('staff/:id/check-in')
  @UseGuards(JwtAuthGuard)
  async adminCheckIn(@Param('id') id: string) {
    return this.adminService.adminCheckIn(id);
  }

  @Post('staff/:id/check-out')
  @UseGuards(JwtAuthGuard)
  async adminCheckOut(@Param('id') id: string) {
    return this.adminService.adminCheckOut(id);
  }

  @Patch('staff/:id/toggle-active')
  @UseGuards(JwtAuthGuard)
  async toggleStaffActive(@Param('id') id: string) {
    return this.adminService.toggleStaffActive(id);
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
  async updateStaff(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffAdminDto,
  ) {
    return this.adminService.updateStaff(id, updateStaffDto);
  }

  @Delete('staff/:id')
  @UseGuards(JwtAuthGuard)
  async deleteStaff(@Param('id') id: string) {
    return this.adminService.deleteStaff(id);
  }

  // Residents APIs
  @Get('residents/pending')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get pending resident approvals',
    description:
      'Returns all residents who have completed registration but are waiting for admin approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending residents retrieved successfully',
  })
  async getPendingResidents() {
    const result = await this.adminService.getPendingResidents();
    // Ensure we return the cleaned array, not raw MongoDB documents
    console.log(
      'Controller: result type:',
      Array.isArray(result) ? 'array' : typeof result,
    );
    console.log(
      'Controller: result length:',
      Array.isArray(result) ? result.length : 'N/A',
    );
    if (Array.isArray(result) && result.length > 0) {
      console.log('Controller: first item keys:', Object.keys(result[0]));
    } else {
      console.log('Controller: result value:', JSON.stringify(result, null, 2));
    }
    return Array.isArray(result) ? result : [];
  }

  @Get('residents')
  @UseGuards(JwtAuthGuard)
  async getAllResidents(
    @Query('building') building?: string,
    @Query('residentType') residentType?: string,
    @Query('search') search?: string,
    @Query('pendingApproval') pendingApproval?: string,
  ) {
    return this.adminService.getAllResidents(
      building,
      residentType,
      search,
      pendingApproval === 'true',
    );
  }

  @Get('residents/lookup')
  @UseGuards(JwtAuthGuard)
  async lookupResidentByFlat(
    @Query('building') building: string,
    @Query('flat') flat: string,
  ) {
    return this.adminService.lookupResidentByFlat(building, flat);
  }

  @Get('residents/:id')
  @UseGuards(JwtAuthGuard)
  async getResidentById(@Param('id') id: string) {
    return this.adminService.getResidentById(id);
  }

  @Get('residents/:id/verify-id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Verify Resident ID (For Guards)',
    description: 'Returns essential profile verification details based on userId payload from QR.',
  })
  @ApiParam({ name: 'id', description: 'User ID to verify' })
  @ApiResponse({ status: 200, description: 'Resident verification details retrieved successfully' })
  async verifyResidentId(@Param('id') id: string) {
    return this.adminService.verifyResidentId(id);
  }

  @Post('residents')
  @UseGuards(JwtAuthGuard)
  async createResident(@Body() createResidentDto: CreateResidentDto) {
    return this.adminService.createResident(createResidentDto);
  }

  @Put('residents/:id')
  @UseGuards(JwtAuthGuard)
  async updateResident(
    @Param('id') id: string,
    @Body() updateResidentDto: UpdateResidentDto,
  ) {
    return this.adminService.updateResident(id, updateResidentDto);
  }

  @Delete('residents/:id')
  @UseGuards(JwtAuthGuard)
  async deleteResident(@Param('id') id: string) {
    return this.adminService.deleteResident(id);
  }

  @Get('residents/with-sub-users')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get residents with their family members and tenants' })
  @ApiResponse({ status: 200, description: 'Residents with sub-users retrieved successfully' })
  async getResidentsWithSubUsers(
    @Query('building') building?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getResidentsWithSubUsers(building, search, role);
  }

    @Get('residents/stats/summary')
  @UseGuards(JwtAuthGuard)
  async getResidentsSummary() {
    return this.adminService.getResidentsSummary();
  }

  @Post('residents/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Approve resident registration',
    description:
      'Approves a resident registration. The resident will receive a welcome email and can now login.',
  })
  @ApiParam({ name: 'id', description: 'Resident ID' })
  @ApiResponse({
    status: 200,
    description: 'Resident approved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Resident not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Email not verified or profile not completed',
  })
  async approveResident(@Param('id') id: string) {
    return this.adminService.approveResident(id);
  }

  @Post('residents/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Reject resident registration',
    description:
      'Rejects a resident registration. The user account will be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Resident ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for rejection',
          example: 'Incomplete documentation',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Resident registration rejected',
  })
  @ApiResponse({
    status: 404,
    description: 'Resident not found',
  })
  async rejectResident(
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.adminService.rejectResident(id, body?.reason);
  }

  // Vehicles APIs
  @Get('vehicles')
  @UseGuards(JwtAuthGuard)
  async getAllVehicles() {
    return this.adminService.getAllVehicles();
  }

  // Parking Management APIs
  @Get('parking/by-building')
  @UseGuards(JwtAuthGuard)
  async getParkingByBuilding() {
    return this.adminService.getParkingByBuilding();
  }

  @Get('parking/buildings/:buildingId/slots')
  @UseGuards(JwtAuthGuard)
  async getParkingSlotsByBuilding(@Param('buildingId') buildingId: string) {
    return this.adminService.getParkingSlotsByBuilding(buildingId);
  }

  @Post('parking/slots/bulk')
  @UseGuards(JwtAuthGuard)
  async bulkCreateParkingSlots(
    @Body()
    body: {
      buildingId: string;
      floor: string;
      parkingType: string;
      prefix: string;
      startNumber: number;
      count: number;
    },
  ) {
    return this.adminService.bulkCreateParkingSlots(
      body.buildingId,
      body.floor,
      body.parkingType,
      body.prefix,
      body.startNumber,
      body.count,
    );
  }

  @Delete('parking/slots/:id')
  @UseGuards(JwtAuthGuard)
  async deleteParkingSlot(@Param('id') slotId: string) {
    return this.adminService.deleteParkingSlot(slotId);
  }

  @Post('parking/slots/:id/release')
  @UseGuards(JwtAuthGuard)
  async releaseParkingSlot(@Param('id') slotId: string) {
    return this.adminService.releaseParkingSlot(slotId);
  }

  @Get('parking/slots')
  @UseGuards(JwtAuthGuard)
  async getAllParkingSlots() {
    return this.adminService.getAllParkingSlots();
  }

  @Get('parking/applications')
  @UseGuards(JwtAuthGuard)
  async getAllParkingApplications() {
    return this.adminService.getAllParkingApplications();
  }

  @Post('parking/slots/:id/assign')
  @UseGuards(JwtAuthGuard)
  async assignParkingSlot(
    @Param('id') slotId: string,
    @Body()
    body: { userId: string; licensePlate?: string; vehicleName?: string },
  ) {
    return this.adminService.assignParkingSlot(
      slotId,
      body.userId,
      body.licensePlate,
      body.vehicleName,
    );
  }

  @Post('parking/applications/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveParkingApplication(
    @Param('id') applicationId: string,
    @Body() body: { slotId?: string },
  ) {
    return this.adminService.approveParkingApplication(
      applicationId,
      body.slotId,
    );
  }

  @Post('parking/applications/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectParkingApplication(@Param('id') applicationId: string) {
    return this.adminService.rejectParkingApplication(applicationId);
  }

  // Maintenance Payment APIs
  @Get('maintenance/all')
  @UseGuards(JwtAuthGuard)
  async getAllMaintenance(@Query('status') status?: string) {
    return this.adminService.getAllMaintenance(status);
  }

  @Post('maintenance/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  async markMaintenancePaid(
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; transactionId: string },
  ) {
    return this.adminService.markMaintenancePaid(
      id,
      body.paymentMethod,
      body.transactionId,
    );
  }

  // Amenities Booking APIs
  // Amenity Configuration CRUD
  @Get('amenities/configs')
  @UseGuards(JwtAuthGuard)
  async getAllAmenityConfigs() {
    return this.adminService.getAllAmenityConfigs();
  }

  @Post('amenities/configs')
  @UseGuards(JwtAuthGuard)
  async createAmenityConfig(@Body() body: any) {
    return this.adminService.createAmenityConfig(body);
  }

  @Put('amenities/configs/:id')
  @UseGuards(JwtAuthGuard)
  async updateAmenityConfig(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAmenityConfig(id, body);
  }

  @Delete('amenities/configs/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAmenityConfig(@Param('id') id: string) {
    return this.adminService.deleteAmenityConfig(id);
  }

  @Get('amenities/stats')
  @UseGuards(JwtAuthGuard)
  async getAmenityStats() {
    return this.adminService.getAmenityStats();
  }

  @Get('amenities/bookings')
  @UseGuards(JwtAuthGuard)
  async getAllAmenityBookings(
    @Query('status') status?: string,
    @Query('amenityType') amenityType?: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.getAllAmenityBookings(status, amenityType, date);
  }

  @Get('amenities/bookings/:id')
  @UseGuards(JwtAuthGuard)
  async getAmenityBookingById(@Param('id') id: string) {
    return this.adminService.getAmenityBookingById(id);
  }

  @Post('amenities/bookings/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveAmenityBooking(@Param('id') id: string) {
    return this.adminService.approveAmenityBooking(id);
  }

  @Post('amenities/bookings/:id/complete')
  @UseGuards(JwtAuthGuard)
  async completeAmenityBooking(@Param('id') id: string) {
    return this.adminService.completeAmenityBooking(id);
  }

  @Post('amenities/bookings/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  async markAmenityPaymentPaid(
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; transactionId?: string },
  ) {
    return this.adminService.markAmenityPaymentPaid(
      id,
      body.paymentMethod,
      body.transactionId,
    );
  }

  @Post('amenities/bookings/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelAmenityBooking(@Param('id') id: string) {
    return this.adminService.cancelAmenityBooking(id);
  }

  // Parcels APIs
  @Get('parcels/stats')
  @UseGuards(JwtAuthGuard)
  async getParcelsStats() {
    return this.adminService.getParcelsStats();
  }

  @Get('parcels')
  @UseGuards(JwtAuthGuard)
  async getAllParcels(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllParcels(status, search);
  }

  @Post('parcels')
  @UseGuards(JwtAuthGuard)
  async adminCreateParcel(@Body() body: any) {
    return this.adminService.adminCreateParcel(body);
  }

  @Get('parcels/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingParcels() {
    return this.adminService.getPendingParcels();
  }

  @Get('parcels/:id')
  @UseGuards(JwtAuthGuard)
  async getParcelById(@Param('id') id: string) {
    return this.adminService.getParcelById(id);
  }

  @Put('parcels/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateParcelStatus(
    @Param('id') id: string,
    @Body() body: { status: string; collectedBy?: string; notes?: string },
  ) {
    return this.adminService.updateParcelStatus(
      id,
      body.status,
      body.collectedBy,
      body.notes,
    );
  }

  @Put('parcels/:id/collect')
  @UseGuards(JwtAuthGuard)
  async collectParcel(
    @Param('id') id: string,
    @Body() body: { collectedBy: string; notes?: string },
  ) {
    return this.adminService.updateParcelStatus(
      id,
      'Collected',
      body.collectedBy,
      body.notes,
    );
  }

  @Put('parcels/:id/return')
  @UseGuards(JwtAuthGuard)
  async returnParcel(
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.adminService.returnParcel(id, body.notes);
  }

  // Documents APIs
  @Get('documents/stats')
  @UseGuards(JwtAuthGuard)
  async getDocumentStats() {
    return this.adminService.getDocumentStats();
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard)
  async getAllDocuments(
    @Query('search') search?: string,
    @Query('filter') filter?: 'all' | 'verified' | 'pending',
  ) {
    return this.adminService.getAllDocuments(search, filter);
  }

  @Put('documents/:id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(@Param('id') id: string) {
    return this.adminService.verifyDocument(id);
  }

  @Delete('documents/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAdminDocument(@Param('id') id: string) {
    return this.adminService.deleteAdminDocument(id);
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

  // Visitors APIs — specific routes BEFORE /:id
  @Get('visitors/stats')
  @UseGuards(JwtAuthGuard)
  async getVisitorStats() {
    return this.adminService.getVisitorStats();
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

  @Post('visitors/verify-qr')
  @UseGuards(JwtAuthGuard)
  async verifyVisitorQR(@Body() body: { qrData: string }) {
    return this.adminService.verifyVisitorQR(body.qrData);
  }

  @Get('visitors')
  @UseGuards(JwtAuthGuard)
  async getAllVisitors(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('preApproved') preApproved?: string,
  ) {
    return this.adminService.getAllVisitors(
      status,
      type,
      preApproved === 'true',
      search,
    );
  }

  @Get('visitors/:id/status')
  @UseGuards(JwtAuthGuard)
  async getVisitorStatus(@Param('id') id: string) {
    return this.adminService.getVisitorStatus(id);
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

  @Delete('visitors/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVisitor(@Param('id') id: string) {
    return this.adminService.deleteVisitor(id);
  }

  @Post('visitors')
  @UseGuards(JwtAuthGuard)
  async createVisitor(@Body() createDto: CreateVisitorDto) {
    return this.adminService.createVisitor(createDto);
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

  @Patch('events/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateEventStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateEventStatus(id, status);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(id);
  }

  // Notification Management APIs
  @Post('notifications/send-to-user')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToUser(
    @Body()
    body: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.adminService.sendNotificationToUser(
      body.userId,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('notifications/send-to-guard')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToGuard(
    @Body()
    body: {
      guardId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.adminService.sendNotificationToGuard(
      body.guardId,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('notifications/send-to-multiple')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToMultiple(
    @Body()
    body: {
      userIds: string[];
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.adminService.sendNotificationToMultipleUsers(
      body.userIds,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('notifications/send-to-all-users')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToAllUsers(
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.adminService.sendNotificationToAllUsers(
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('notifications/send-to-all-guards')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToAllGuards(
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.adminService.sendNotificationToAllGuards(
      body.title,
      body.body,
      body.data,
    );
  }
}
