import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { EmergencyContact, EmergencyContactSchema } from '../schemas/emergency-contact.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmergencyContact.name, schema: EmergencyContactSchema },
    ]),
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
})
export class EmergencyModule {}
