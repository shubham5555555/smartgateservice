import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('parcels')
@UseGuards(JwtAuthGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  async createParcel(@Request() req, @Body() createParcelDto: CreateParcelDto) {
    return this.parcelsService.createParcel(req.user.userId, createParcelDto);
  }

  @Get()
  async getMyparcels(@Request() req) {
    return this.parcelsService.getParcelsByUser(req.user.userId);
  }

  @Get('pending')
  async getPendingParcels(@Request() req) {
    return this.parcelsService.getPendingParcels(req.user.userId);
  }

  @Get(':id')
  async getParcelById(@Param('id') id: string) {
    return this.parcelsService.getParcelById(id);
  }

  @Put(':id/collect')
  async collectParcel(
    @Param('id') id: string,
    @Body() body: { collectedBy: string },
  ) {
    return this.parcelsService.collectParcel(id, body.collectedBy);
  }
}
