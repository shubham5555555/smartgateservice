import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { PayMaintenanceDto } from './dto/pay-maintenance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('current-dues')
  async getCurrentDues(@Request() req) {
    return this.maintenanceService.getCurrentDues(req.user.userId);
  }

  @Get('payment-history')
  async getPaymentHistory(@Request() req) {
    return this.maintenanceService.getPaymentHistory(req.user.userId);
  }

  @Get('total-due')
  async getTotalAmountDue(@Request() req) {
    const total = await this.maintenanceService.getTotalAmountDue(req.user.userId);
    return { totalAmountDue: total };
  }

  @Post('pay')
  async payMaintenance(@Request() req, @Body() payDto: PayMaintenanceDto) {
    return this.maintenanceService.payMaintenance(
      req.user.userId,
      payDto.maintenanceIds,
      payDto.paymentMethod,
      payDto.transactionId,
    );
  }

  @Get('payment-details/:id')
  async getPaymentDetails(@Request() req, @Param('id') id: string) {
    return this.maintenanceService.getPaymentDetails(req.user.userId, id);
  }
}
