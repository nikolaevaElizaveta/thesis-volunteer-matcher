import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

const ENV_PATH = resolve(__dirname, '../../.env');

/**
 * Load backend/.env and apply CI-friendly defaults for integration tests.
 *
 * When DATABASE_URL is set (CI or shell), discrete DATABASE_* from .env are cleared
 * so TypeORM does not accidentally connect to a different local Postgres on :5432.
 *
 * Docker demo DB:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/volunteer_matcher npm run test:e2e
 */
export function loadE2eEnvironment(): { hasDb: boolean } {
  loadEnv({ path: ENV_PATH, override: false });

  if (process.env.DATABASE_URL?.trim()) {
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_NAME;
  }

  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() ||
      (process.env.DATABASE_HOST && process.env.DATABASE_NAME),
  );

  if (hasDb) {
    process.env.SEED = process.env.SEED ?? 'true';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e_jwt_secret_at_least_8_chars';
    process.env.MATCHER_URL =
      process.env.MATCHER_URL ?? 'http://127.0.0.1:8000';
    process.env.TYPEORM_SYNCHRONIZE =
      process.env.TYPEORM_SYNCHRONIZE ?? 'true';
    // Supertest does not call GET /health; avoid flaky matcher ping in unrelated tests.
    process.env.HEALTH_CHECK_MATCHER =
      process.env.HEALTH_CHECK_MATCHER ?? 'false';
  }

  return { hasDb };
}

export async function isMatcherHealthy(
  baseUrl = process.env.MATCHER_URL ?? 'http://127.0.0.1:8000',
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return false;
    }
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}
