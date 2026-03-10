import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { Parcel, ParcelSchema } from '../schemas/parcel.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Parcel.name, schema: ParcelSchema }]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ParcelsController],
  providers: [ParcelsService],
})
export class ParcelsModule { }
