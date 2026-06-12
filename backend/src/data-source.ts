import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { OfferEntity } from './entities/offer.entity';
import { AssignmentEntity } from './entities/assignment.entity';
import { UserEntity } from './entities/user.entity';
import { AddPostgisGeographyColumns1738867200000 } from './migrations/1738867200000-AddPostgisGeographyColumns';
import { AddAddressToTasksAndOffers1740000000000 } from './migrations/1740000000000-AddAddressToTasksAndOffers';
import { AddUrgentToTasks1740100000000 } from './migrations/1740100000000-AddUrgentToTasks';
import { AssignmentUniqueApproved1740200000000 } from './migrations/1740200000000-AssignmentUniqueApproved';

config({ path: resolve(__dirname, '../.env') });

const rawUrl = process.env.DATABASE_URL?.trim();

/** Render external Postgres requires TLS; append sslmode if missing. */
function postgresUrlWithSsl(url: string): string {
  if (/[?&]sslmode=/.test(url)) {
    return url;
  }
  const needsSsl =
    url.includes('render.com') || process.env.DATABASE_SSL === 'true';
  if (!needsSsl) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}sslmode=require`;
}

const url = rawUrl ? postgresUrlWithSsl(rawUrl) : undefined;
const useSsl =
  !!url &&
  (process.env.DATABASE_SSL === 'true' ||
    rawUrl?.includes('render.com') ||
    /[?&]sslmode=require/.test(url));

export default new DataSource({
  type: 'postgres',
  ...(url
    ? { url, ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}) }
    : {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
        username: process.env.DATABASE_USER ?? 'postgres',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_NAME ?? 'volunteer_matcher',
      }),
  entities: [TaskEntity, OfferEntity, AssignmentEntity, UserEntity],
  migrations: [
    AddPostgisGeographyColumns1738867200000,
    AddAddressToTasksAndOffers1740000000000,
    AddUrgentToTasks1740100000000,
    AssignmentUniqueApproved1740200000000,
  ],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
