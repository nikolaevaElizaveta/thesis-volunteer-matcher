import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferEntity } from '../entities/offer.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([OfferEntity])],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
