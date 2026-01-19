import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send-to-user')
  async sendToUser(
    @Body() body: { userId: string; title: string; body: string; data?: Record<string, string> },
  ) {
    return this.notificationsService.sendNotificationToUser(
      body.userId,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('send-to-guard')
  async sendToGuard(
    @Body() body: { guardId: string; title: string; body: string; data?: Record<string, string> },
  ) {
    return this.notificationsService.sendNotificationToGuard(
      body.guardId,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('send-to-multiple')
  async sendToMultiple(
    @Body() body: { userIds: string[]; title: string; body: string; data?: Record<string, string> },
  ) {
    return this.notificationsService.sendNotificationToMultipleUsers(
      body.userIds,
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('send-to-all-users')
  async sendToAllUsers(
    @Body() body: { title: string; body: string; data?: Record<string, string> },
  ) {
    return this.notificationsService.sendNotificationToAllUsers(
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('send-to-all-guards')
  async sendToAllGuards(
    @Body() body: { title: string; body: string; data?: Record<string, string> },
  ) {
    return this.notificationsService.sendNotificationToAllGuards(
      body.title,
      body.body,
      body.data,
    );
  }
}
