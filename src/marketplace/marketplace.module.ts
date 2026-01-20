import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceChatController } from './marketplace-chat.controller';
import { MarketplaceChatService } from './marketplace-chat.service';
import { MarketplaceListing, MarketplaceListingSchema } from '../schemas/marketplace-listing.schema';
import { MarketplaceFavorite, MarketplaceFavoriteSchema } from '../schemas/marketplace-favorite.schema';
import { MarketplaceReport, MarketplaceReportSchema } from '../schemas/marketplace-report.schema';
import { MarketplaceChat, MarketplaceChatSchema } from '../schemas/marketplace-chat.schema';
import { MarketplaceChatMessage, MarketplaceChatMessageSchema } from '../schemas/marketplace-chat-message.schema';
import { CloudinaryService } from '../common/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketplaceListing.name, schema: MarketplaceListingSchema },
      { name: MarketplaceFavorite.name, schema: MarketplaceFavoriteSchema },
      { name: MarketplaceReport.name, schema: MarketplaceReportSchema },
      { name: MarketplaceChat.name, schema: MarketplaceChatSchema },
      { name: MarketplaceChatMessage.name, schema: MarketplaceChatMessageSchema },
    ]),
  ],
  controllers: [MarketplaceController, MarketplaceChatController],
  providers: [MarketplaceService, MarketplaceChatService],
  exports: [MarketplaceService, MarketplaceChatService],
})
export class MarketplaceModule {}
