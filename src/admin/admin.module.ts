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
import { Complaint, ComplaintSchema } from '../schemas/complaint.schema';
import { Notice, NoticeSchema } from '../schemas/notice.schema';
import { AccessRequest, AccessRequestSchema } from '../schemas/access-request.schema';
import { Vehicle, VehicleSchema } from '../schemas/vehicle.schema';
import { Package, PackageSchema } from '../schemas/package.schema';
import { DocumentFile, DocumentSchema } from '../schemas/document.schema';
import { EmergencyContact, EmergencyContactSchema } from '../schemas/emergency-contact.schema';
import { Guard, GuardSchema } from '../schemas/guard.schema';
import { Pet, PetSchema } from '../schemas/pet.schema';
import { ChatMessage, ChatMessageSchema } from '../schemas/chat.schema';
import { Event, EventSchema } from '../schemas/event.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Staff.name, schema: StaffSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Notice.name, schema: NoticeSchema },
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Package.name, schema: PackageSchema },
      { name: DocumentFile.name, schema: DocumentSchema },
      { name: EmergencyContact.name, schema: EmergencyContactSchema },
      { name: Guard.name, schema: GuardSchema },
      { name: Pet.name, schema: PetSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Event.name, schema: EventSchema },
    ]),
    forwardRef(() => NotificationsModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
