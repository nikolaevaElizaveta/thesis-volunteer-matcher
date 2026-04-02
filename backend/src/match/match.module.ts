import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsModule } from '../assignments/assignments.module';
import { OffersModule } from '../offers/offers.module';
import { TasksModule } from '../tasks/tasks.module';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

@Module({
  imports: [
    TypeOrmModule,
    HttpModule.register({ timeout: 30000, maxRedirects: 0 }),
    TasksModule,
    OffersModule,
    AssignmentsModule,
  ],
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}
