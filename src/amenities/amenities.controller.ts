import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AmenityType } from '../schemas/amenity-booking.schema';

@Controller('amenities')
@UseGuards(JwtAuthGuard)
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post('book')
  async createBooking(@Request() req, @Body() createDto: CreateBookingDto) {
    return this.amenitiesService.createBooking(req.user.userId, createDto);
  }

  @Get('my-bookings')
  async getMyBookings(@Request() req) {
    return this.amenitiesService.getMyBookings(req.user.userId);
  }

  @Get('upcoming')
  async getUpcomingBookings(@Request() req) {
    return this.amenitiesService.getUpcomingBookings(req.user.userId);
  }

  @Get('booking/:id')
  async getBookingById(@Request() req, @Param('id') id: string) {
    return this.amenitiesService.getBookingById(req.user.userId, id);
  }

  @Delete('booking/:id')
  async cancelBooking(@Request() req, @Param('id') id: string) {
    return this.amenitiesService.cancelBooking(req.user.userId, id);
  }

  @Get('available-slots/:amenityType/:date')
  async getAvailableTimeSlots(
    @Param('amenityType') amenityType: AmenityType,
    @Param('date') date: string,
  ) {
    return this.amenitiesService.getAvailableTimeSlots(amenityType, date);
  }
}
