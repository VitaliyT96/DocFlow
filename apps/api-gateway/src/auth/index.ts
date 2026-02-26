// ── Module ──────────────────────────────────────────────────
export { AuthModule } from './auth.module';

// ── Guards (for use in other feature modules) ───────────────
export { JwtAuthGuard } from './guards';

// ── Decorators (for use in other feature modules) ───────────
export { CurrentUser } from './decorators';

// ── Interfaces (for typing in other feature modules) ────────
export type {
  JwtPayload,
  RequestUser,
  AuthenticatedRequest,
} from './interfaces';

// ── DTOs (for reuse if needed) ──────────────────────────────
export { UserProfileDto } from './dto';
