import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuthModule } from './auth/auth.module';
import { MatchModule } from './match/match.module';
import { OffersModule } from './offers/offers.module';
import { TasksModule } from './tasks/tasks.module';
import { SeedModule } from './seed/seed.module';
import { typeOrmOptionsFromConfig } from './typeorm-options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmOptionsFromConfig(config),
    }),

    AuthModule,
    TasksModule,
    OffersModule,
    MatchModule,
    AssignmentsModule,
    /** Loads src/seed/dev-seed.json when SEED=true and DB is empty (dev/demo only). */
    SeedModule,
  ],
})
export class AppModule {}
