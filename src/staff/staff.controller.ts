import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  async createStaff(@Request() req, @Body() createStaffDto: CreateStaffDto) {
    return this.staffService.createStaff(req.user.userId, createStaffDto);
  }

  @Get()
  async getStaff(@Request() req) {
    return this.staffService.getStaffByUser(req.user.userId);
  }

  @Get(':id')
  async getStaffById(@Param('id') id: string) {
    return this.staffService.getStaffById(id);
  }

  @Get(':id/activity')
  async getStaffActivity(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.staffService.getStaffActivity(
      id,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
  }

  @Post(':id/check-in')
  async checkIn(@Param('id') id: string) {
    return this.staffService.checkIn(id);
  }

  @Post(':id/check-out')
  async checkOut(@Param('id') id: string) {
    return this.staffService.checkOut(id);
  }

  @Put(':id')
  async updateStaff(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: Partial<any>,
  ) {
    return this.staffService.updateStaff(req.user.userId, id, updateDto);
  }

  @Delete(':id')
  async deleteStaff(@Request() req, @Param('id') id: string) {
    return this.staffService.deleteStaff(req.user.userId, id);
  }
}
