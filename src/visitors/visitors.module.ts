import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Visitor.name, schema: VisitorSchema }]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
