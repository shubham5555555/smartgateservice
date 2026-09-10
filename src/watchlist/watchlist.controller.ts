import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../tenancy/roles.guard';
import { Roles } from '../tenancy/roles.decorator';
import { TenantContext } from '../tenancy/tenant-context';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto, UpdateWatchlistDto } from './dto/watchlist.dto';

@ApiTags('Watchlist')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get('check')
  @Roles('admin', 'guard')
  @ApiOperation({ summary: 'Desk check: is this visitor on the watchlist?' })
  async check(
    @Query('phone') phone?: string,
    @Query('idLast4') idLast4?: string,
    @Query('vehicle') vehicle?: string,
    @Query('name') name?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    const scope = TenantContext.current();
    const hit = await this.watchlist.match({
      organizationId: scope.organizationId,
      buildingId,
      phoneNumber: phone,
      idProofLast4: idLast4,
      vehicleNumber: vehicle,
      name,
    });
    return { hit };
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.watchlist.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateWatchlistDto) {
    return this.watchlist.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateWatchlistDto) {
    return this.watchlist.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.watchlist.remove(id);
  }
}
