import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument, EventStatus } from '../schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpEventDto } from './dto/rsvp-event.dto';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createEventDto: CreateEventDto, userId: string): Promise<EventDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const event = new this.eventModel({
      ...createEventDto,
      createdBy: new Types.ObjectId(userId),
      status: EventStatus.PUBLISHED,
      startDate: new Date(createEventDto.startDate),
      endDate: new Date(createEventDto.endDate),
    });

    return event.save();
  }

  async findAll(userId?: string): Promise<EventDocument[]> {
    const query: any = {};
    
    // If userId provided, show public events or events where user is invited
    if (userId) {
      query.$or = [
        { isPublic: true },
        { invitedUsers: new Types.ObjectId(userId) },
        { createdBy: new Types.ObjectId(userId) },
      ];
    } else {
      // Admin view - show all events
      query.isPublic = true;
    }

    return this.eventModel
      .find(query)
      .populate('createdBy', 'fullName phoneNumber')
      .sort({ startDate: 1 })
      .exec();
  }

  async findUpcoming(limit: number = 10): Promise<EventDocument[]> {
    const now = new Date();
    return this.eventModel
      .find({
        startDate: { $gte: now },
        status: { $in: [EventStatus.PUBLISHED] },
        $or: [{ isPublic: true }],
      })
      .populate('createdBy', 'fullName phoneNumber')
      .sort({ startDate: 1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string, userId?: string): Promise<EventDocument> {
    const event = await this.eventModel
      .findById(id)
      .populate('createdBy', 'fullName phoneNumber')
      .exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check access
    if (userId) {
      const hasAccess =
        event.isPublic ||
        event.createdBy.toString() === userId ||
        event.invitedUsers.some((uid) => uid.toString() === userId);

      if (!hasAccess) {
        throw new UnauthorizedException('You do not have access to this event');
      }
    }

    // Increment view count
    event.viewCount += 1;
    await event.save();

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto, userId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Only creator can update
    if (event.createdBy.toString() !== userId) {
      throw new UnauthorizedException('Only event creator can update');
    }

    if (updateEventDto.startDate) {
      updateEventDto.startDate = new Date(updateEventDto.startDate as any) as any;
    }
    if (updateEventDto.endDate) {
      updateEventDto.endDate = new Date(updateEventDto.endDate as any) as any;
    }

    Object.assign(event, updateEventDto);
    return event.save();
  }

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Only creator can delete
    if (event.createdBy.toString() !== userId) {
      throw new UnauthorizedException('Only event creator can delete');
    }

    await this.eventModel.findByIdAndDelete(id).exec();
  }

  async rsvp(id: string, rsvpDto: RsvpEventDto, userId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingRsvpIndex = event.rsvps.findIndex(
      (r) => r.userId.toString() === userId,
    );

    if (rsvpDto.rsvp) {
      // RSVP to event
      if (existingRsvpIndex >= 0) {
        throw new BadRequestException('You have already RSVPed to this event');
      }

      // Check max attendees
      if (event.maxAttendees > 0 && event.currentAttendees >= event.maxAttendees) {
        throw new BadRequestException('Event is full');
      }

      event.rsvps.push({
        userId: new Types.ObjectId(userId),
        userName: user.fullName || user.phoneNumber,
        rsvpDate: new Date(),
      });
      event.currentAttendees += 1;
    } else {
      // Cancel RSVP
      if (existingRsvpIndex < 0) {
        throw new BadRequestException('You have not RSVPed to this event');
      }

      event.rsvps.splice(existingRsvpIndex, 1);
      event.currentAttendees = Math.max(0, event.currentAttendees - 1);
    }

    return event.save();
  }

  async addPhoto(id: string, photoUrl: string, userId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Only creator can add photos
    if (event.createdBy.toString() !== userId) {
      throw new UnauthorizedException('Only event creator can add photos');
    }

    if (!event.photos) {
      event.photos = [];
    }
    event.photos.push(photoUrl);

    return event.save();
  }

  async removePhoto(id: string, photoUrl: string, userId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Only creator can remove photos
    if (event.createdBy.toString() !== userId) {
      throw new UnauthorizedException('Only event creator can remove photos');
    }

    event.photos = event.photos.filter((p) => p !== photoUrl);

    return event.save();
  }

  async getMyEvents(userId: string): Promise<EventDocument[]> {
    return this.eventModel
      .find({
        $or: [
          { createdBy: new Types.ObjectId(userId) },
          { 'rsvps.userId': new Types.ObjectId(userId) },
        ],
      })
      .populate('createdBy', 'fullName phoneNumber')
      .sort({ startDate: 1 })
      .exec();
  }
}
