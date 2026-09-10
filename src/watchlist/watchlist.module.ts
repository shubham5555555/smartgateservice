import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchlistEntry, WatchlistEntrySchema } from '../schemas/watchlist.schema';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WatchlistEntry.name, schema: WatchlistEntrySchema }]),
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
