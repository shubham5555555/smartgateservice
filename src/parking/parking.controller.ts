import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { CreateParkingApplicationDto } from './dto/create-application.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('parking')
@UseGuards(JwtAuthGuard)
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Get('my-slots')
  async getMySlots(@Request() req) {
    return this.parkingService.getMySlots(req.user.userId);
  }

  @Post('apply')
  async createApplication(@Request() req, @Body() createDto: CreateParkingApplicationDto) {
    return this.parkingService.createApplication(req.user.userId, createDto);
  }

  @Get('applications')
  async getApplications(@Request() req) {
    return this.parkingService.getApplications(req.user.userId);
  }

  @Get('application-status')
  async getApplicationStatus(@Request() req) {
    return this.parkingService.getApplicationStatus(req.user.userId);
  }
}
