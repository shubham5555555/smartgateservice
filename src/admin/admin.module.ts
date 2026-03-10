import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { Maintenance, MaintenanceSchema } from '../schemas/maintenance.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import {
  StaffActivity,
  StaffActivitySchema,
} from '../schemas/staff-activity.schema';
import { Complaint, ComplaintSchema } from '../schemas/complaint.schema';
import { Notice, NoticeSchema } from '../schemas/notice.schema';
import {
  AccessRequest,
  AccessRequestSchema,
} from '../schemas/access-request.schema';
import { Vehicle, VehicleSchema } from '../schemas/vehicle.schema';
import { Parcel, ParcelSchema } from '../schemas/parcel.schema';
import { DocumentFile, DocumentSchema } from '../schemas/document.schema';
import {
  EmergencyContact,
  EmergencyContactSchema,
} from '../schemas/emergency-contact.schema';
import { Guard, GuardSchema } from '../schemas/guard.schema';
import { Pet, PetSchema } from '../schemas/pet.schema';
import { Event, EventSchema } from '../schemas/event.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';
import { ParkingSlot, ParkingSlotSchema } from '../schemas/parking-slot.schema';
import {
  ParkingApplication,
  ParkingApplicationSchema,
} from '../schemas/parking-application.schema';
import {
  AmenityBooking,
  AmenityBookingSchema,
} from '../schemas/amenity-booking.schema';
import { Amenity, AmenitySchema } from '../schemas/amenity.schema';
import { Contact, ContactSchema } from '../schemas/contact.schema';
import { Building, BuildingSchema } from '../schemas/building.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { forwardRef } from '@nestjs/common';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Staff.name, schema: StaffSchema },
      { name: StaffActivity.name, schema: StaffActivitySchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Notice.name, schema: NoticeSchema },
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Parcel.name, schema: ParcelSchema },
      { name: DocumentFile.name, schema: DocumentSchema },
      { name: EmergencyContact.name, schema: EmergencyContactSchema },
      { name: Guard.name, schema: GuardSchema },
      { name: Pet.name, schema: PetSchema },
      { name: Event.name, schema: EventSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: ParkingSlot.name, schema: ParkingSlotSchema },
      { name: ParkingApplication.name, schema: ParkingApplicationSchema },
      { name: AmenityBooking.name, schema: AmenityBookingSchema },
      { name: Amenity.name, schema: AmenitySchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Building.name, schema: BuildingSchema },
    ]),
    forwardRef(() => NotificationsModule),
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'your-secret-key-change-in-production',
        ),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {
  // CloudinaryService is available globally via CommonModule
}
