import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';
import { AmenityBooking, AmenityBookingSchema } from '../schemas/amenity-booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AmenityBooking.name, schema: AmenityBookingSchema }]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
})
export class AmenitiesModule {}
