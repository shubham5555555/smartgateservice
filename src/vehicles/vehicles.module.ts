import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle, VehicleSchema } from '../schemas/vehicle.schema';
import { VehicleEntry, VehicleEntrySchema } from '../schemas/vehicle-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: VehicleEntry.name, schema: VehicleEntrySchema },
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
