import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get('contacts')
  async getEmergencyContacts() {
    return this.emergencyService.getEmergencyContacts();
  }

  @Get('contacts/:type')
  async getContactsByType(@Param('type') type: string) {
    return this.emergencyService.getContactsByType(type);
  }

  @Post('sos')
  @UseGuards(JwtAuthGuard)
  async sendSOS(@Request() req, @Body() body: { location?: string; message?: string }) {
    return this.emergencyService.sendSOS(req.user.userId, body.location, body.message);
  }
}
