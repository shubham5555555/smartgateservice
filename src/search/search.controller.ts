import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Request() req, @Query('q') query: string) {
    if (!query || query.trim().length === 0) {
      return { staff: [], visitors: [] };
    }
    return this.searchService.search(req.user.userId, query.trim());
  }
}
