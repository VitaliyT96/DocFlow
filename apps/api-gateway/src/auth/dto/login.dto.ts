import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for user login.
 *
 * Minimal validation — we only check that both fields are present.
 * Credential verification happens in AuthService to keep error messages
 * intentionally vague (prevent user enumeration).
 */
export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}
