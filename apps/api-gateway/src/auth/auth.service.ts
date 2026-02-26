import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@docflow/database';
import { RegisterDto, LoginDto, AuthResponseDto, UserProfileDto } from './dto';
import {
  EmailAlreadyExistsException,
  InvalidCredentialsException,
} from './exceptions';
import type { JwtPayload } from './interfaces';

/** Number of bcrypt salt rounds — 12 is a good balance of security and speed */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * AuthService — handles user registration, login, and profile retrieval.
 *
 * Responsibilities:
 * - Password hashing and verification via bcrypt
 * - JWT token generation
 * - User creation with duplicate email check
 * - Profile lookup with existence validation
 *
 * Security considerations:
 * - login() uses timing-safe comparison (bcrypt.compare) to prevent timing attacks
 * - Error messages are intentionally vague for login failures (prevent user enumeration)
 * - Password hash is never returned in any response
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user account.
   *
   * @throws EmailAlreadyExistsException if email is already taken
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // ── Check for existing email ──────────────────────────
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
      select: ['id'],
    });

    if (existingUser) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    // ── Hash password ─────────────────────────────────────
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // ── Create user ───────────────────────────────────────
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName.trim(),
    });

    const savedUser = await this.userRepository.save(user);

    this.logger.log(`User registered: ${savedUser.id} (${savedUser.email})`);

    // ── Generate token ────────────────────────────────────
    return this.generateTokenResponse(savedUser);
  }

  /**
   * Authenticate a user with email and password.
   *
   * @throws InvalidCredentialsException if email doesn't exist or password is wrong
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // ── Find user by email ────────────────────────────────
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
      select: ['id', 'email', 'passwordHash', 'isActive'],
    });

    if (!user) {
      // Still hash to prevent timing-based user enumeration
      await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
      throw new InvalidCredentialsException();
    }

    if (!user.isActive) {
      throw new InvalidCredentialsException();
    }

    // ── Verify password ───────────────────────────────────
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    this.logger.log(`User logged in: ${user.id} (${user.email})`);

    // ── Generate token ────────────────────────────────────
    return this.generateTokenResponse(user);
  }

  /**
   * Get the profile of an authenticated user.
   *
   * @throws UnauthorizedException (via guard) if user not found
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      // This shouldn't happen normally — the JWT strategy already validates.
      // But defensive coding: if a user is deleted between token validation and here.
      this.logger.error(
        `Profile requested for non-existent user: ${userId}`,
      );
      throw new InvalidCredentialsException();
    }

    return UserProfileDto.fromEntity(user);
  }

  // ── Private Helpers ───────────────────────────────────────

  /**
   * Generate a JWT and wrap it in the standard response DTO.
   */
  private generateTokenResponse(
    user: Pick<User, 'id' | 'email'>,
  ): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const expiresIn = this.configService.get<number>('JWT_EXPIRATION', 3600);
    const accessToken = this.jwtService.sign(payload);

    return new AuthResponseDto(accessToken, expiresIn);
  }
}
