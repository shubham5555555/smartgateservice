import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantInterceptor } from './tenant.interceptor';
import { RolesGuard } from './roles.guard';
import { TenantService } from './tenant.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Building, BuildingSchema } from '../schemas/building.schema';
import {
  Organization,
  OrganizationSchema,
} from '../schemas/organization.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Building.name, schema: BuildingSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    RolesGuard,
    TenantService,
  ],
  exports: [RolesGuard, TenantService],
})
export class TenancyModule {}
