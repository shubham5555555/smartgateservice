import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from '../common/s3.service';

@ApiTags('Complaints')
@ApiBearerAuth('JWT-auth')
@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    private readonly s3Service: S3Service,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'File a complaint',
    description:
      'Creates a new complaint for the authenticated user. The complaint will be set to Open status by default.',
  })
  @ApiBody({ type: CreateComplaintDto })
  @ApiResponse({
    status: 201,
    description: 'Complaint filed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async createComplaint(
    @Request() req,
    @Body() createComplaintDto: CreateComplaintDto,
  ) {
    return this.complaintsService.createComplaint(
      req.user.userId,
      createComplaintDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get my complaints',
    description: 'Retrieves all complaints filed by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Complaints retrieved successfully',
  })
  async getMyComplaints(@Request() req) {
    return this.complaintsService.getComplaintsByUser(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get complaint by ID',
    description: 'Retrieves detailed information about a specific complaint.',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({
    status: 200,
    description: 'Complaint retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Complaint not found',
  })
  async getComplaintById(@Param('id') id: string) {
    return this.complaintsService.getComplaintById(id);
  }

  @Post('upload-attachments')
  @UseInterceptors(FilesInterceptor('attachments', 10))
  @ApiOperation({
    summary: 'Upload complaint attachments',
    description:
      'Uploads attachment files (images, documents) for complaints to S3. Returns the file URLs to use when creating complaints.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Attachments uploaded successfully',
    schema: {
      example: {
        attachmentUrls: [
          'https://bucket-name.s3.region.amazonaws.com/complaints/attachments/image.jpg',
        ],
      },
    },
  })
  async uploadAttachments(
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    const attachmentUrls = await Promise.all(
      files.map((file) =>
        this.s3Service.uploadComplaintAttachment(file),
      ),
    );

    return { attachmentUrls };
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a complaint' })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiBody({ schema: { example: { comment: 'Your message here' } } })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  async addComment(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @Request() req,
  ) {
    return this.complaintsService.addComment(id, comment, req.user.userId);
  }
}
