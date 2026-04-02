import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferEntity } from '../entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferDto } from './dto/offer.dto';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(OfferEntity)
    private readonly repo: Repository<OfferEntity>,
  ) {}

  async create(dto: CreateOfferDto): Promise<OfferDto> {
    const entity = this.repo.create({
      ...(dto.id && { id: dto.id }),
      lat: dto.location.lat,
      lon: dto.location.lon,
      skills: dto.skills,
      availability: dto.availability.map((a) => ({
        start: a.start,
        end: a.end,
      })),
      max_distance_km: dto.max_distance_km,
      description: dto.description ?? null,
      address: dto.address?.trim() || null,
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async findAll(): Promise<OfferDto[]> {
    const entities = await this.repo.find({ order: { created_at: 'ASC' } });
    return entities.map((e) => this.toDto(e));
  }

  async findOne(id: string): Promise<OfferDto> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Offer ${id} not found`);
    return this.toDto(entity);
  }

  async delete(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Offer ${id} not found`);
    }
  }

  /** Convert entity → DTO */
  private toDto(e: OfferEntity): OfferDto {
    const dto = new OfferDto();
    dto.id = e.id;
    dto.location = { lat: e.lat, lon: e.lon };
    dto.skills = e.skills;
    dto.availability = e.availability;
    dto.max_distance_km = e.max_distance_km;
    dto.description = e.description ?? undefined;
    dto.address = e.address ?? undefined;
    return dto;
  }
}
