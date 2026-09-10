import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Visitor, VisitorDocument, VisitorStatus } from '../schemas/visitor.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { inferSiteType, resolveSiteSettings } from '../schemas/site-settings';

/**
 * Commercial sites close out visitors who never checked out at the desk, so the
 * "currently inside" count stays meaningful for a fire roll-call.
 */
@Injectable()
export class VisitLifecycleService {
  private readonly logger = new Logger(VisitLifecycleService.name);

  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) {}

  /** Guards get one push per visitor who is still inside past their pass validity. */
  @Cron('*/15 * * * *')
  async notifyOverstays() {
    if (!this.notificationsService) return;
    const now = new Date();
    const stale = await this.visitorModel
      .find({
        status: VisitorStatus.INSIDE,
        expiresAt: { $lt: now },
        overstayNotifiedAt: null,
      })
      .limit(200)
      .exec();
    let sent = 0;
    for (const v of stale) {
      const building = v.buildingId
        ? await this.buildingModel.findById(v.buildingId).select('siteType type settings').lean().exec()
        : null;
      const settings = building
        ? resolveSiteSettings((building as any).siteType || inferSiteType((building as any).type), (building as any).settings)
        : null;
      if (!settings?.notifyOverstay) continue;
      const mins = Math.round((now.getTime() - (v.expiresAt as Date).getTime()) / 60000);
      await this.notificationsService
        .sendNotificationToAllGuards(
          'Visitor overstay',
          `${v.name} (${v.type}) is still inside — pass expired ${mins} min ago`,
          { type: 'visitor', visitorId: v._id.toString(), action: 'overstay' },
          v.organizationId,
          v.buildingId,
        )
        .catch((e) => this.logger.warn(`Overstay push failed: ${e?.message || e}`));
      v.overstayNotifiedAt = now;
      await v.save();
      sent++;
    }
    if (sent) this.logger.log(`Overstay alerts sent: ${sent}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoCheckoutStaleVisitors() {
    const buildings = await this.buildingModel
      .find({ isActive: true })
      .select('_id siteType type settings')
      .exec();

    let closed = 0;
    for (const building of buildings) {
      const settings = resolveSiteSettings(
        building.siteType || inferSiteType(building.type),
        building.settings,
      );
      const hours = settings.autoCheckoutHours;
      if (!hours || hours <= 0) continue;

      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const result = await this.visitorModel.updateMany(
        {
          buildingId: building._id,
          status: VisitorStatus.INSIDE,
          $or: [
            { entryTime: { $lt: cutoff } },
            { entryTime: null, updatedAt: { $lt: cutoff } },
          ],
        },
        {
          $set: {
            status: VisitorStatus.LEFT,
            exitTime: new Date(),
            autoClosed: true,
          },
        },
      );
      closed += result.modifiedCount || 0;
    }

    if (closed > 0) {
      this.logger.log(`Auto-checked-out ${closed} stale visitor(s)`);
    }
  }
}
