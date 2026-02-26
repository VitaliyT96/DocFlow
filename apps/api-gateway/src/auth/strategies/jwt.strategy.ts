import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@docflow/database';
import type { JwtPayload, RequestUser } from '../interfaces';

/**
 * JWT Strategy — validates Bearer tokens on protected routes.
 *
 * Flow:
 * 1. Passport extracts JWT from Authorization header
 * 2. @nestjs/jwt verifies signature and expiry
 * 3. validate() is called with the decoded payload
 * 4. We verify the user still exists and is active
 * 5. Returns RequestUser which is attached to request.user
 *
 * Why we re-check the database on every request:
 * - User could be deactivated after token was issued
 * - User could be deleted after token was issued
 * - Tokens are stateless, so we need this check for security
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET is not defined in environment variables. ' +
          'This is a critical configuration error — the application cannot start without it.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called after JWT signature is verified.
   * Must return the user data to be attached to request.user,
   * or throw to reject the request.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'isActive'],
    });

    if (!user) {
      this.logger.warn(
        `JWT validation failed: user ${payload.sub} not found`,
      );
      throw new UnauthorizedException('User no longer exists');
    }

    if (!user.isActive) {
      this.logger.warn(
        `JWT validation failed: user ${payload.sub} is deactivated`,
      );
      throw new UnauthorizedException('User account is deactivated');
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }
}
