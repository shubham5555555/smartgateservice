import { Controller, Get } from '@nestjs/common';
import { register, collectDefaultMetrics } from 'prom-client';

collectDefaultMetrics();

@Controller()
export class MetricsController {
  @Get('/metrics')
  async metrics() {
    return register.metrics();
  }
}

