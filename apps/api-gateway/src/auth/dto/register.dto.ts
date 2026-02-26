import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for user registration.
 *
 * Validated by the global ValidationPipe (whitelist + forbidNonWhitelisted).
 * Password constraints: 8–128 chars — we don't enforce complexity rules here
 * because bcrypt handles any string, and overly strict rules reduce usability.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(1, { message: 'Full name must be at least 1 character long' })
  @MaxLength(255, { message: 'Full name must be at most 255 characters long' })
  fullName!: string;
}
