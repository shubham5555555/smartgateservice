import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  Notice,
  NoticeDocument,
  NoticeStatus,
} from '../schemas/notice.schema';

/**
 * Read-only notice board for residents and guards.
 *
 * The admin routes under /admin/notices are management APIs and stay
 * admin-only; this returns just the notices a resident should actually see.
 * Tenant scoping is applied by the Mongoose plugin from the caller's JWT, so
 * a resident only ever sees their own builder's notices.
 */
@ApiTags('notices')
@Controller('notices')
export class NoticesController {
  constructor(
    @InjectModel(Notice.name) private noticeModel: Model<NoticeDocument>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Active notices for the signed-in user' })
  async feed() {
    return this.noticeModel
      .find({
        status: NoticeStatus.ACTIVE,
        $or: [
          { expiryDate: { $gte: new Date() } },
          { expiryDate: { $exists: false } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
  }
}
