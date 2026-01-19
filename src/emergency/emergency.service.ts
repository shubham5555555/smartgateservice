import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmergencyContact, EmergencyContactDocument, ContactType } from '../schemas/emergency-contact.schema';

@Injectable()
export class EmergencyService {
  constructor(
    @InjectModel(EmergencyContact.name) private contactModel: Model<EmergencyContactDocument>,
  ) {}

  async getEmergencyContacts() {
    return this.contactModel
      .find({ isActive: true })
      .sort({ contactType: 1, name: 1 })
      .exec();
  }

  async getContactsByType(type: string) {
    return this.contactModel
      .find({ contactType: type as ContactType, isActive: true })
      .exec();
  }

  async sendSOS(userId: string, location?: string, message?: string) {
    // In production, this would send notifications to security/admin
    // For now, just log the SOS request
    console.log(`SOS Alert from user ${userId}`, { location, message });
    
    // Get security contacts
    const securityContacts = await this.getContactsByType('Security');
    
    return {
      success: true,
      message: 'SOS alert sent',
      securityContacts,
      location,
      timestamp: new Date(),
    };
  }
}
