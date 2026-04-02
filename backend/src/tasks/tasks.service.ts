import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskDto } from './dto/task.dto';
import {
  canMatchAutomatically,
  matchingDeadlineAt,
  parseMatchingCutoffHours,
} from './matching-cutoff.util';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly repo: Repository<TaskEntity>,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateTaskDto): Promise<TaskDto> {
    const entity = this.repo.create({
      ...(dto.id && { id: dto.id }),
      lat: dto.location.lat,
      lon: dto.location.lon,
      required_skills: dto.required_skills,
      time_window_start: new Date(dto.time_window.start),
      time_window_end: new Date(dto.time_window.end),
      description: dto.description ?? null,
      address: dto.address?.trim() || null,
      owner_name: dto.owner_name?.trim() || null,
      urgent: dto.urgent === true,
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async findAll(ownerName?: string): Promise<TaskDto[]> {
    const trimmed = ownerName?.trim();
    if (!trimmed) {
      const entities = await this.repo.find({
        order: { created_at: 'ASC' },
      });
      return entities.map((e) => this.toDto(e));
    }
    // Case-insensitive match so "demo shelter" still sees seed tasks "Demo Shelter"
    const entities = await this.repo
      .createQueryBuilder('task')
      .where('LOWER(TRIM(task.owner_name)) = LOWER(:ownerName)', {
        ownerName: trimmed,
      })
      .orderBy('task.created_at', 'ASC')
      .getMany();
    return entities.map((e) => this.toDto(e));
  }

  async findOne(id: string): Promise<TaskDto> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Task ${id} not found`);
    return this.toDto(entity);
  }

  async delete(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Task ${id} not found`);
    }
  }

  /** Convert entity → DTO (API response shape) */
  private toDto(e: TaskEntity): TaskDto {
    const cutoffH = parseMatchingCutoffHours(
      this.config.get<string>('MATCHING_CUTOFF_HOURS_BEFORE_START'),
    );
    const start = e.time_window_start;
    const now = new Date();
    const urgent = Boolean(e.urgent);

    const dto = new TaskDto();
    dto.id = e.id;
    dto.location = { lat: e.lat, lon: e.lon };
    dto.required_skills = e.required_skills;
    dto.time_window = {
      start: start.toISOString(),
      end: e.time_window_end.toISOString(),
    };
    dto.description = e.description ?? undefined;
    dto.address = e.address ?? undefined;
    dto.owner_name = e.owner_name ?? undefined;
    dto.urgent = urgent;

    if (cutoffH === 0) {
      dto.matching_deadline_at = start.toISOString();
      dto.can_match_automatically = true;
    } else {
      dto.matching_deadline_at = matchingDeadlineAt(start, cutoffH).toISOString();
      dto.can_match_automatically = canMatchAutomatically(
        urgent,
        start,
        cutoffH,
        now,
      );
    }
    return dto;
  }
}
