import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicVisitsService } from './public-visits.service';
import { PublicVisitDto } from './dto/public-visit.dto';
import { S3Service } from '../common/s3.service';

/**
 * Unauthenticated endpoints backing the QR poster at the gate. Everything here
 * is addressed by an unguessable token — never by an id or a phone number.
 */
@ApiTags('Public Visits')
@UseGuards(ThrottlerGuard)
@Controller('public')
export class PublicVisitsController {
  constructor(
    private readonly publicVisitsService: PublicVisitsService,
    private readonly s3Service: S3Service,
  ) {}

  @Get('sites/:siteToken')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Site details + the form to render (gate QR scan)' })
  async getSite(@Param('siteToken') siteToken: string) {
    return this.publicVisitsService.getSiteForm(siteToken);
  }

  @Post('sites/:siteToken/visits')
  @Throttle({ default: { limit: 60, ttl: 600_000 } }) // a lobby kiosk shares one IP
  @ApiOperation({ summary: 'Register a visit from the gate QR form' })
  async createVisit(
    @Param('siteToken') siteToken: string,
    @Body() dto: PublicVisitDto,
  ) {
    return this.publicVisitsService.createVisit(siteToken, dto);
  }

  @Post('sites/:siteToken/photo')
  @Throttle({ default: { limit: 60, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a visitor photo / ID image before registering' })
  async uploadPhoto(
    @Param('siteToken') siteToken: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!/^image\//.test(file.mimetype || '')) {
      throw new BadRequestException('Only image files are accepted');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
    // Validates the token — and that the form is open — before accepting an upload.
    const form = await this.publicVisitsService.getSiteForm(siteToken);
    if (!form.enabled) {
      throw new BadRequestException(form.disabledReason || 'Self-registration is disabled');
    }
    const photoUrl = await this.s3Service.uploadVisitorPhoto(file);
    return { photoUrl };
  }

  @Get('visits/:passToken')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check the status of a visit pass' })
  async getVisit(@Param('passToken') passToken: string) {
    return this.publicVisitsService.getVisitByPassToken(passToken);
  }
}
