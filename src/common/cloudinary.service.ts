import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    // Try CLOUDINARY_URL first (alternative format)
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');
    
    if (cloudinaryUrl) {
      // Parse CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
      try {
        cloudinary.config({
          secure: true,
        });
        // Cloudinary SDK can parse CLOUDINARY_URL automatically if set as env var
        // But we'll set it explicitly for better control
        const urlMatch = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
        if (urlMatch) {
          const [, apiKey, apiSecret, cloudName] = urlMatch;
          cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true,
          });
          this.logger.log('✅ Cloudinary configured from CLOUDINARY_URL');
          this.logger.log(`   Cloud Name: ${cloudName}`);
          this.logger.log(`   API Key: ${apiKey.substring(0, 5)}...`);
          return;
        }
      } catch (error) {
        this.logger.warn('Failed to parse CLOUDINARY_URL, trying individual credentials...');
      }
    }

    // Fallback to individual credentials
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    // Validate credentials
    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.error('❌ Cloudinary credentials are missing! Please check your .env file.');
      this.logger.error(`Cloud Name: ${cloudName ? '✅' : '❌'}`);
      this.logger.error(`API Key: ${apiKey ? '✅' : '❌'}`);
      this.logger.error(`API Secret: ${apiSecret ? '✅' : '❌'}`);
      throw new Error('Cloudinary credentials are missing. Please check your .env file.');
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      secure: true,
    });

    this.logger.log('✅ Cloudinary configured successfully');
    this.logger.log(`   Cloud Name: ${cloudName}`);
    this.logger.log(`   API Key: ${apiKey.substring(0, 5)}...`);
  }

  /**
   * Upload a file buffer to Cloudinary
   * @param file - Multer file object
   * @param folder - Folder path in Cloudinary (e.g., 'marketplace', 'profile-photos', 'documents')
   * @param transformation - Optional image transformations
   * @returns Promise with uploaded file URL
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'smartgate',
    transformation?: any,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder: folder,
        resource_type: 'auto', // Automatically detect image, video, raw
        public_id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      // Add transformations for images
      if (file.mimetype.startsWith('image/') && transformation) {
        uploadOptions.transformation = transformation;
      }

      // Convert buffer to data URI for Cloudinary
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      cloudinary.uploader.upload(
        dataUri,
        uploadOptions,
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            
            // Provide helpful error messages for common issues
            if (error.http_code === 401) {
              this.logger.error('❌ Authentication failed. Please verify your Cloudinary credentials:');
              this.logger.error('   1. Check your Cloudinary dashboard: https://console.cloudinary.com/');
              this.logger.error('   2. Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env');
              this.logger.error('   3. Make sure there are no extra spaces or quotes in the .env file');
              reject(new Error(`Cloudinary authentication failed: ${error.message}. Please verify your credentials in .env file.`));
            } else {
              reject(new Error(`Failed to upload file: ${error.message}`));
            }
            return;
          }

          if (!result) {
            reject(new Error('Upload failed: No result returned'));
            return;
          }

          this.logger.log(`✅ File uploaded successfully: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );
    });
  }

  /**
   * Upload multiple files
   * @param files - Array of Multer file objects
   * @param folder - Folder path in Cloudinary
   * @param transformation - Optional image transformations
   * @returns Promise with array of uploaded file URLs
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: string = 'smartgate',
    transformation?: any,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder, transformation));
    return Promise.all(uploadPromises);
  }

  /**
   * Upload image with optimization settings
   * @param file - Multer file object
   * @param folder - Folder path
   * @param width - Optional width
   * @param height - Optional height
   * @returns Promise with optimized image URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'smartgate',
    width?: number,
    height?: number,
  ): Promise<string> {
    const transformation: any = {
      fetch_format: 'auto',
      quality: 'auto',
    };

    if (width || height) {
      transformation.width = width;
      transformation.height = height;
      transformation.crop = 'limit'; // Maintain aspect ratio, don't crop
    }

    return this.uploadFile(file, folder, transformation);
  }

  /**
   * Upload optimized image for marketplace listings
   * @param file - Multer file object
   * @returns Promise with optimized image URL
   */
  async uploadMarketplaceImage(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'marketplace/listings', 1200, 1200);
  }

  /**
   * Upload profile photo with circular crop
   * @param file - Multer file object
   * @returns Promise with profile photo URL
   */
  async uploadProfilePhoto(file: Express.Multer.File): Promise<string> {
    const transformation = {
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'face', // Focus on face if detected
      fetch_format: 'auto',
      quality: 'auto',
    };

    return this.uploadFile(file, 'profile-photos', transformation);
  }

  /**
   * Upload document file
   * @param file - Multer file object
   * @returns Promise with document URL
   */
  async uploadDocument(file: Express.Multer.File): Promise<string> {
    return this.uploadFile(file, 'documents');
  }

  /**
   * Upload event photo
   * @param file - Multer file object
   * @returns Promise with event photo URL
   */
  async uploadEventPhoto(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'events', 1920, 1080);
  }

  /**
   * Upload chat image
   * @param file - Multer file object
   * @returns Promise with chat image URL
   */
  async uploadChatImage(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'chat/images', 800, 800);
  }

  /**
   * Upload chat file
   * @param file - Multer file object
   * @returns Promise with chat file URL
   */
  async uploadChatFile(file: Express.Multer.File): Promise<string> {
    return this.uploadFile(file, 'chat/files');
  }

  /**
   * Upload pet photo
   * @param file - Multer file object
   * @returns Promise with pet photo URL
   */
  async uploadPetPhoto(file: Express.Multer.File): Promise<string> {
    const transformation = {
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'auto',
      fetch_format: 'auto',
      quality: 'auto',
    };

    return this.uploadFile(file, 'pets/photos', transformation);
  }

  /**
   * Upload complaint attachment
   * @param file - Multer file object
   * @returns Promise with attachment URL
   */
  async uploadComplaintAttachment(file: Express.Multer.File): Promise<string> {
    // For images, optimize; for other files, store as-is
    if (file.mimetype.startsWith('image/')) {
      return this.uploadImage(file, 'complaints/attachments', 1920, 1080);
    }
    return this.uploadFile(file, 'complaints/attachments');
  }

  /**
   * Delete a file from Cloudinary
   * @param publicId - Public ID of the file in Cloudinary
   * @returns Promise with deletion result
   */
  async deleteFile(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          this.logger.error('Cloudinary delete error:', error);
          reject(new Error(`Failed to delete file: ${error.message}`));
          return;
        }
        this.logger.log(`✅ File deleted successfully: ${publicId}`);
        resolve(result);
      });
    });
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param url - Cloudinary URL
   * @returns Public ID or null
   */
  extractPublicId(url: string): string | null {
    try {
      const matches = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|txt|mp4|mp3|zip)/i);
      if (matches && matches[1]) {
        return matches[1];
      }
      return null;
    } catch (error) {
      this.logger.error('Error extracting public ID:', error);
      return null;
    }
  }

  /**
   * Generate optimized URL with transformations
   * @param url - Original Cloudinary URL
   * @param transformation - Transformation options
   * @returns Optimized URL
   */
  getOptimizedUrl(url: string, transformation?: any): string {
    try {
      const publicId = this.extractPublicId(url);
      if (!publicId) {
        return url; // Return original if can't extract public ID
      }

      return cloudinary.url(publicId, {
        ...transformation,
        secure: true,
      });
    } catch (error) {
      this.logger.error('Error generating optimized URL:', error);
      return url;
    }
  }
}
