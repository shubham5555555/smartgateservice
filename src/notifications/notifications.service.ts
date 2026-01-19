import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Guard, GuardDocument } from '../schemas/guard.schema';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App | null = null;
  private isInitialized = false;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Guard.name) private guardModel: Model<GuardDocument>,
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      try {
        // Option 1: Use service account file
        const serviceAccount = require('../../firebase-service-account.json');
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.isInitialized = true;
        this.logger.log('✅ Firebase Admin initialized with service account file');
      } catch (error) {
        // Option 2: Use environment variables
        try {
          if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            this.firebaseApp = admin.initializeApp({
              credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              }),
            });
            this.isInitialized = true;
            this.logger.log('✅ Firebase Admin initialized with environment variables');
          } else {
            this.logger.warn('⚠️ Firebase Admin not initialized: Missing environment variables');
            this.logger.warn('Please configure Firebase Admin SDK (see FIREBASE_NOTIFICATIONS_SETUP.md)');
          }
        } catch (envError) {
          this.logger.warn('⚠️ Firebase Admin not initialized:', envError);
          this.logger.warn('Please configure Firebase Admin SDK (see FIREBASE_NOTIFICATIONS_SETUP.md)');
        }
      }
    } else {
      this.firebaseApp = admin.app();
      this.isInitialized = true;
      this.logger.log('✅ Firebase Admin already initialized');
    }
  }

  private checkFirebaseInitialized(): boolean {
    if (!this.isInitialized || !this.firebaseApp) {
      this.logger.error('❌ Firebase Admin not initialized. Cannot send notifications.');
      this.logger.error('Please configure Firebase Admin SDK (see FIREBASE_NOTIFICATIONS_SETUP.md)');
      return false;
    }
    return true;
  }

  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.checkFirebaseInitialized()) {
      return { success: false, message: 'Firebase Admin not initialized' };
    }

    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.fcmToken) {
        this.logger.warn(`User ${userId} not found or FCM token not available`);
        return { success: false, message: 'User not found or FCM token not available' };
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: data ? { ...data, type: data.type || 'general' } : {},
        token: user.fcmToken,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Notification sent to user ${userId}: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      this.logger.error(`Error sending notification to user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToGuard(
    guardId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.checkFirebaseInitialized()) {
      return { success: false, message: 'Firebase Admin not initialized' };
    }

    try {
      const guard = await this.guardModel.findById(guardId).exec();
      if (!guard || !guard.fcmToken) {
        this.logger.warn(`Guard ${guardId} not found or FCM token not available`);
        return { success: false, message: 'Guard not found or FCM token not available' };
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: data ? { ...data, type: data.type || 'general' } : {},
        token: guard.fcmToken,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Notification sent to guard ${guardId}: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      this.logger.error(`Error sending notification to guard ${guardId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.checkFirebaseInitialized()) {
      return { success: false, message: 'Firebase Admin not initialized' };
    }

    try {
      const users = await this.userModel
        .find({ _id: { $in: userIds.map(id => new Types.ObjectId(id)) }, fcmToken: { $exists: true, $ne: null } })
        .exec();

      if (users.length === 0) {
        return { success: false, message: 'No users with FCM tokens found' };
      }

      const tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
      const message = {
        notification: {
          title,
          body,
        },
        data: data ? { ...data, type: data.type || 'general' } : {},
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`Sent ${response.successCount} notifications to ${tokens.length} users`);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: any) {
      this.logger.error('Error sending notifications to multiple users:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToAllUsers(
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.checkFirebaseInitialized()) {
      return { success: false, message: 'Firebase Admin not initialized' };
    }

    try {
      const users = await this.userModel
        .find({ fcmToken: { $exists: true, $ne: null } })
        .exec();

      if (users.length === 0) {
        return { success: false, message: 'No users with FCM tokens found' };
      }

      const tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
      
      // Send in batches of 500 (FCM limit)
      const batchSize = 500;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const message = {
          notification: {
            title,
            body,
          },
          data: data ? { ...data, type: data.type || 'general' } : {},
          tokens: batch,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;
      }

      this.logger.log(`Sent notifications to ${successCount} users`);
      return {
        success: true,
        successCount,
        failureCount,
      };
    } catch (error: any) {
      this.logger.error('Error sending notifications to all users:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationToAllGuards(
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.checkFirebaseInitialized()) {
      return { success: false, message: 'Firebase Admin not initialized' };
    }

    try {
      const guards = await this.guardModel
        .find({ fcmToken: { $exists: true, $ne: null }, isActive: true })
        .exec();

      if (guards.length === 0) {
        return { success: false, message: 'No active guards with FCM tokens found' };
      }

      const tokens = guards.map((g) => g.fcmToken).filter(Boolean) as string[];
      const message = {
        notification: {
          title,
          body,
        },
        data: data ? { ...data, type: data.type || 'general' } : {},
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`Sent ${response.successCount} notifications to ${tokens.length} guards`);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: any) {
      this.logger.error('Error sending notifications to all guards:', error);
      return { success: false, error: error.message };
    }
  }
}
