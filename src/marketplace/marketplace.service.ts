import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MarketplaceListing, MarketplaceListingDocument, ListingStatus } from '../schemas/marketplace-listing.schema';
import { MarketplaceFavorite, MarketplaceFavoriteDocument } from '../schemas/marketplace-favorite.schema';
import { MarketplaceReport, MarketplaceReportDocument, ReportReason } from '../schemas/marketplace-report.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { CloudinaryService } from '../common/cloudinary.service';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(MarketplaceListing.name)
    private listingModel: Model<MarketplaceListingDocument>,
    @InjectModel(MarketplaceFavorite.name)
    private favoriteModel: Model<MarketplaceFavoriteDocument>,
    @InjectModel(MarketplaceReport.name)
    private reportModel: Model<MarketplaceReportDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createListing(userId: string, createListingDto: CreateListingDto) {
    try {
      const listing = new this.listingModel({
        ...createListingDto,
        userId: new Types.ObjectId(userId),
        status: ListingStatus.ACTIVE,
      });

      return await listing.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create listing: ${error.message}`);
    }
  }

  async getAllListings(
    category?: string,
    status?: string,
    search?: string,
    minPrice?: number,
    maxPrice?: number,
    location?: string,
    sortBy?: string,
  ) {
    const query: any = { status: { $ne: ListingStatus.DELETED } };

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPrice !== undefined) {
      query.price = { ...query.price, $gte: minPrice };
    }

    if (maxPrice !== undefined) {
      query.price = { ...query.price, $lte: maxPrice };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    let sort: any = { createdAt: -1 };
    switch (sortBy) {
      case 'price_asc':
        sort = { price: 1 };
        break;
      case 'price_desc':
        sort = { price: -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'views':
        sort = { viewCount: -1 };
        break;
      case 'favorites':
        sort = { favoriteCount: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    return this.listingModel
      .find(query)
      .populate('userId', 'fullName phoneNumber building flatNo')
      .populate('buyerId', 'fullName phoneNumber')
      .sort(sort)
      .exec();
  }

  async getListingById(id: string) {
    const listing = await this.listingModel
      .findById(id)
      .populate('userId', 'fullName phoneNumber building flatNo')
      .populate('buyerId', 'fullName phoneNumber')
      .exec();

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Increment view count
    await this.listingModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    return listing;
  }

  async getMyListings(userId: string) {
    return this.listingModel
      .find({ userId: new Types.ObjectId(userId), status: { $ne: ListingStatus.DELETED } })
      .populate('buyerId', 'fullName phoneNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateListing(id: string, userId: string, updateData: Partial<CreateListingDto>) {
    const listing = await this.listingModel.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId.toString() !== userId) {
      throw new BadRequestException('You can only update your own listings');
    }

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException('Cannot update a sold listing');
    }

    return this.listingModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async deleteListing(id: string, userId: string) {
    const listing = await this.listingModel.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own listings');
    }

    return this.listingModel.findByIdAndUpdate(id, { status: ListingStatus.DELETED }, { new: true }).exec();
  }

  async markAsSold(id: string, userId: string, buyerId?: string) {
    const listing = await this.listingModel.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.userId.toString() !== userId) {
      throw new BadRequestException('You can only mark your own listings as sold');
    }

    return this.listingModel.findByIdAndUpdate(
      id,
      {
        status: ListingStatus.SOLD,
        buyerId: buyerId ? new Types.ObjectId(buyerId) : undefined,
        soldAt: new Date(),
      },
      { new: true },
    ).exec();
  }

  async reserveListing(id: string, buyerId: string) {
    const listing = await this.listingModel.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not available');
    }

    return this.listingModel.findByIdAndUpdate(
      id,
      {
        status: ListingStatus.RESERVED,
        buyerId: new Types.ObjectId(buyerId),
      },
      { new: true },
    ).exec();
  }

  // Favorites
  async addToFavorites(listingId: string, userId: string) {
    const listing = await this.listingModel.findById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const existingFavorite = await this.favoriteModel.findOne({
      userId: new Types.ObjectId(userId),
      listingId: new Types.ObjectId(listingId),
    });

    if (existingFavorite) {
      throw new ConflictException('Listing already in favorites');
    }

    const favorite = new this.favoriteModel({
      userId: new Types.ObjectId(userId),
      listingId: new Types.ObjectId(listingId),
    });

    await favorite.save();

    // Increment favorite count
    await this.listingModel.findByIdAndUpdate(listingId, { $inc: { favoriteCount: 1 } });

    return favorite;
  }

  async removeFromFavorites(listingId: string, userId: string) {
    const favorite = await this.favoriteModel.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      listingId: new Types.ObjectId(listingId),
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    // Decrement favorite count
    await this.listingModel.findByIdAndUpdate(listingId, { $inc: { favoriteCount: -1 } });

    return { success: true };
  }

  async getFavorites(userId: string) {
    const favorites = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'listingId',
        populate: {
          path: 'userId',
          select: 'fullName phoneNumber building flatNo',
        },
      })
      .sort({ createdAt: -1 })
      .exec();

    return favorites.map((fav) => (fav as any).listingId).filter((listing) => listing);
  }

  async isFavorite(listingId: string, userId: string): Promise<boolean> {
    const favorite = await this.favoriteModel.findOne({
      userId: new Types.ObjectId(userId),
      listingId: new Types.ObjectId(listingId),
    });

    return !!favorite;
  }

  // Reports
  async reportListing(listingId: string, userId: string, reason: ReportReason, description?: string) {
    const listing = await this.listingModel.findById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if user already reported this listing
    const existingReport = await this.reportModel.findOne({
      listingId: new Types.ObjectId(listingId),
      reportedBy: new Types.ObjectId(userId),
    });

    if (existingReport) {
      throw new ConflictException('You have already reported this listing');
    }

    const report = new this.reportModel({
      listingId: new Types.ObjectId(listingId),
      reportedBy: new Types.ObjectId(userId),
      reason,
      description,
    });

    await report.save();

    // Increment report count
    await this.listingModel.findByIdAndUpdate(listingId, { $inc: { reportCount: 1 } });

    return report;
  }

  // Upload image to Cloudinary
  async uploadImage(file: Express.Multer.File): Promise<string> {
    return this.cloudinaryService.uploadMarketplaceImage(file);
  }
}
