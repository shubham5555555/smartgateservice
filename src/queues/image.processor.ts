import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { S3Service } from '../common/s3.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Building, BuildingDocument } from '../schemas/building.schema';

@Injectable()
export class ImageProcessor implements OnModuleInit {
  private readonly logger = new Logger(ImageProcessor.name);
  private readonly connection: IORedis;

  constructor(
    private readonly s3Service: S3Service,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    private readonly configService: ConfigService,
  ) {
    this.connection = new IORedis(
      this.configService.get<string>('REDIS_URL', 'redis://default:TlGMWaK369Vl7xgiAhvmRzYx2VHeGP19@redis-14058.crce281.ap-south-1-3.ec2.cloud.redislabs.com:14058'),
      { maxRetriesPerRequest: null },
    );
  }

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

          const url = await this.s3Service.uploadFile(fakeFile, 'buildings');
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
            const url = await this.s3Service.uploadFile(fakeFile, 'buildings');
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
          const url = await this.s3Service.uploadFile(fakeFile, 'buildings/flats');
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
      { connection: this.connection },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Job failed ${job?.id}`, err);
    });
  }
}

