import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CloudinaryService } from '../common/cloudinary.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Building, BuildingDocument } from '../schemas/building.schema';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

@Injectable()
export class ImageProcessor implements OnModuleInit {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
  ) {}

  onModuleInit() {
    const worker = new Worker(
      'imageQueue',
      async (job) => {
        this.logger.log(`imageQueue processing job ${job.id} action=${job.data.action}`);
        const { action } = job.data;
        if (action === 'uploadBuildingImage') {
          const { buildingId, filename, mimetype, buffer } = job.data;
          const fileBuffer = Buffer.from(buffer, 'base64');
          const fakeFile = {
            originalname: filename,
            mimetype,
            buffer: fileBuffer,
          } as Express.Multer.File;

          const url = await this.cloudinaryService.uploadFile(fakeFile, 'buildings');
          const building = await this.buildingModel.findById(buildingId).exec();
          if (building) {
            building.image = url;
            await building.save();
          }
          return { url };
        } else if (action === 'uploadBuildingImages') {
          const { buildingId, files } = job.data;
          const uploaded: string[] = [];
          for (const f of files) {
            const fileBuffer = Buffer.from(f.buffer, 'base64');
            const fakeFile = {
              originalname: f.filename,
              mimetype: f.mimetype,
              buffer: fileBuffer,
            } as Express.Multer.File;
            const url = await this.cloudinaryService.uploadFile(fakeFile, 'buildings');
            uploaded.push(url);
          }
          const building = await this.buildingModel.findById(buildingId).exec();
          if (building) {
            building.images = [...(building.images || []), ...uploaded];
            await building.save();
          }
          return { uploaded };
        } else if (action === 'uploadFlatImage') {
          const { buildingId, flatNumber, filename, mimetype, buffer } = job.data;
          const fileBuffer = Buffer.from(buffer, 'base64');
          const fakeFile = {
            originalname: filename,
            mimetype,
            buffer: fileBuffer,
          } as Express.Multer.File;
          const url = await this.cloudinaryService.uploadFile(fakeFile, 'buildings/flats');
          const building = await this.buildingModel.findById(buildingId).exec();
          if (building) {
            let flatFound = false;
            for (const floor of building.floors) {
              const flat = floor.flats.find((f) => f.flatNumber === flatNumber);
              if (flat) {
                if (!flat.images) flat.images = [];
                flat.images.push(url);
                flatFound = true;
                break;
              }
            }
            if (flatFound) await building.save();
          }
          return { url };
        }

        return { ok: true };
      },
      { connection },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Job failed ${job?.id}`, err);
    });
  }
}

