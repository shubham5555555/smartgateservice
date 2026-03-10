import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';
import {
  AmenityBooking,
  AmenityBookingSchema,
} from '../schemas/amenity-booking.schema';
import { Amenity, AmenitySchema } from '../schemas/amenity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AmenityBooking.name, schema: AmenityBookingSchema },
      { name: Amenity.name, schema: AmenitySchema },
    ]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
