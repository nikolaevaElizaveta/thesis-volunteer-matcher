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

config({ path: resolve(__dirname, '../.env') });

const url = process.env.DATABASE_URL?.trim();

export default new DataSource({
  type: 'postgres',
  ...(url
    ? { url }
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
  ],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
