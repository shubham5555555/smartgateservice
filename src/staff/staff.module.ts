import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { StaffActivity, StaffActivitySchema } from '../schemas/staff-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Staff.name, schema: StaffSchema },
      { name: StaffActivity.name, schema: StaffActivitySchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
