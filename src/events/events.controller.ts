import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpEventDto } from './dto/rsvp-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(@Body() createEventDto: CreateEventDto, @Request() req) {
    return this.eventsService.create(createEventDto, req.user.userId);
  }

  @Get()
  async findAll(@Request() req, @Query('upcoming') upcoming?: string) {
    if (upcoming === 'true') {
      return this.eventsService.findUpcoming(10);
    }
    return this.eventsService.findAll(req.user.userId);
  }

  @Get('my-events')
  async getMyEvents(@Request() req) {
    return this.eventsService.getMyEvents(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.eventsService.findById(id, req.user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req,
  ) {
    return this.eventsService.update(id, updateEventDto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    await this.eventsService.delete(id, req.user.userId);
    return { message: 'Event deleted successfully' };
  }

  @Post(':id/rsvp')
  async rsvp(
    @Param('id') id: string,
    @Body() rsvpDto: RsvpEventDto,
    @Request() req,
  ) {
    return this.eventsService.rsvp(id, rsvpDto, req.user.userId);
  }

  @Post(':id/photos')
  async addPhoto(
    @Param('id') id: string,
    @Body() body: { photoUrl: string },
    @Request() req,
  ) {
    return this.eventsService.addPhoto(id, body.photoUrl, req.user.userId);
  }

  @Delete(':id/photos')
  async removePhoto(
    @Param('id') id: string,
    @Body() body: { photoUrl: string },
    @Request() req,
  ) {
    return this.eventsService.removePhoto(id, body.photoUrl, req.user.userId);
  }
}
