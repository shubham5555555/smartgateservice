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
  Res,
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
import { VisitRulesService } from '../visits/visit-rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../tenancy/roles.guard';
import { Roles } from '../tenancy/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { CreateStaffAdminDto } from './dto/create-staff-admin.dto';
import { UpdateStaffAdminDto } from './dto/update-staff-admin.dto';
import { StaffType } from '../schemas/staff.schema';
import { CreateVisitorDto } from '../visitors/dto/create-visitor.dto';
import { GuardCheckinDto } from './dto/guard-checkin.dto';
import { S3Service } from '../common/s3.service';

@ApiTags('Admin')
@Roles('admin', 'guard') // default for every guarded route; management routes narrow to 'admin'
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getGuardProfile(@Request() req) {
    return this.adminService.getGuardById(req.user.userId);
  }

  @Get('guard/sites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Buildings the calling guard may process (their builder / assigned sites)' })
  async getGuardSites() {
    return this.adminService.getGuardSites();
  }

  // Guard Management APIs
  @Get('guards')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllGuards() {
    return this.adminService.getAllGuards();
  }

  @Get('guards/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getGuardById(@Param('id') id: string) {
    return this.adminService.getGuardById(id);
  }

  @Post('guards')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
      organizationId?: string;
      buildingIds?: string[];
    },
  ) {
    return this.adminService.createGuard(body);
  }

  @Put('guards/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateGuard(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateGuard(id, body);
  }

  @Delete('guards/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteGuard(@Param('id') id: string) {
    return this.adminService.deleteGuard(id);
  }

  @Post('guards/:id/reset-password')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async resetGuardPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.adminService.resetGuardPassword(id, body.password);
  }

  @Post('guards/:id/generate-password')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async generateGuardPassword(@Param('id') id: string) {
    return this.adminService.generateGuardPassword(id);
  }

  @Put('guard/fcm-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCurrentUser(@Request() req) {
    return this.adminService.getCurrentUser(req.user);
  }

  @Post('auth/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async refreshToken(@Request() req) {
    return this.adminService.refreshToken(req.user);
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.adminService.changePassword(
      req.user,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  // Dashboard APIs (protected)
  @Get('dashboard/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/visitor-trends')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getVisitorTrends(@Query('period') period: 'week' | 'month' = 'week') {
    return this.adminService.getVisitorTrends(period);
  }

  @Get('dashboard/visitor-types')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getVisitorTypes() {
    return this.adminService.getVisitorTypes();
  }

  @Get('dashboard/recent-activity')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getRecentActivity() {
    return this.adminService.getRecentActivity();
  }

  @Get('dashboard/priority-actions')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPriorityActions() {
    return this.adminService.getPriorityActions();
  }

  // Complaints APIs
  @Get('complaints')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllComplaints() {
    return this.adminService.getAllComplaints();
  }

  @Get('complaints/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getComplaintById(@Param('id') id: string) {
    return this.adminService.getComplaintById(id);
  }

  @Put('complaints/:id/status')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.adminService.updateComplaintStatus(id, body.status, body.note);
  }

  @Post('complaints/:id/assign')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async assignStaff(
    @Param('id') id: string,
    @Body() body: { staffId: string },
  ) {
    return this.adminService.assignStaff(id, body.staffId);
  }

  @Put('complaints/:id/reassign')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async reassignStaff(
    @Param('id') id: string,
    @Body() body: { staffId: string },
  ) {
    return this.adminService.reassignStaff(id, body.staffId);
  }

  @Post('complaints/:id/resolve')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async resolveComplaint(@Param('id') id: string) {
    return this.adminService.resolveComplaint(id);
  }

  // Reminders APIs
  @Get('reminders')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllReminders() {
    return this.adminService.getAllReminders();
  }

  @Get('reminders/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getReminderStats() {
    return this.adminService.getReminderStats();
  }

  @Get('reminders/upcoming')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getUpcomingReminders(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getUpcomingReminders(parsedLimit);
  }

  @Get('reminders/overdue')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getOverdueReminders() {
    return this.adminService.getOverdueReminders();
  }

  @Get('reminders/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getReminderById(@Param('id') id: string) {
    return this.adminService.getReminderById(id);
  }

  // Escalation APIs
  @Get('escalation/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getEscalationStats() {
    return this.adminService.getEscalationStats();
  }

  @Post('complaints/:id/escalate')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getComplaintEscalationHistory(@Param('id') id: string) {
    return this.adminService.getComplaintEscalationHistory(id);
  }

  @Post('complaints/:id/comments')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async addComplaintComment(
    @Param('id') id: string,
    @Body() body: { comment: string; staffId?: string },
  ) {
    return this.adminService.addComplaintComment(id, body.comment, body.staffId);
  }

  // Contacts APIs (Emergency & Vendor)
  @Get('contacts')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllContacts(@Query('type') type?: string) {
    return this.adminService.getAllContacts(type);
  }

  @Get('contacts/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getContactById(@Param('id') id: string) {
    return this.adminService.getContactById(id);
  }

  @Post('contacts')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createContact(@Body() contactData: any) {
    return this.adminService.createContact(contactData);
  }

  @Put('contacts/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateContact(@Param('id') id: string, @Body() contactData: any) {
    return this.adminService.updateContact(id, contactData);
  }

  @Put('contacts/:id/toggle-active')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async toggleContactActive(@Param('id') id: string) {
    return this.adminService.toggleContactActive(id);
  }

  @Delete('contacts/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteContact(@Param('id') id: string) {
    return this.adminService.deleteContact(id);
  }

  // Billing APIs
  @Get('billing/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMaintenanceOverallStats() {
    return this.adminService.getMaintenanceOverallStats();
  }

  @Get('billing/summary')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getBillingSummary(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.adminService.getBillingSummary(month, year);
  }

  @Get('billing/entries')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getBillingEntries(
    @Query('status') status?: 'Paid' | 'Unpaid' | 'Overdue',
    @Query('search') search?: string,
  ) {
    return this.adminService.getBillingEntries(status, search);
  }

  @Put('billing/:id/mark-paid')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async markBulkOverdue() {
    return this.adminService.markBulkOverdue();
  }

  @Post('billing/send-reminders')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async sendReminders(@Body() body: { ids: string[] }) {
    return this.adminService.sendReminders(body.ids);
  }

  @Post('billing/generate')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async generateBill(@Body() body: any) {
    return this.adminService.generateBill(body);
  }

  // Access Control APIs
  @Get('access-control/pending')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingRequests() {
    return this.adminService.getPendingRequests();
  }

  @Post('access-control/:id/approve')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async approveRequest(@Param('id') id: string) {
    return this.adminService.approveRequest(id);
  }

  @Post('access-control/:id/reject')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async rejectRequest(@Param('id') id: string) {
    return this.adminService.rejectRequest(id);
  }

  @Get('access-control/approved-today')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getApprovedToday() {
    return this.adminService.getApprovedToday();
  }

  @Get('access-control/rejected-today')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getRejectedToday() {
    return this.adminService.getRejectedToday();
  }

  // Notice APIs
  @Get('notices')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllNotices() {
    return this.adminService.getAllNotices();
  }

  @Get('notices/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getNoticeById(@Param('id') id: string) {
    return this.adminService.getNoticeById(id);
  }

  @Post('notices')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateNotice(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateNotice(id, body);
  }

  @Delete('notices/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteNotice(@Param('id') id: string) {
    return this.adminService.deleteNotice(id);
  }

  // Staff APIs
  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllStaff(
    @Query('type') type?: StaffType,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.adminService.getAllStaff(type, search, includeInactive === 'true');
  }

  // Specific routes MUST come before /:id to avoid NestJS matching them as the id param
  @Get('staff/available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAvailableStaff() {
    return this.adminService.getAvailableStaff();
  }

  @Get('staff/type/:type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getStaffByType(@Param('type') type: StaffType) {
    return this.adminService.getStaffByType(type);
  }

  @Get('staff/stats/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getStaffSummary() {
    return this.adminService.getStaffSummary();
  }

  @Get('staff/:id/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminCheckIn(@Param('id') id: string) {
    return this.adminService.adminCheckIn(id);
  }

  @Post('staff/:id/check-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminCheckOut(@Param('id') id: string) {
    return this.adminService.adminCheckOut(id);
  }

  @Patch('staff/:id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async toggleStaffActive(@Param('id') id: string) {
    return this.adminService.toggleStaffActive(id);
  }

  @Get('staff/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getStaffById(@Param('id') id: string) {
    return this.adminService.getStaffById(id);
  }

  @Post('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createStaff(@Body() createStaffDto: CreateStaffAdminDto) {
    return this.adminService.createStaff(createStaffDto);
  }

  @Put('staff/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateStaff(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffAdminDto,
  ) {
    return this.adminService.updateStaff(id, updateStaffDto);
  }

  @Delete('staff/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteStaff(@Param('id') id: string) {
    return this.adminService.deleteStaff(id);
  }

  // Residents APIs
  @Get('residents/pending')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async lookupResidentByFlat(
    @Query('building') building: string,
    @Query('flat') flat: string,
  ) {
    return this.adminService.lookupResidentByFlat(building, flat);
  }

  @Get('residents/with-sub-users')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getResidentsSummary() {
    return this.adminService.getResidentsSummary();
  }

  @Get('residents/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getResidentById(@Param('id') id: string) {
    return this.adminService.getResidentById(id);
  }

  @Get('residents/:id/verify-id')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createResident(@Body() createResidentDto: CreateResidentDto) {
    return this.adminService.createResident(createResidentDto);
  }

  @Put('residents/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateResident(
    @Param('id') id: string,
    @Body() updateResidentDto: UpdateResidentDto,
  ) {
    return this.adminService.updateResident(id, updateResidentDto);
  }

  @Delete('residents/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteResident(@Param('id') id: string) {
    return this.adminService.deleteResident(id);
  }



  @Post('residents/:id/approve')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllVehicles() {
    return this.adminService.getAllVehicles();
  }

  // Parking Management APIs
  @Get('parking/by-building')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getParkingByBuilding() {
    return this.adminService.getParkingByBuilding();
  }

  @Get('parking/buildings/:buildingId/slots')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getParkingSlotsByBuilding(@Param('buildingId') buildingId: string) {
    return this.adminService.getParkingSlotsByBuilding(buildingId);
  }

  @Post('parking/slots/bulk')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteParkingSlot(@Param('id') slotId: string) {
    return this.adminService.deleteParkingSlot(slotId);
  }

  @Post('parking/slots/:id/release')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async releaseParkingSlot(@Param('id') slotId: string) {
    return this.adminService.releaseParkingSlot(slotId);
  }

  @Get('parking/slots')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllParkingSlots() {
    return this.adminService.getAllParkingSlots();
  }

  @Get('parking/applications')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllParkingApplications() {
    return this.adminService.getAllParkingApplications();
  }

  @Post('parking/slots/:id/assign')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async rejectParkingApplication(@Param('id') applicationId: string) {
    return this.adminService.rejectParkingApplication(applicationId);
  }

  // Maintenance Payment APIs
  @Get('maintenance/all')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllMaintenance(@Query('status') status?: string) {
    return this.adminService.getAllMaintenance(status);
  }

  @Post('maintenance/:id/mark-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllAmenityConfigs() {
    return this.adminService.getAllAmenityConfigs();
  }

  @Post('amenities/configs')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createAmenityConfig(@Body() body: any) {
    return this.adminService.createAmenityConfig(body);
  }

  @Put('amenities/configs/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateAmenityConfig(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAmenityConfig(id, body);
  }

  @Delete('amenities/configs/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteAmenityConfig(@Param('id') id: string) {
    return this.adminService.deleteAmenityConfig(id);
  }

  @Get('amenities/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAmenityStats() {
    return this.adminService.getAmenityStats();
  }

  @Get('amenities/bookings')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllAmenityBookings(
    @Query('status') status?: string,
    @Query('amenityType') amenityType?: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.getAllAmenityBookings(status, amenityType, date);
  }

  @Get('amenities/bookings/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAmenityBookingById(@Param('id') id: string) {
    return this.adminService.getAmenityBookingById(id);
  }

  @Post('amenities/bookings/:id/approve')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async approveAmenityBooking(@Param('id') id: string) {
    return this.adminService.approveAmenityBooking(id);
  }

  @Post('amenities/bookings/:id/complete')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async completeAmenityBooking(@Param('id') id: string) {
    return this.adminService.completeAmenityBooking(id);
  }

  @Post('amenities/bookings/:id/mark-paid')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async cancelAmenityBooking(@Param('id') id: string) {
    return this.adminService.cancelAmenityBooking(id);
  }

  // Parcels APIs
  @Get('parcels/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getParcelsStats() {
    return this.adminService.getParcelsStats();
  }

  @Get('parcels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllParcels(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.adminService.getAllParcels(status, search, buildingId);
  }

  @Post('parcels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminCreateParcel(@Body() body: any) {
    return this.adminService.adminCreateParcel(body);
  }

  @Get('parcels/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingParcels() {
    return this.adminService.getPendingParcels();
  }

  @Get('parcels/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getParcelById(@Param('id') id: string) {
    return this.adminService.getParcelById(id);
  }

  @Put('parcels/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  async collectParcel(
    @Param('id') id: string,
    @Body() body: { collectedBy: string; notes?: string; collectedByPhone?: string; collectedByIdLast4?: string },
  ) {
    return this.adminService.updateParcelStatus(
      id,
      'Collected',
      body.collectedBy,
      body.notes,
      { collectedByPhone: body.collectedByPhone, collectedByIdLast4: body.collectedByIdLast4 },
    );
  }

  @Put('parcels/:id/return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async returnParcel(
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.adminService.returnParcel(id, body.notes);
  }

  // Documents APIs
  @Get('documents/stats')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getDocumentStats() {
    return this.adminService.getDocumentStats();
  }

  @Get('documents')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllDocuments(
    @Query('search') search?: string,
    @Query('filter') filter?: 'all' | 'verified' | 'pending',
  ) {
    return this.adminService.getAllDocuments(search, filter);
  }

  @Put('documents/:id/verify')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async verifyDocument(@Param('id') id: string) {
    return this.adminService.verifyDocument(id);
  }

  @Delete('documents/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteAdminDocument(@Param('id') id: string) {
    return this.adminService.deleteAdminDocument(id);
  }

  // Emergency Contacts APIs
  @Get('emergency/contacts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllEmergencyContacts() {
    return this.adminService.getAllEmergencyContacts();
  }

  @Post('emergency/contacts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createEmergencyContact(@Body() body: any) {
    return this.adminService.createEmergencyContact(body);
  }

  @Put('emergency/contacts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateEmergencyContact(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEmergencyContact(id, body);
  }

  @Delete('emergency/contacts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteEmergencyContact(@Param('id') id: string) {
    return this.adminService.deleteEmergencyContact(id);
  }

  // Visitors APIs — specific routes BEFORE /:id
  @Get('visitors/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getVisitorStats() {
    return this.adminService.getVisitorStats();
  }

  @Get('visitors/today')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getTodayVisitors() {
    return this.adminService.getTodayVisitors();
  }

  @Get('visitors/pre-approved')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPreApprovedVisitors() {
    return this.adminService.getPreApprovedVisitors();
  }

  @Get('visitors/catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Commercial visit-type catalogue with per-type rules' })
  async getVisitCatalogue() {
    return VisitRulesService.ALL_COMMERCIAL_TYPES;
  }

  @Get('visitors/occupancy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'People inside vs capacity per building' })
  async getOccupancy() {
    return this.adminService.getOccupancy();
  }

  @Get('visitors/inside')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Everyone currently inside, grouped by building (roll-call)' })
  async getInsideNow(@Query('buildingId') buildingId?: string) {
    return this.adminService.getInsideNow(buildingId);
  }

  @Get('visitors/export.csv')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Visitor log as CSV (from/to = YYYY-MM-DD)' })
  async exportVisitors(
    @Res() res: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('buildingId') buildingId?: string,
    @Query('status') status?: string,
  ) {
    const csv = await this.adminService.exportVisitorsCsv({ from, to, buildingId, status });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="visitors-${from || 'all'}-${to || 'all'}.csv"`,
    );
    res.send(csv);
  }

  @Get('visitors/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Visits awaiting approval (use approvalMode=guard for the gate queue)',
  })
  async getPendingVisitors(
    @Query('approvalMode') approvalMode?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.adminService.getPendingVisitors({ approvalMode, buildingId });
  }

  @Post('visitors/verify-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async verifyVisitorQR(@Body() body: { qrData: string }) {
    return this.adminService.verifyVisitorQR(body.qrData);
  }

  @Get('visitors/lookup/:passCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Find a pass by its typed code (camera fallback)' })
  async lookupVisitorByPassCode(@Param('passCode') passCode: string) {
    return this.adminService.lookupVisitorByPassCode(passCode);
  }

  @Post('visitors/checkin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Guard desk check-in: create + approve + record entry in one step',
  })
  async guardCheckin(@Request() req, @Body() dto: GuardCheckinDto) {
    return this.adminService.guardCheckin(dto as any, req.user);
  }

  @Get('visitors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllVisitors(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('preApproved') preApproved?: string,
    @Query('buildingId') buildingId?: string,
    @Query('siteType') siteType?: string,
    @Query('approvalMode') approvalMode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllVisitors(
      status,
      type,
      preApproved === undefined ? undefined : preApproved === 'true',
      search,
      { buildingId, siteType, approvalMode },
      {
        page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
        limit: limit ? Math.min(500, Math.max(1, parseInt(limit, 10) || 50)) : undefined,
      },
    );
  }

  @Get('visitors/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getVisitorStatus(@Param('id') id: string) {
    return this.adminService.getVisitorStatus(id);
  }

  @Post('visitors/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async approveVisitor(@Request() req, @Param('id') id: string) {
    return this.adminService.approveVisitor(id, req.user);
  }

  @Post('visitors/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async rejectVisitor(
    @Request() req,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.adminService.rejectVisitor(id, req.user, body?.reason);
  }

  @Post('visitors/:id/entry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async recordVisitorEntry(
    @Request() req,
    @Param('id') id: string,
    @Body() body?: { gate?: string },
  ) {
    return this.adminService.recordVisitorEntry(id, req.user, body?.gate);
  }

  @Post('visitors/:id/exit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async recordVisitorExit(
    @Param('id') id: string,
    @Body() body?: { gate?: string },
  ) {
    return this.adminService.recordVisitorExit(id, body?.gate);
  }

  @Delete('visitors/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteVisitor(@Param('id') id: string) {
    return this.adminService.deleteVisitor(id);
  }

  @Post('visitors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createVisitor(@Request() req, @Body() createDto: GuardCheckinDto) {
    return this.adminService.createVisitor(createDto as any, req.user);
  }

  // Pets Management
  @Get('pets')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllPets() {
    return this.adminService.getAllPets();
  }

  @Get('pets/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPetById(@Param('id') id: string) {
    return this.adminService.getPetById(id);
  }

  @Post('pets')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createPet(@Body() body: any) {
    return this.adminService.createPet(body);
  }

  @Put('pets/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updatePet(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePet(id, body);
  }

  @Delete('pets/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deletePet(@Param('id') id: string) {
    return this.adminService.deletePet(id);
  }

  // Event Management APIs
  @Get('events')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllEvents(@Query('status') status?: string) {
    return this.adminService.getAllEvents(status);
  }

  @Get('events/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getEventById(@Param('id') id: string) {
    return this.adminService.getEventById(id);
  }

  @Post('events')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createEvent(@Body() body: any, @Request() req) {
    // Admin JWT doesn't have a userId, so we'll pass undefined
    // The service will find the first user as a fallback
    return this.adminService.createEvent(body);
  }

  @Put('events/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateEvent(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEvent(id, body);
  }

  @Patch('events/:id/status')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateEventStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateEventStatus(id, status);
  }

  @Delete('events/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(id);
  }

  // Notification Management APIs
  @Post('notifications/send-to-user')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
