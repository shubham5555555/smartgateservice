import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AmenityBooking, AmenityBookingDocument, AmenityType, BookingStatus } from '../schemas/amenity-booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(AmenityBooking.name) private bookingModel: Model<AmenityBookingDocument>,
  ) {}

  async createBooking(userId: string, createDto: CreateBookingDto) {
    const bookingDate = new Date(createDto.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if booking date is in the past
    if (bookingDate < today) {
      throw new BadRequestException('Cannot book amenities for past dates');
    }

    // Check if booking date is more than 30 days in the future
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    if (bookingDate > maxDate) {
      throw new BadRequestException('Cannot book amenities more than 30 days in advance');
    }

    // Check for conflicting bookings (same amenity, date, and time slot)
    const conflictingBooking = await this.bookingModel.findOne({
      amenityType: createDto.amenityType,
      bookingDate: {
        $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
        $lt: new Date(bookingDate.setHours(23, 59, 59, 999)),
      },
      timeSlot: createDto.timeSlot,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    });

    if (conflictingBooking) {
      throw new BadRequestException('This time slot is already booked for the selected amenity');
    }

    const booking = new this.bookingModel({
      ...createDto,
      userId: new Types.ObjectId(userId),
      bookingDate: new Date(createDto.bookingDate),
      status: BookingStatus.CONFIRMED,
    });

    return booking.save();
  }

  async getMyBookings(userId: string) {
    return this.bookingModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ bookingDate: -1, createdAt: -1 })
      .exec();
  }

  async getUpcomingBookings(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.bookingModel
      .find({
        userId: new Types.ObjectId(userId),
        bookingDate: { $gte: today },
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      })
      .sort({ bookingDate: 1 })
      .exec();
  }

  async getBookingById(userId: string, bookingId: string) {
    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      userId: new Types.ObjectId(userId),
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.getBookingById(userId, bookingId);

    const bookingDate = new Date(booking.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if booking is in the past
    if (bookingDate < today) {
      throw new BadRequestException('Cannot cancel past bookings');
    }

    booking.status = BookingStatus.CANCELLED;
    return booking.save();
  }

  async getAvailableTimeSlots(amenityType: AmenityType, date: string) {
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const bookings = await this.bookingModel.find({
      amenityType,
      bookingDate: {
        $gte: new Date(bookingDate),
        $lt: new Date(bookingDate.setHours(23, 59, 59, 999)),
      },
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    });

    const bookedSlots = bookings.map((b) => b.timeSlot);

    // All available time slots
    const allSlots = [
      '6:00 AM - 8:00 AM',
      '8:00 AM - 10:00 AM',
      '10:00 AM - 12:00 PM',
      '12:00 PM - 2:00 PM',
      '2:00 PM - 4:00 PM',
      '4:00 PM - 6:00 PM',
      '6:00 PM - 8:00 PM',
      '8:00 PM - 10:00 PM',
    ];

    return {
      available: allSlots.filter((slot) => !bookedSlots.includes(slot)),
      booked: bookedSlots,
    };
  }
}
