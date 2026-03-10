import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AmenityBooking,
  AmenityBookingDocument,
  BookingStatus,
  PaymentStatus,
} from '../schemas/amenity-booking.schema';
import { Amenity, AmenityDocument } from '../schemas/amenity.schema';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(AmenityBooking.name)
    private bookingModel: Model<AmenityBookingDocument>,
    @InjectModel(Amenity.name)
    private amenityModel: Model<AmenityDocument>,
  ) {}

  async listAmenities() {
    return this.amenityModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  async createBooking(userId: string, createDto: CreateBookingDto) {
    const bookingDate = new Date(createDto.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Cannot book amenities for past dates');
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    if (bookingDate > maxDate) {
      throw new BadRequestException(
        'Cannot book amenities more than 30 days in advance',
      );
    }

    // Look up amenity config — prefer ID if provided, fall back to name match
    const amenityConfig = await (createDto.amenityId
      ? this.amenityModel.findOne({ _id: createDto.amenityId, isActive: true }).exec()
      : this.amenityModel.findOne({ name: createDto.amenityType, isActive: true }).exec());
    const fee = amenityConfig?.fee ?? 0;

    // Validate time slot is in the amenity's available slots
    if (
      amenityConfig?.availableSlots?.length &&
      !amenityConfig.availableSlots.includes(createDto.timeSlot)
    ) {
      throw new BadRequestException('Invalid time slot for this amenity');
    }

    // Check for conflicting bookings
    const conflictingBooking = await this.bookingModel.findOne({
      amenityType: createDto.amenityType,
      bookingDate: {
        $gte: new Date(new Date(createDto.bookingDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(createDto.bookingDate).setHours(23, 59, 59, 999)),
      },
      timeSlot: createDto.timeSlot,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    });

    if (conflictingBooking) {
      throw new BadRequestException(
        'This time slot is already booked for the selected amenity',
      );
    }

    const booking = new this.bookingModel({
      ...createDto,
      userId: new Types.ObjectId(userId),
      bookingDate: new Date(createDto.bookingDate),
      status: BookingStatus.CONFIRMED,
      fee,
      paymentStatus: fee > 0 ? PaymentStatus.PENDING : PaymentStatus.FREE,
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

    if (bookingDate < today) {
      throw new BadRequestException('Cannot cancel past bookings');
    }

    booking.status = BookingStatus.CANCELLED;
    return booking.save();
  }

  async getAvailableTimeSlots(amenityName: string, date: string) {
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const [bookings, amenityConfig] = await Promise.all([
      this.bookingModel.find({
        amenityType: amenityName,
        bookingDate: {
          $gte: new Date(bookingDate),
          $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      }),
      this.amenityModel.findOne({ name: amenityName }).exec(),
    ]);

    const bookedSlots = bookings.map((b) => b.timeSlot);
    const allSlots = amenityConfig?.availableSlots ?? [
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
      fee: amenityConfig?.fee ?? 0,
    };
  }
}
