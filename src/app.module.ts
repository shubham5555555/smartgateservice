import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { ParkingModule } from './parking/parking.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { VisitorsModule } from './visitors/visitors.module';
import { AmenitiesModule } from './amenities/amenities.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PackagesModule } from './packages/packages.module';
import { DocumentsModule } from './documents/documents.module';
import { EmergencyModule } from './emergency/emergency.module';
import { PetsModule } from './pets/pets.module';
import { ChatModule } from './chat/chat.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/smartgate'),
      }),
      inject: [ConfigService],
    }),
    CommonModule, // Global module for CloudinaryService
    AuthModule,
    UsersModule,
    StaffModule,
    ParkingModule,
    MaintenanceModule,
    VisitorsModule,
    AmenitiesModule,
    SearchModule,
    AdminModule,
    ComplaintsModule,
    VehiclesModule,
    PackagesModule,
    DocumentsModule,
    EmergencyModule,
    PetsModule,
    ChatModule,
    EventsModule,
    NotificationsModule,
    MarketplaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
