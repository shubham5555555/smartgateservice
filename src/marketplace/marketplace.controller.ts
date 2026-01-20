import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportReason } from '../schemas/marketplace-report.schema';

@ApiTags('Marketplace')
@ApiBearerAuth('JWT-auth')
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new marketplace listing',
    description: 'Creates a new product listing in the marketplace. The listing will be set to Active status by default.',
  })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Listing created successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
  })
  async createListing(@Request() req, @Body() createListingDto: CreateListingDto) {
    return this.marketplaceService.createListing(req.user.userId, createListingDto);
  }

  @Post('upload-images')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({ 
    summary: 'Upload listing images',
    description: 'Uploads images for marketplace listings. Maximum 10 images per request.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Images uploaded successfully',
    schema: {
      example: {
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      },
    },
  })
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    const imageUrls = await Promise.all(files.map((file) => this.marketplaceService.uploadImage(file)));
    return { imageUrls };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all marketplace listings',
    description: 'Retrieves all marketplace listings with optional filtering and sorting. Supports pagination, category filtering, price range, location, and various sort options.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category', enum: ['Electronics', 'Furniture', 'Clothing', 'Books', 'Appliances', 'Vehicles', 'Sports & Fitness', 'Toys & Games', 'Home & Decor', 'Other'] })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status', enum: ['Active', 'Sold', 'Reserved', 'Deleted'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search in title and description' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', type: Number })
  @ApiQuery({ name: 'location', required: false, description: 'Filter by location' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort option', enum: ['newest', 'oldest', 'price_asc', 'price_desc', 'views', 'favorites'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Listings retrieved successfully',
  })
  async getAllListings(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('location') location?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.marketplaceService.getAllListings(
      category,
      status,
      search,
      minPrice ? parseFloat(minPrice) : undefined,
      maxPrice ? parseFloat(maxPrice) : undefined,
      location,
      sortBy,
    );
  }

  @Get('my-listings')
  @ApiOperation({ 
    summary: 'Get my listings',
    description: 'Retrieves all listings created by the authenticated user.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User listings retrieved successfully',
  })
  async getMyListings(@Request() req) {
    return this.marketplaceService.getMyListings(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get listing by ID',
    description: 'Retrieves detailed information about a specific listing. Automatically increments the view count.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing details retrieved successfully',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Listing not found',
  })
  async getListingById(@Param('id') id: string) {
    return this.marketplaceService.getListingById(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update listing',
    description: 'Updates a listing. Only the listing owner can update their listings. Cannot update sold listings.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing updated successfully',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Not the listing owner',
  })
  async updateListing(@Param('id') id: string, @Request() req, @Body() updateData: Partial<CreateListingDto>) {
    return this.marketplaceService.updateListing(id, req.user.userId, updateData);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete listing',
    description: 'Soft deletes a listing by setting its status to Deleted. Only the listing owner can delete their listings.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing deleted successfully',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Not the listing owner',
  })
  async deleteListing(@Param('id') id: string, @Request() req) {
    return this.marketplaceService.deleteListing(id, req.user.userId);
  }

  @Put(':id/sold')
  @ApiOperation({ 
    summary: 'Mark listing as sold',
    description: 'Marks a listing as sold. Only the listing owner can mark their listings as sold.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        buyerId: {
          type: 'string',
          description: 'ID of the buyer (optional)',
          example: '507f1f77bcf86cd799439011',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing marked as sold',
  })
  async markAsSold(@Param('id') id: string, @Request() req, @Body() body: { buyerId?: string }) {
    return this.marketplaceService.markAsSold(id, req.user.userId, body.buyerId);
  }

  @Put(':id/reserve')
  @ApiOperation({ 
    summary: 'Reserve listing',
    description: 'Reserves a listing for the authenticated user. The listing status will be changed to Reserved.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing reserved successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Listing is not available',
  })
  async reserveListing(@Param('id') id: string, @Request() req) {
    return this.marketplaceService.reserveListing(id, req.user.userId);
  }

  // Favorites
  @Post(':id/favorite')
  @ApiOperation({ 
    summary: 'Add to favorites',
    description: 'Adds a listing to the user\'s favorites list.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Added to favorites successfully',
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Listing already in favorites',
  })
  async addToFavorites(@Param('id') id: string, @Request() req) {
    return this.marketplaceService.addToFavorites(id, req.user.userId);
  }

  @Delete(':id/favorite')
  @ApiOperation({ 
    summary: 'Remove from favorites',
    description: 'Removes a listing from the user\'s favorites list.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Removed from favorites successfully',
  })
  async removeFromFavorites(@Param('id') id: string, @Request() req) {
    return this.marketplaceService.removeFromFavorites(id, req.user.userId);
  }

  @Get('favorites')
  @ApiOperation({ 
    summary: 'Get favorites',
    description: 'Retrieves all listings in the user\'s favorites list.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Favorites retrieved successfully',
  })
  async getFavorites(@Request() req) {
    return this.marketplaceService.getFavorites(req.user.userId);
  }

  @Get(':id/is-favorite')
  @ApiOperation({ 
    summary: 'Check if favorite',
    description: 'Checks if a listing is in the user\'s favorites list.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Favorite status retrieved',
    schema: {
      example: {
        isFavorite: true,
      },
    },
  })
  async isFavorite(@Param('id') id: string, @Request() req) {
    const isFav = await this.marketplaceService.isFavorite(id, req.user.userId);
    return { isFavorite: isFav };
  }

  // Reports
  @Post(':id/report')
  @ApiOperation({ 
    summary: 'Report listing',
    description: 'Reports a listing for inappropriate content or policy violations. Each user can only report a listing once.',
  })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: Object.values(ReportReason),
          description: 'Reason for reporting',
          example: ReportReason.SPAM,
        },
        description: {
          type: 'string',
          description: 'Additional details about the report',
          example: 'This listing contains inappropriate content',
        },
      },
      required: ['reason'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Listing reported successfully',
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Listing already reported by this user',
  })
  async reportListing(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason: ReportReason; description?: string },
  ) {
    return this.marketplaceService.reportListing(id, req.user.userId, body.reason, body.description);
  }
}
