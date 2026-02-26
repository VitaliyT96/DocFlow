import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, UserProfileDto } from './dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser } from './decorators';
import type { RequestUser } from './interfaces';

/**
 * AuthController — REST endpoints for authentication.
 *
 * Routes:
 * - POST /auth/register  → Create a new user account (public)
 * - POST /auth/login     → Authenticate and receive JWT (public)
 * - GET  /auth/me        → Get current user profile (protected)
 *
 * Why REST instead of GraphQL:
 * - Auth is a cross-cutting concern, not a domain query
 * - Simpler token exchange flow for clients
 * - Avoids exposing sensitive operations via GraphQL introspection
 * - Compatible with HTTP-only cookie auth if needed later
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user.
   *
   * @returns 201 Created with access token
   * @throws 409 Conflict if email already exists
   * @throws 400 Bad Request if validation fails
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * Login with email and password.
   *
   * @returns 200 OK with access token
   * @throws 401 Unauthorized if credentials are invalid
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * Get the authenticated user's profile.
   *
   * @returns 200 OK with user profile (no passwordHash)
   * @throws 401 Unauthorized if token is missing/invalid/expired
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @CurrentUser() user: RequestUser,
  ): Promise<UserProfileDto> {
    return this.authService.getProfile(user.userId);
  }
}
