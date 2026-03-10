import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { S3Service } from '../common/s3.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => NotificationsModule),
    ConfigModule,
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService, S3Service],
  exports: [VisitorsService],
})
export class VisitorsModule {}
