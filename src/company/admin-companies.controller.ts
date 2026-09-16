import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../tenancy/roles.guard';
import { Roles } from '../tenancy/roles.decorator';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateCompanyMemberDto, SetMemberPasswordDto } from './dto/member.dto';

/**
 * Admin side of office tenants: create the company and its first accounts
 * (owner / HR). Everything after that the company runs itself through
 * `/company/*` in the user app.
 */
@ApiTags('Admin · Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly companyService: CompanyService) {}

  private actorLabel(req: any): string {
    return req?.user?.name || req?.user?.email || req?.user?.userId || 'admin';
  }

  @Post()
  @ApiOperation({ summary: 'Create an office tenant in a commercial building' })
  async create(@Request() req, @Body() dto: CreateCompanyDto) {
    return this.companyService.createCompany(dto as any, this.actorLabel(req));
  }

  @Get()
  @ApiOperation({ summary: 'List companies with member and occupancy counts' })
  async list(
    @Query('buildingId') buildingId?: string,
    @Query('search') search?: string,
  ) {
    return this.companyService.listCompanies({ buildingId, search });
  }

  /**
   * Declared before `:id` so "desk" is never read as a company id. Guards need
   * this one: it feeds the company / person pickers on the check-in form.
   */
  @Get('desk')
  @Roles('admin', 'guard')
  @ApiOperation({ summary: 'Office tenants + their people, for the desk pickers' })
  async desk(@Query('buildingId') buildingId?: string) {
    return this.companyService.deskDirectory(buildingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One company with its members' })
  async get(@Param('id') id: string) {
    return this.companyService.getCompany(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a company' })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.updateCompany(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company (deactivates it when it has accounts)' })
  async remove(@Param('id') id: string) {
    return this.companyService.deleteCompany(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Every account in the company' })
  async members(@Param('id') id: string, @Query('search') search?: string) {
    return this.companyService.listMembers(new Types.ObjectId(id), { search });
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Create the owner or an HR account for the company' })
  async addMember(@Param('id') id: string, @Body() dto: CreateCompanyMemberDto) {
    // `by: null` — an admin is not a company principal, so the company-side
    // role rules (only a boss may appoint a boss/HR) do not apply here.
    return this.companyService.createMember(
      new Types.ObjectId(id),
      dto as any,
      null,
    );
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Update a member' })
  async updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: any,
  ) {
    return this.companyService.updateMember(
      new Types.ObjectId(id),
      userId,
      dto,
      null,
    );
  }

  @Post(':id/members/:userId/password')
  @ApiOperation({ summary: 'Set or reset a member login password' })
  async setPassword(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: SetMemberPasswordDto,
  ) {
    return this.companyService.setMemberPassword(
      new Types.ObjectId(id),
      userId,
      dto.email,
      dto.password,
      null,
    );
  }

  @Post(':id/members/:userId/pass')
  @ApiOperation({ summary: 'Issue (or reissue) a member gate pass' })
  async issuePass(@Param('id') id: string, @Param('userId') userId: string) {
    return this.companyService.issuePass(new Types.ObjectId(id), userId, null);
  }

  @Delete(':id/members/:userId/pass')
  @ApiOperation({ summary: 'Revoke a member gate pass' })
  async revokePass(@Param('id') id: string, @Param('userId') userId: string) {
    return this.companyService.revokePass(new Types.ObjectId(id), userId, null);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Deactivate a member (revokes the pass, closes attendance)' })
  async deactivate(@Param('id') id: string, @Param('userId') userId: string) {
    return this.companyService.deactivateMember(
      new Types.ObjectId(id),
      userId,
      null,
    );
  }

  @Post(':id/members/:userId/reactivate')
  @ApiOperation({ summary: 'Reactivate a member' })
  async reactivate(@Param('id') id: string, @Param('userId') userId: string) {
    return this.companyService.reactivateMember(
      new Types.ObjectId(id),
      userId,
      null,
    );
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Attendance rows for the company' })
  async attendance(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.companyService.attendance(new Types.ObjectId(id), {
      userId,
      from,
      to,
      status,
    });
  }
}
