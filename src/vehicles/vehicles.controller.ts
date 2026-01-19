import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  async createVehicle(@Request() req, @Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(req.user.userId, createVehicleDto);
  }

  @Get()
  async getMyVehicles(@Request() req) {
    return this.vehiclesService.getVehiclesByUser(req.user.userId);
  }

  @Get(':id')
  async getVehicleById(@Param('id') id: string) {
    return this.vehiclesService.getVehicleById(id);
  }

  @Post(':id/entry')
  async recordEntry(@Param('id') id: string, @Body() body: { entryType: string; gateNumber?: string; guardName?: string }) {
    return this.vehiclesService.recordEntry(id, body.entryType, body.gateNumber, body.guardName);
  }

  @Get(':id/entries')
  async getVehicleEntries(@Param('id') id: string) {
    return this.vehiclesService.getVehicleEntries(id);
  }
}
