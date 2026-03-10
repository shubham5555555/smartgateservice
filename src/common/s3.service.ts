import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private s3Client: S3Client;
    private bucketName: string;
    private region: string;

    constructor(private configService: ConfigService) {
        this.region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

        if (!this.bucketName || !accessKeyId || !secretAccessKey) {
            this.logger.error('❌ AWS S3 credentials are missing from .env!');
        } else {
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
            this.logger.log(`✅ S3 configured for bucket: ${this.bucketName}`);
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'smartgate', transformation?: Record<string, unknown>): Promise<string> {
        const fileExtension = file.originalname.split('.').pop();
        const key = `${folder}/${uuidv4()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            // ACL: 'public-read', // If using ACLs, otherwise ensure bucket policy allows public read if URLs are to be accessed publicly
        });

        try {
            await this.s3Client.send(command);
            const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
            this.logger.log(`✅ File uploaded successfully: ${url}`);
            return url;
        } catch (error: any) {
            this.logger.error('S3 upload error:', error);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    async uploadFiles(files: Express.Multer.File[], folder: string = 'smartgate', transformation?: Record<string, unknown>): Promise<string[]> {
        const uploadPromises = files.map((file) => this.uploadFile(file, folder, transformation));
        return Promise.all(uploadPromises);
    }

    async uploadImage(file: Express.Multer.File, folder: string = 'smartgate', width?: number, height?: number): Promise<string> {
        // Basic wrapper, actual image manipulation would require sharp or pre-signed URLs with a Lambda edge
        return this.uploadFile(file, folder);
    }

    async uploadMarketplaceImage(file: Express.Multer.File): Promise<string> {
        return this.uploadImage(file, 'marketplace/listings');
    }

    async uploadProfilePhoto(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'profile-photos');
    }

    async uploadDocument(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'documents');
    }

    async uploadEventPhoto(file: Express.Multer.File): Promise<string> {
        return this.uploadImage(file, 'events');
    }

    async uploadChatImage(file: Express.Multer.File): Promise<string> {
        return this.uploadImage(file, 'chat/images');
    }

    async uploadChatFile(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'chat/files');
    }

    async uploadPetPhoto(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'pets/photos');
    }

    async uploadVisitorPhoto(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'visitors/photos');
    }

    async uploadComplaintAttachment(file: Express.Multer.File): Promise<string> {
        return this.uploadFile(file, 'complaints/attachments');
    }

    async deleteFile(url: string): Promise<any> {
        try {
            // Extract key from URL
            // https://bucket.s3.region.amazonaws.com/folder/file.ext
            const urlObj = new URL(url);
            const key = urlObj.pathname.substring(1); // remove leading slash

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const response = await this.s3Client.send(command);
            this.logger.log(`✅ File deleted successfully: ${key}`);
            return response;
        } catch (error: any) {
            this.logger.error('S3 delete error:', error);
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }

    getOptimizedUrl(url: string, transformation?: Record<string, unknown>): string {
        return url; // S3 doesn't have built-in on-the-fly transformations without CloudFront+Lambda
    }
}
