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
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  create(@Body() createReminderDto: CreateReminderDto) {
    return this.remindersService.create(createReminderDto);
  }

  @Get()
  findAll(@Query() filters: Record<string, unknown>) {
    return this.remindersService.findAll(filters);
  }

  @Get('upcoming')
  getUpcoming(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.remindersService.getUpcoming(parsedLimit);
  }

  @Get('overdue')
  getOverdue() {
    return this.remindersService.getOverdue();
  }

  @Get('stats')
  getDashboardStats() {
    return this.remindersService.getDashboardStats();
  }

  @Get('staff/:staffId')
  getByStaffId(@Param('staffId') staffId: string) {
    return this.remindersService.getByStaffId(staffId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.remindersService.findById(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ) {
    return this.remindersService.update(id, updateReminderDto);
  }

  @Put(':id/complete')
  complete(
    @Param('id') id: string,
    @Body('completedBy') completedById: string,
  ) {
    return this.remindersService.complete(id, completedById);
  }

  @Put(':id/snooze')
  snooze(
    @Param('id') id: string,
    @Body('snoozeUntil') snoozeUntil: string,
    @Body('reason') reason?: string,
  ) {
    return this.remindersService.snooze(id, new Date(snoozeUntil), reason);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.remindersService.cancel(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.remindersService.delete(id);
  }
}
