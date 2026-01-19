import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  async createComplaint(@Request() req, @Body() createComplaintDto: CreateComplaintDto) {
    return this.complaintsService.createComplaint(req.user.userId, createComplaintDto);
  }

  @Get()
  async getMyComplaints(@Request() req) {
    return this.complaintsService.getComplaintsByUser(req.user.userId);
  }

  @Get(':id')
  async getComplaintById(@Param('id') id: string) {
    return this.complaintsService.getComplaintById(id);
  }
}
