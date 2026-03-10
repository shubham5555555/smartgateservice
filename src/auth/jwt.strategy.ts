import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'your-secret-key-change-in-production',
      ),
    });
  }

  async validate(payload: any) {
    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    // Validate sub (user ID) - must be a valid ObjectId string, not "pending" or invalid
    let userId: string | undefined;
    if (payload.sub) {
      const subStr = String(payload.sub);
      // Check if it's a valid ObjectId format (24 hex characters) or valid string
      // Reject "pending" and other invalid values
      if (
        subStr !== 'pending' &&
        subStr.length > 0 &&
        subStr !== 'undefined' &&
        subStr !== 'null'
      ) {
        userId = subStr;
      }
    }

    return {
      userId,
      phoneNumber: payload.phoneNumber,
      email: payload.email ? String(payload.email) : undefined,
      purpose: payload.purpose ? String(payload.purpose) : undefined,
    };
  }
}
