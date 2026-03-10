import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from '../common/s3.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) { }

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Put('profile/fcm-token')
  @ApiOperation({ summary: 'Update FCM token' })
  async updateFcmToken(@Request() req, @Body() body: { fcmToken: string }) {
    return this.usersService.updateFcmToken(req.user.userId, body.fcmToken);
  }

  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiConsumes('multipart/form-data')
  async uploadProfilePhoto(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    const photoUrl = await this.s3Service.uploadProfilePhoto(file);
    await this.usersService.updateProfile(req.user.userId, { profilePhoto: photoUrl });
    return { profilePhoto: photoUrl };
  }

  @Post('sub-users')
  @ApiOperation({ summary: 'Create a sub-user (Family Member or Tenant)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phoneNumber: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string', description: 'Optional login password' },
        role: { type: 'string', enum: ['Family Member', 'Tenant'] },
        relation: { type: 'string' },
      },
      required: ['fullName', 'role'],
    },
  })
  @ApiResponse({ status: 201, description: 'Sub-user created successfully' })
  async createSubUser(@Request() req, @Body() body: any) {
    return this.usersService.createSubUser(req.user.userId, body);
  }

  @Get('sub-users')
  @ApiOperation({ summary: 'Get all sub-users for the current owner' })
  @ApiResponse({ status: 200, description: 'Retrieved sub-users successfully' })
  async getSubUsers(@Request() req) {
    return this.usersService.getSubUsers(req.user.userId);
  }

  @Delete('sub-users/:id')
  @ApiOperation({ summary: 'Delete a sub-user (family member or tenant)' })
  @ApiParam({ name: 'id', description: 'Sub-user ID' })
  @ApiResponse({ status: 200, description: 'Sub-user deleted successfully' })
  async deleteSubUser(@Request() req, @Param('id') id: string) {
    return this.usersService.deleteSubUser(req.user.userId, id);
  }

  @Post('sub-users/:id/set-password')
  @ApiOperation({ summary: 'Set login email and password for a sub-user' })
  @ApiParam({ name: 'id', description: 'Sub-user ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Login email for sub-user' },
        password: { type: 'string', description: 'Login password for sub-user' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Login credentials set successfully' })
  async setSubUserPassword(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { email: string; password: string },
  ) {
    return this.usersService.setSubUserPassword(req.user.userId, id, body.email, body.password);
  }
}
