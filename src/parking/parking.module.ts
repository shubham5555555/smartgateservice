import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';
import { ParkingSlot, ParkingSlotSchema } from '../schemas/parking-slot.schema';
import { ParkingApplication, ParkingApplicationSchema } from '../schemas/parking-application.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParkingSlot.name, schema: ParkingSlotSchema },
      { name: ParkingApplication.name, schema: ParkingApplicationSchema },
    ]),
  ],
  controllers: [ParkingController],
  providers: [ParkingService],
  exports: [ParkingService],
})
export class ParkingModule {}
