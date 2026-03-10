import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

@Injectable()
export class LoggerService {
  private readonly logger: pino.Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = pino({
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      ...(this.configService.get<string>('NODE_ENV') !== 'production' && {
        transport: { target: 'pino-pretty' },
      }),
    });
  }

  info(message: string, meta?: any) {
    this.logger.info(meta || {}, message);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(meta || {}, message);
  }

  error(message: string, meta?: any) {
    this.logger.error(meta || {}, message);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(meta || {}, message);
  }
}

