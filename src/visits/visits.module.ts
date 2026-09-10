import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Visitor, VisitorSchema } from '../schemas/visitor.schema';
import { Building, BuildingSchema } from '../schemas/building.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Organization, OrganizationSchema } from '../schemas/organization.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { CommonModule } from '../common/common.module';
import { VisitPassService } from './visit-pass.service';
import { PublicVisitsService } from './public-visits.service';
import { PublicVisitsController } from './public-visits.controller';
import { VisitLifecycleService } from './visit-lifecycle.service';
import { VisitRulesService } from './visit-rules.service';
import { WatchlistModule } from '../watchlist/watchlist.module';
import { Guard, GuardSchema } from '../schemas/guard.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: Building.name, schema: BuildingSchema },
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    forwardRef(() => NotificationsModule),
    BuildingsModule,
    CommonModule,
    ConfigModule,
    WatchlistModule,
  ],
  controllers: [PublicVisitsController],
  providers: [VisitPassService, PublicVisitsService, VisitLifecycleService, VisitRulesService],
  exports: [VisitPassService, PublicVisitsService, VisitRulesService],
})
export class VisitsModule {}
