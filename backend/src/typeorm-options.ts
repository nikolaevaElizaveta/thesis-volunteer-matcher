import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Prefer DATABASE_URL (Docker / cloud). Fall back to discrete vars for local dev.
 */
export function typeOrmOptionsFromConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL')?.trim();
  const base: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize:
      config.get<string>('TYPEORM_SYNCHRONIZE', 'true').toLowerCase() ===
      'true',
  };

  if (url) {
    return { ...base, url };
  }

  return {
    ...base,
    host: config.get<string>('DATABASE_HOST', 'localhost'),
    port: config.get<number>('DATABASE_PORT', 5432),
    username: config.get<string>('DATABASE_USER', 'postgres'),
    password: config.get<string>('DATABASE_PASSWORD', ''),
    database: config.get<string>('DATABASE_NAME', 'volunteer_matcher'),
  };
}
