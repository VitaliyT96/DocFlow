import { User } from '@docflow/database';

/**
 * Public user profile data — never includes passwordHash.
 *
 * Uses a static factory method to enforce that we always map
 * from the entity explicitly, preventing accidental data leaks.
 */
export class UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: Date;

  private constructor(
    id: string,
    email: string,
    fullName: string,
    isActive: boolean,
    createdAt: Date,
  ) {
    this.id = id;
    this.email = email;
    this.fullName = fullName;
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  /**
   * Create a UserProfileDto from a User entity.
   * This is the ONLY way to construct this DTO — ensures passwordHash is never leaked.
   */
  static fromEntity(user: User): UserProfileDto {
    return new UserProfileDto(
      user.id,
      user.email,
      user.fullName,
      user.isActive,
      user.createdAt,
    );
  }
}
