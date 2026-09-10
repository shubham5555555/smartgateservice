import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema } from '../schemas/organization.schema';
import { AdminUser, AdminUserSchema } from '../schemas/admin-user.schema';
import { Building, BuildingSchema } from '../schemas/building.schema';
import { OrganizationsService } from './organizations.service';
import { AdminUsersService } from './admin-users.service';
import { OrganizationsController } from './organizations.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: Building.name, schema: BuildingSchema },
    ]),
    ConfigModule,
  ],
  controllers: [OrganizationsController, AdminUsersController],
  providers: [OrganizationsService, AdminUsersService],
  exports: [OrganizationsService, AdminUsersService],
})
export class OrganizationsModule {}
