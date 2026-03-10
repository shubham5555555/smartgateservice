import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Maintenance,
  MaintenanceDocument,
} from '../schemas/maintenance.schema';
import { PaymentStatus } from '../schemas/maintenance.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  private async assertOwner(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('role parentUserId').lean();
    if (!user) throw new ForbiddenException('User not found');
    const role = (user as any).role;
    if (role && role !== UserRole.OWNER) {
      throw new ForbiddenException('Only Owners can access maintenance dues');
    }
  }

  async getCurrentDues(userId: string) {
    await this.assertOwner(userId);
    return this.maintenanceModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      })
      .sort({ dueDate: 1 })
      .exec();
  }

  async getPaymentHistory(userId: string) {
    await this.assertOwner(userId);
    return this.maintenanceModel
      .find({
        userId: new Types.ObjectId(userId),
        status: PaymentStatus.PAID,
      })
      .sort({ paidDate: -1 })
      .exec();
  }

  async getTotalAmountDue(userId: string) {
    await this.assertOwner(userId);
    const dues = await this.maintenanceModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      })
      .exec();
    return dues.reduce((total, due) => total + due.amount, 0);
  }

  async payMaintenance(
    userId: string,
    maintenanceIds: string[],
    paymentMethod: string,
    transactionId: string,
  ) {
    await this.assertOwner(userId);
    const maintenances = await this.maintenanceModel.find({
      _id: { $in: maintenanceIds.map((id) => new Types.ObjectId(id)) },
      userId: new Types.ObjectId(userId),
    });

    const updatePromises = maintenances.map((maintenance) => {
      maintenance.status = PaymentStatus.PAID;
      maintenance.paidDate = new Date();
      maintenance.paymentMethod = paymentMethod;
      maintenance.transactionId = transactionId;
      return maintenance.save();
    });

    await Promise.all(updatePromises);
    return maintenances;
  }

  async getPaymentDetails(userId: string, maintenanceId: string) {
    await this.assertOwner(userId);
    return this.maintenanceModel
      .findOne({
        _id: new Types.ObjectId(maintenanceId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }
}
