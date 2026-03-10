import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Parcel, ParcelDocument, ParcelStatus } from '../schemas/parcel.schema';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class ParcelsService {
  constructor(
    @InjectModel(Parcel.name) private parcelModel: Model<ParcelDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService?: NotificationsService,
  ) { }

  async createParcel(userId: string, createParcelDto: CreateParcelDto) {
    const parcelEntry = new this.parcelModel({
      ...createParcelDto,
      userId: new Types.ObjectId(userId),
      status: ParcelStatus.PENDING,
    });

    const savedParcel = await parcelEntry.save();

    if (this.notificationsService) {
      this.notificationsService.sendNotificationToUser(
        userId,
        'Package Delivered',
        `A package from ${(createParcelDto as any).company || 'Delivery'} has arrived for you.`,
        { type: 'package', parcelId: savedParcel._id.toString() }
      ).catch(err => console.error('Parcel notification failed:', err));
    }

    return savedParcel;
  }

  async getParcelsByUser(userId: string) {
    return this.parcelModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPendingParcels(userId: string) {
    return this.parcelModel
      .find({
        userId: new Types.ObjectId(userId),
        status: ParcelStatus.PENDING,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getParcelById(id: string) {
    const parcelEntry = await this.parcelModel.findById(id).exec();
    if (!parcelEntry) {
      throw new NotFoundException('Parcel not found');
    }
    return parcelEntry;
  }

  async collectParcel(id: string, collectedBy: string) {
    const parcelEntry = await this.parcelModel.findById(id);
    if (!parcelEntry) {
      throw new NotFoundException('Parcel not found');
    }

    parcelEntry.status = ParcelStatus.COLLECTED;
    parcelEntry.collectedBy = collectedBy;
    parcelEntry.collectedAt = new Date();

    return parcelEntry.save();
  }
}
