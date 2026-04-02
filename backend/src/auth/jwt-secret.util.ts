import { ConfigService } from '@nestjs/config';

/** Production requires JWT_SECRET; local dev falls back to a fixed dev secret. */
export function resolveJwtSecret(config: ConfigService): string {
  const s = config.get<string>('JWT_SECRET')?.trim();
  if (s && s.length >= 8) {
    return s;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set in production (min 8 characters). Add to environment.',
    );
  }
  return 'dev_only_volunteer_matcher_jwt_secret_min8';
}
