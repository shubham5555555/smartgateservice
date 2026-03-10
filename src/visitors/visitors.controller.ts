import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { SelfRegisterVisitorDto } from './dto/self-register-visitor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Visitors')
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  // Public endpoints for visitor self-registration
  @Post('self-register')
  @ApiOperation({ summary: 'Self-register as a visitor (Public)' })
  @ApiResponse({
    status: 201,
    description: 'Visitor registration request created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or resident not found',
  })
  async selfRegisterVisitor(@Body() selfRegisterDto: SelfRegisterVisitorDto) {
    return this.visitorsService.selfRegisterVisitor(selfRegisterDto);
  }

  @Get('status/:phoneNumber')
  @ApiOperation({ summary: 'Check visitor status by phone number (Public)' })
  @ApiParam({ name: 'phoneNumber', description: 'Visitor phone number' })
  @ApiResponse({
    status: 200,
    description: 'Visitor status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Visitor not found' })
  async getVisitorStatusByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.visitorsService.getVisitorStatusByPhone(phoneNumber);
  }

  // Authenticated endpoints (require JWT)
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create visitor (Authenticated - for residents)' })
  @ApiResponse({ status: 201, description: 'Visitor created successfully' })
  async createVisitor(@Request() req, @Body() createDto: CreateVisitorDto) {
    return this.visitorsService.createVisitor(req.user.userId, createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all visitors for authenticated user' })
  @ApiResponse({ status: 200, description: 'Visitors retrieved successfully' })
  async getVisitors(@Request() req) {
    return this.visitorsService.getVisitors(req.user.userId);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get today's visitors for authenticated user" })
  @ApiResponse({
    status: 200,
    description: "Today's visitors retrieved successfully",
  })
  async getTodayVisitors(@Request() req) {
    return this.visitorsService.getTodayVisitors(req.user.userId);
  }

  // Resident endpoints for accepting/rejecting self-registered visitors
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Accept self-registered visitor (Resident)' })
  @ApiResponse({ status: 200, description: 'Visitor accepted successfully' })
  @ApiResponse({ status: 400, description: 'Visitor cannot be accepted' })
  async acceptSelfRegisteredVisitor(@Request() req, @Param('id') id: string) {
    return this.visitorsService.acceptSelfRegisteredVisitor(
      id,
      req.user.userId,
    );
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reject self-registered visitor (Resident)' })
  @ApiResponse({ status: 200, description: 'Visitor rejected successfully' })
  @ApiResponse({ status: 400, description: 'Visitor cannot be rejected' })
  async rejectSelfRegisteredVisitor(
    @Request() req,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.visitorsService.rejectSelfRegisteredVisitor(
      id,
      req.user.userId,
      body?.reason,
    );
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve visitor (Admin/Guard)' })
  @ApiResponse({ status: 200, description: 'Visitor approved successfully' })
  async approveVisitor(@Param('id') id: string) {
    return this.visitorsService.approveVisitor(id);
  }

  @Post(':id/entry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record visitor entry (Guard)' })
  @ApiResponse({ status: 200, description: 'Entry recorded successfully' })
  async recordEntry(@Param('id') id: string) {
    return this.visitorsService.recordEntry(id);
  }

  @Post(':id/exit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record visitor exit (Guard)' })
  @ApiResponse({ status: 200, description: 'Exit recorded successfully' })
  async recordExit(@Param('id') id: string) {
    return this.visitorsService.recordExit(id);
  }
}
