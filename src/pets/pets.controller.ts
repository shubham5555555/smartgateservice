import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';

@ApiTags('Pets')
@ApiBearerAuth('JWT-auth')
@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  create(@Request() req, @Body() createPetDto: CreatePetDto) {
    return this.petsService.create(req.user.userId, createPetDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.petsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.petsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() updatePetDto: UpdatePetDto) {
    return this.petsService.update(id, req.user.userId, updatePetDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete pet',
    description: 'Deletes a pet record. Only the pet owner can delete their pets.',
  })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pet deleted successfully',
  })
  remove(@Param('id') id: string, @Request() req) {
    return this.petsService.remove(id, req.user.userId);
  }

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ 
    summary: 'Upload pet photo',
    description: 'Uploads a pet photo to Cloudinary and returns the photo URL to use when creating or updating pets.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: 201, 
    description: 'Pet photo uploaded successfully',
    schema: {
      example: {
        photoUrl: 'https://res.cloudinary.com/dbfphetiv/image/upload/v1234567890/pets/photos/pet.jpg',
      },
    },
  })
  async uploadPetPhoto(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const photoUrl = await this.cloudinaryService.uploadPetPhoto(file);
    return { photoUrl };
  }
}
