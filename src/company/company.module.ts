import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../schemas/company.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Building, BuildingSchema } from '../schemas/building.schema';
import {
  AttendanceEvent,
  AttendanceEventSchema,
} from '../schemas/attendance-event.schema';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { VisitsModule } from '../visits/visits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { AdminCompaniesController } from './admin-companies.controller';
import { EmployeeAccessService } from './employee-access.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
      { name: Building.name, schema: BuildingSchema },
      { name: AttendanceEvent.name, schema: AttendanceEventSchema },
      { name: Visitor.name, schema: VisitorSchema },
    ]),
    VisitsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CompanyController, AdminCompaniesController],
  providers: [CompanyService, EmployeeAccessService],
  exports: [CompanyService, EmployeeAccessService],
})
export class CompanyModule {}
