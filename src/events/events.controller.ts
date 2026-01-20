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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpEventDto } from './dto/rsvp-event.dto';
import { CloudinaryService } from '../common/cloudinary.service';

@ApiTags('Events')
@ApiBearerAuth('JWT-auth')
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ 
    summary: 'Add event photo',
    description: 'Uploads a photo to Cloudinary and adds it to the event. Only the event creator can add photos.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Photo added successfully',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Only event creator can add photos',
  })
  async addPhoto(@Param('id') id: string, @Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const photoUrl = await this.cloudinaryService.uploadEventPhoto(file);
    return this.eventsService.addPhoto(id, photoUrl, req.user.userId);
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
