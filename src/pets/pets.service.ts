import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument } from '../schemas/pet.schema';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
  ) {}

  async create(userId: string, createPetDto: CreatePetDto): Promise<PetDocument> {
    const pet = new this.petModel({
      ...createPetDto,
      userId: new Types.ObjectId(userId),
    });
    return pet.save();
  }

  async findAll(userId: string): Promise<PetDocument[]> {
    return this.petModel.find({ userId: new Types.ObjectId(userId), isActive: true }).exec();
  }

  async findOne(id: string, userId: string): Promise<PetDocument> {
    const pet = await this.petModel.findById(id).exec();
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    if (pet.userId.toString() !== userId) {
      throw new UnauthorizedException('Not authorized to access this pet');
    }
    return pet;
  }

  async update(id: string, userId: string, updatePetDto: UpdatePetDto): Promise<PetDocument> {
    const pet = await this.findOne(id, userId);
    Object.assign(pet, updatePetDto);
    return pet.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const pet = await this.findOne(id, userId);
    pet.isActive = false;
    await pet.save();
  }

  async getAllPets(): Promise<PetDocument[]> {
    return this.petModel.find({ isActive: true }).populate('userId', 'fullName phoneNumber building flatNo').exec();
  }
}
