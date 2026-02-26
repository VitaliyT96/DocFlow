import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@docflow/database';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule — encapsulates all authentication concerns.
 *
 * Provides:
 * - JWT token generation and verification
 * - Passport JWT strategy for route protection
 * - REST endpoints for register/login/profile
 *
 * Exports JwtAuthGuard and CurrentUser decorator for use in other modules
 * via the barrel index.ts — no need to import AuthModule in other feature
 * modules, just import the guard/decorator directly.
 *
 * The JwtStrategy is registered here but works globally via Passport —
 * any module can use @UseGuards(JwtAuthGuard) without importing AuthModule.
 */
@Module({
  imports: [
    // Make User repository available for JwtStrategy and AuthService
    TypeOrmModule.forFeature([User]),

    // Passport with JWT as default strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT configuration from environment variables
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is not defined. Check your .env file.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<number>('JWT_EXPIRATION', 3600),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
