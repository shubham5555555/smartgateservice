import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../tenancy/roles.guard';
import { Roles } from '../tenancy/roles.decorator';
import { CompanyService } from './company.service';
import { CreateEmployeeDto, SetMemberPasswordDto } from './dto/member.dto';
import { InviteVisitorDto } from './dto/invite-visitor.dto';

/**
 * The office tenant's own surface, used from the user app by a boss, HR or an
 * employee. Every route is confined to the caller's company by the tenant
 * layer; the role rules (who may create whom) live in the service.
 */
@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('me')
  @ApiOperation({ summary: 'My company, my role, my pass — drives the app shell' })
  async me(@Request() req) {
    return this.companyService.me(req.user);
  }

  // ------------------------------------------------------------ the team

  @Get('employees')
  @Roles('company_manager')
  @ApiOperation({ summary: 'The team (owner / HR only)' })
  async employees(
    @Request() req,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.listMembers(p.companyId, { search, role, status });
  }

  @Post('employees')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Add an employee' })
  async addEmployee(@Request() req, @Body() dto: CreateEmployeeDto) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.createMember(p.companyId, dto as any, p);
  }

  @Get('employees/:id')
  @Roles('company_manager')
  @ApiOperation({ summary: 'One employee' })
  async employee(@Request() req, @Param('id') id: string) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.getMember(p.companyId, id);
  }

  @Patch('employees/:id')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Update an employee' })
  async updateEmployee(@Request() req, @Param('id') id: string, @Body() dto: any) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.updateMember(p.companyId, id, dto, p);
  }

  @Post('employees/:id/password')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Set the employee login email and password' })
  async setPassword(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SetMemberPasswordDto,
  ) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.setMemberPassword(
      p.companyId,
      id,
      dto.email,
      dto.password,
      p,
    );
  }

  @Post('employees/:id/pass')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Issue or reissue the employee gate pass' })
  async issuePass(@Request() req, @Param('id') id: string) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.issuePass(p.companyId, id, p);
  }

  @Delete('employees/:id/pass')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Revoke the employee gate pass' })
  async revokePass(@Request() req, @Param('id') id: string) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.revokePass(p.companyId, id, p);
  }

  @Delete('employees/:id')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Deactivate an employee (revokes pass, closes attendance)' })
  async deactivate(@Request() req, @Param('id') id: string) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.deactivateMember(p.companyId, id, p);
  }

  @Post('employees/:id/reactivate')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Reactivate an employee' })
  async reactivate(@Request() req, @Param('id') id: string) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.reactivateMember(p.companyId, id, p);
  }

  // --------------------------------------------------------------- pass

  @Get('pass')
  @ApiOperation({ summary: 'My gate pass: QR payload, short code and today\'s status' })
  async myPass(@Request() req) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.myPass(p);
  }

  // --------------------------------------------------------- attendance

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance — mine, or the team\'s for an owner / HR' })
  async attendance(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const p = await this.companyService.principal(req.user);
    const manager = p.companyRole === 'boss' || p.companyRole === 'hr';
    return this.companyService.attendance(p.companyId, {
      // An employee only ever sees their own days, whatever they ask for.
      userId: manager ? userId : p.userId,
      from,
      to,
      status,
    });
  }

  @Get('inside')
  @Roles('company_manager')
  @ApiOperation({ summary: 'Who from the company is in the building right now' })
  async inside(@Request() req) {
    const p = await this.companyService.principal(req.user);
    return this.companyService.insideNow(p.companyId);
  }

  // ----------------------------------------------------------- visitors

  @Post('visitors')
  @ApiOperation({ summary: 'Invite a visitor to meet me' })
  async invite(@Request() req, @Body() dto: InviteVisitorDto) {
    return this.companyService.inviteVisitor(req.user, dto);
  }

  @Get('visitors')
  @ApiOperation({ summary: 'My visitors, or the company\'s for an owner / HR' })
  async visitors(
    @Request() req,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
  ) {
    return this.companyService.visitors(req.user, scope, status);
  }
}
