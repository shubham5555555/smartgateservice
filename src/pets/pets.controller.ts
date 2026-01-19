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
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

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
  remove(@Param('id') id: string, @Request() req) {
    return this.petsService.remove(id, req.user.userId);
  }
}
