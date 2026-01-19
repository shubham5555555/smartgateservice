import { IsBoolean } from 'class-validator';

export class RsvpEventDto {
  @IsBoolean()
  rsvp: boolean; // true to RSVP, false to cancel RSVP
}
