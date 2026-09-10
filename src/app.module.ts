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
import { ParcelsModule } from './parcels/parcels.module';
import { DocumentsModule } from './documents/documents.module';
import { EmergencyModule } from './emergency/emergency.module';
import { PetsModule } from './pets/pets.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommonModule } from './common/common.module';
import { BuildingsModule } from './buildings/buildings.module';
import { RemindersModule } from './reminders/reminders.module';
import { ContactsModule } from './contacts/contacts.module';
import { VisitsModule } from './visits/visits.module';
import { MetricsController } from './metrics/metrics.controller';
import { TenancyModule } from './tenancy/tenancy.module';
import { tenantPlugin } from './tenancy/tenant.plugin';
import { OrganizationsModule } from './organizations/organizations.module';
import { WatchlistModule } from './watchlist/watchlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/smartgate',
        ),
        // Multi-builder tenancy is enforced on every model (see tenant.plugin.ts).
        connectionFactory: (connection) => {
          connection.plugin(tenantPlugin);
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    CommonModule, // Global module for S3Service
    TenancyModule, // Global: tenant scope interceptor + RolesGuard
    OrganizationsModule,
    WatchlistModule,
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
    ParcelsModule,
    DocumentsModule,
    EmergencyModule,
    PetsModule,
    EventsModule,
    NotificationsModule,
    BuildingsModule,
    RemindersModule,
    ContactsModule,
    VisitsModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule { }
