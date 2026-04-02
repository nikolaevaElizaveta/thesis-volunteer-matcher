import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '../entities/user.entity';
import { resolveJwtSecret } from './jwt-secret.util';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  displayName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.sub || !payload?.username || !payload?.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
