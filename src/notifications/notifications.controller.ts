import { Controller, Post, Body, UseGuards, Get, Param, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Post('send-to-user')
  async sendToUser(
    @Body()
    body: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
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
    @Body()
    body: {
      guardId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
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
    @Body()
    body: {
      userIds: string[];
      title: string;
      body: string;
      data?: Record<string, string>;
    },
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
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.notificationsService.sendNotificationToAllUsers(
      body.title,
      body.body,
      body.data,
    );
  }

  @Post('send-to-all-guards')
  async sendToAllGuards(
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.notificationsService.sendNotificationToAllGuards(
      body.title,
      body.body,
      body.data,
    );
  }

  // --- Retrieval Endpoints ---

  @Post('admin')
  async sendToAdmin(
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.notificationsService.sendNotificationToAdmin(
      body.title,
      body.body,
      body.data,
    );
  }

  @Get('user/:id')
  async getUserNotifications(@Param('id') id: string) {
    return this.notificationsService.getUserNotifications(id);
  }

  @Get('guard/:id')
  async getGuardNotifications(@Param('id') id: string) {
    return this.notificationsService.getGuardNotifications(id);
  }

  @Get('admin')
  async getAdminNotifications() {
    return this.notificationsService.getAdminNotifications();
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('user/:id/read-all')
  async markAllUserAsRead(@Param('id') id: string) {
    return this.notificationsService.markAllAsReadForUser(id);
  }

  @Patch('guard/:id/read-all')
  async markAllGuardAsRead(@Param('id') id: string) {
    return this.notificationsService.markAllAsReadForGuard(id);
  }
}
