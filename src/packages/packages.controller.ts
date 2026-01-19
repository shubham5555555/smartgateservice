import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('packages')
@UseGuards(JwtAuthGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  async createPackage(@Request() req, @Body() createPackageDto: CreatePackageDto) {
    return this.packagesService.createPackage(req.user.userId, createPackageDto);
  }

  @Get()
  async getMyPackages(@Request() req) {
    return this.packagesService.getPackagesByUser(req.user.userId);
  }

  @Get('pending')
  async getPendingPackages(@Request() req) {
    return this.packagesService.getPendingPackages(req.user.userId);
  }

  @Get(':id')
  async getPackageById(@Param('id') id: string) {
    return this.packagesService.getPackageById(id);
  }

  @Put(':id/collect')
  async collectPackage(@Param('id') id: string, @Body() body: { collectedBy: string }) {
    return this.packagesService.collectPackage(id, body.collectedBy);
  }
}
