import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Package, PackageDocument, PackageStatus } from '../schemas/package.schema';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
  ) {}

  async createPackage(userId: string, createPackageDto: CreatePackageDto) {
    const packageEntry = new this.packageModel({
      ...createPackageDto,
      userId: new Types.ObjectId(userId),
      status: PackageStatus.PENDING,
    });

    return packageEntry.save();
  }

  async getPackagesByUser(userId: string) {
    return this.packageModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPendingPackages(userId: string) {
    return this.packageModel
      .find({ userId: new Types.ObjectId(userId), status: PackageStatus.PENDING })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPackageById(id: string) {
    const packageEntry = await this.packageModel.findById(id).exec();
    if (!packageEntry) {
      throw new NotFoundException('Package not found');
    }
    return packageEntry;
  }

  async collectPackage(id: string, collectedBy: string) {
    const packageEntry = await this.packageModel.findById(id);
    if (!packageEntry) {
      throw new NotFoundException('Package not found');
    }

    packageEntry.status = PackageStatus.COLLECTED;
    packageEntry.collectedBy = collectedBy;
    packageEntry.collectedAt = new Date();

    return packageEntry.save();
  }
}
