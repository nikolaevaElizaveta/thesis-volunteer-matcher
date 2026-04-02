import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../entities/task.entity';
import { OfferEntity } from '../entities/offer.entity';
import { UserEntity } from '../entities/user.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, OfferEntity, UserEntity])],
  providers: [SeedService],
})
export class SeedModule {}
