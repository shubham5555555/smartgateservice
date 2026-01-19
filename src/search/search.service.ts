import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { Visitor, VisitorDocument } from '../schemas/visitor.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
  ) {}

  async search(userId: string, query: string) {
    const searchRegex = new RegExp(query, 'i'); // Case-insensitive search

    // Search staff
    const staffResults = await this.staffModel
      .find({
        userId: new Types.ObjectId(userId),
        $or: [
          { name: searchRegex },
          { role: searchRegex },
          { phoneNumber: searchRegex },
        ],
      })
      .limit(20)
      .exec();

    // Search visitors
    const visitorResults = await this.visitorModel
      .find({
        userId: new Types.ObjectId(userId),
        $or: [
          { name: searchRegex },
          { type: searchRegex },
          { phoneNumber: searchRegex },
        ],
      })
      .limit(20)
      .exec();

    return {
      staff: staffResults,
      visitors: visitorResults,
    };
  }
}
