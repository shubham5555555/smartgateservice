import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Visitors')
@ApiBearerAuth('JWT-auth')
@Controller('visitors')
@UseGuards(JwtAuthGuard)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post()
  async createVisitor(@Request() req, @Body() createDto: CreateVisitorDto) {
    return this.visitorsService.createVisitor(req.user.userId, createDto);
  }

  @Get()
  async getVisitors(@Request() req) {
    return this.visitorsService.getVisitors(req.user.userId);
  }

  @Get('today')
  async getTodayVisitors(@Request() req) {
    return this.visitorsService.getTodayVisitors(req.user.userId);
  }

  @Post(':id/approve')
  async approveVisitor(@Param('id') id: string) {
    return this.visitorsService.approveVisitor(id);
  }

  @Post(':id/entry')
  async recordEntry(@Param('id') id: string) {
    return this.visitorsService.recordEntry(id);
  }

  @Post(':id/exit')
  async recordExit(@Param('id') id: string) {
    return this.visitorsService.recordExit(id);
  }
}
