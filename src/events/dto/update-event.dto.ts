import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '../../schemas/event.schema';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;
}
