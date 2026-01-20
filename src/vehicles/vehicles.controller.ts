import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Vehicles')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Register a new vehicle',
    description: 'Registers a new vehicle for the authenticated user. Vehicle number must be unique for the user.',
  })
  @ApiBody({ type: CreateVehicleDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Vehicle registered successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input or vehicle already exists',
  })
  async createVehicle(@Request() req, @Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(req.user.userId, createVehicleDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get user vehicles',
    description: 'Retrieves all vehicles registered by the authenticated user.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of vehicles retrieved successfully',
  })
  async getMyVehicles(@Request() req) {
    return this.vehiclesService.getVehiclesByUser(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get vehicle by ID',
    description: 'Retrieves detailed information about a specific vehicle.',
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehicle details retrieved successfully',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Vehicle not found',
  })
  async getVehicleById(@Param('id') id: string) {
    return this.vehiclesService.getVehicleById(id);
  }

  @Post(':id/entry')
  @ApiOperation({ 
    summary: 'Record vehicle entry/exit',
    description: 'Records an entry or exit event for a vehicle at a gate.',
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        entryType: {
          type: 'string',
          enum: ['Entry', 'Exit'],
          description: 'Type of entry event',
        },
        gateNumber: {
          type: 'string',
          description: 'Gate number where entry/exit occurred',
          example: 'Gate 1',
        },
        guardName: {
          type: 'string',
          description: 'Name of the guard who recorded the entry',
          example: 'John Doe',
        },
      },
      required: ['entryType'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Entry recorded successfully',
  })
  async recordEntry(@Param('id') id: string, @Body() body: { entryType: string; gateNumber?: string; guardName?: string }) {
    return this.vehiclesService.recordEntry(id, body.entryType, body.gateNumber, body.guardName);
  }

  @Get(':id/entries')
  @ApiOperation({ 
    summary: 'Get vehicle entry history',
    description: 'Retrieves the entry/exit history for a specific vehicle.',
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Entry history retrieved successfully',
  })
  async getVehicleEntries(@Param('id') id: string) {
    return this.vehiclesService.getVehicleEntries(id);
  }
}
