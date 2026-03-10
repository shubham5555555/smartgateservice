import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { Building, BuildingSchema } from '../schemas/building.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { CommonModule } from '../common/common.module';
import { ImageProcessor } from '../queues/image.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommonModule,
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService, ImageProcessor],
  exports: [BuildingsService],
})
export class BuildingsModule {}
