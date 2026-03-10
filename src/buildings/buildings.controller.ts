import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BuildingsService } from './buildings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CacheService } from '../common/cache.service';
import { CreateBuildingDto } from './dto/create-building.dto';

@ApiTags('Buildings')
@Controller('buildings')
export class BuildingsController {
  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('public')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all buildings (public - for user selection)' })
  @ApiResponse({ status: 200, description: 'Buildings retrieved successfully' })
  async getAllBuildingsPublic(@Query('page') page?: string, @Query('limit') limit?: string) {
    const cacheKey = `buildings:public:all:${page || 'all'}:${limit || 'all'}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
    const options: any = {};
    if (page) options.page = parseInt(page, 10);
    if (limit) options.limit = parseInt(limit, 10);
    const data = await this.buildingsService.getAllBuildings(options);
    await this.cacheService.set(cacheKey, data, 60); // cache for 60s
    return data;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all buildings' })
  @ApiResponse({ status: 200, description: 'Buildings retrieved successfully' })
  async getAllBuildings(@Query('page') page?: string, @Query('limit') limit?: string) {
    const options: any = {};
    if (page) options.page = parseInt(page, 10);
    if (limit) options.limit = parseInt(limit, 10);
    return this.buildingsService.getAllBuildings(options);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new building' })
  @ApiResponse({ status: 201, description: 'Building created successfully' })
  async createBuilding(@Body() createBuildingDto: CreateBuildingDto) {
    const created = await this.buildingsService.createBuilding(createBuildingDto);
    // Invalidate public cache
    await this.cacheService.del('buildings:public:all');
    return created;
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import buildings via CSV (admin)' })
  async importBuildings(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    // Delegate parsing/validation to service
    const result = await this.buildingsService.bulkImport(file);
    // Invalidate public cache
    await this.cacheService.del('buildings:public:all');
    return result;
  }

  @Post(':id/bulk-assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bulk assign residents to flats (atomic)' })
  async bulkAssign(
    @Param('id') id: string,
    @Body() body: { assignments: Array<{ residentId?: string; residentEmail?: string; flatNumber: string }> },
  ) {
    const res = await this.buildingsService.bulkAssign(id, body.assignments || []);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${id}`);
    return res;
  }

  @Get(':id/export.csv')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Export building as CSV' })
  async exportBuildingCsv(@Param('id') id: string) {
    const csv = await this.buildingsService.exportBuildingCsv(id);
    return { csv };
  }

  @Get('public/:id')
  @ApiOperation({ summary: 'Get building by ID (public - for user selection)' })
  @ApiResponse({ status: 200, description: 'Building retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async getBuildingByIdPublic(@Param('id') id: string) {
    const cacheKey = `buildings:public:${id}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.buildingsService.getBuildingById(id);
    await this.cacheService.set(cacheKey, data, 60);
    return data;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get building by ID' })
  @ApiResponse({ status: 200, description: 'Building retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async getBuildingById(@Param('id') id: string) {
    return this.buildingsService.getBuildingById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update building' })
  @ApiResponse({ status: 200, description: 'Building updated successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async updateBuilding(
    @Param('id') id: string,
    @Body() updateBuildingDto: any,
  ) {
    const updated = await this.buildingsService.updateBuilding(id, updateBuildingDto);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${id}`);
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete building' })
  @ApiResponse({ status: 200, description: 'Building deleted successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async deleteBuilding(@Param('id') id: string) {
    const deleted = await this.buildingsService.deleteBuilding(id);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${id}`);
    return deleted;
  }

  @Post(':id/flats/:flatNumber/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign resident to flat' })
  @ApiResponse({ status: 200, description: 'Resident assigned successfully' })
  async assignResidentToFlat(
    @Param('id') buildingId: string,
    @Param('flatNumber') flatNumber: string,
    @Body() body: { residentId: string },
  ) {
    const res = await this.buildingsService.assignResidentToFlat(
      buildingId,
      flatNumber,
      body.residentId,
    );
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${buildingId}`);
    return res;
  }

  @Post(':id/flats/:flatNumber/unassign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unassign resident from flat' })
  @ApiResponse({ status: 200, description: 'Resident unassigned successfully' })
  async unassignResidentFromFlat(
    @Param('id') buildingId: string,
    @Param('flatNumber') flatNumber: string,
  ) {
    const res = await this.buildingsService.unassignResidentFromFlat(
      buildingId,
      flatNumber,
    );
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${buildingId}`);
    return res;
  }

  @Put(':id/flats/:flatNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update flat details' })
  @ApiResponse({ status: 200, description: 'Flat updated successfully' })
  async updateFlatDetails(
    @Param('id') buildingId: string,
    @Param('flatNumber') flatNumber: string,
    @Body() flatDetails: any,
  ) {
    return this.buildingsService.updateFlatDetails(
      buildingId,
      flatNumber,
      flatDetails,
    );
  }

  @Post('sync-residents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sync residents with building flats' })
  @ApiResponse({ status: 200, description: 'Residents synced successfully' })
  async syncResidents() {
    return this.buildingsService.syncResidentsWithBuildings();
  }

  @Post(':id/upload-image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload building main image' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  async uploadBuildingImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Basic server-side validations
    if (!file || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size && file.size > maxBytes) {
      throw new BadRequestException('File too large (max 5MB)');
    }
    const res = await this.buildingsService.uploadBuildingImage(id, file);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${id}`);
    return res;
  }

  @Post(':id/upload-images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple building images' })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  async uploadBuildingImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB per file
    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Only image uploads are allowed');
      }
      if (file.size && file.size > maxBytes) {
        throw new BadRequestException('One or more files exceed 5MB');
      }
    }
    const res = await this.buildingsService.uploadBuildingImages(id, files);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${id}`);
    return res;
  }

  @Post(':id/flats/:flatNumber/upload-image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload flat image' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  async uploadFlatImage(
    @Param('id') buildingId: string,
    @Param('flatNumber') flatNumber: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size && file.size > maxBytes) {
      throw new BadRequestException('File too large (max 5MB)');
    }
    const res = await this.buildingsService.uploadFlatImage(buildingId, flatNumber, file);
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${buildingId}`);
    return res;
  }

  @Delete(':id/flats/:flatNumber/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete flat image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  async deleteFlatImage(
    @Param('id') buildingId: string,
    @Param('flatNumber') flatNumber: string,
    @Body() body: { imageUrl: string },
  ) {
    const res = await this.buildingsService.deleteFlatImage(
      buildingId,
      flatNumber,
      body.imageUrl,
    );
    await this.cacheService.del('buildings:public:all');
    await this.cacheService.del(`buildings:public:${buildingId}`);
    return res;
  }
}
