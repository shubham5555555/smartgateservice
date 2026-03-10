import { Injectable } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class LoggerService {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  });

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

