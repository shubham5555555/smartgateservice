import { Controller, Get, Put, Body, UseGuards, Request, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('profile')
  @ApiOperation({ 
    summary: 'Get user profile',
    description: 'Retrieves the authenticated user\'s profile information including personal details, flat information, and preferences.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing token',
  })
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Updates the authenticated user\'s profile information. Only provided fields will be updated.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing token',
  })
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Put('profile/fcm-token')
  @ApiOperation({ 
    summary: 'Update FCM token',
    description: 'Updates the Firebase Cloud Messaging token for push notifications.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fcmToken: {
          type: 'string',
          description: 'Firebase Cloud Messaging token',
          example: 'fcm_token_here',
        },
      },
      required: ['fcmToken'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'FCM token updated successfully',
  })
  async updateFcmToken(@Request() req, @Body() body: { fcmToken: string }) {
    return this.usersService.updateFcmToken(req.user.userId, body.fcmToken);
  }

  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ 
    summary: 'Upload profile photo',
    description: 'Uploads a profile photo to Cloudinary and updates the user profile.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Profile photo image file',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile photo uploaded successfully',
    schema: {
      example: {
        profilePhoto: 'https://res.cloudinary.com/dbfphetiv/image/upload/v1234567890/profile-photos/photo.jpg',
      },
    },
  })
  async uploadProfilePhoto(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    const photoUrl = await this.cloudinaryService.uploadProfilePhoto(file);
    await this.usersService.updateProfile(req.user.userId, { profilePhoto: photoUrl });
    
    return { profilePhoto: photoUrl };
  }
}
