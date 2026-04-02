import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentEntity } from '../entities/assignment.entity';
import { AssignmentDto } from './dto/assignment.dto';
import { ApproveMatchesDto } from './dto/approve-matches.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(AssignmentEntity)
    private readonly repo: Repository<AssignmentEntity>,
  ) {}

  /**
   * Approve a batch of proposed matches. Merges with existing approved rows
   * (does not clear) so incremental matching only assigns still-free tasks/volunteers.
   * To redo everything, DELETE /assignments first.
   */
  async approve(dto: ApproveMatchesDto): Promise<AssignmentDto[]> {
    const existing = await this.repo.find({ where: { status: 'approved' } });
    const taskTaken = new Set(existing.map((e) => e.shelter_task_id));
    const offerTaken = new Set(existing.map((e) => e.volunteer_offer_id));

    for (const m of dto.matches) {
      if (taskTaken.has(m.shelter_task_id)) {
        throw new BadRequestException(
          `Task already has an approved assignment (cannot assign twice). Clear assignments first if you need to replace it.`,
        );
      }
      if (offerTaken.has(m.volunteer_offer_id)) {
        throw new BadRequestException(
          `This volunteer offer is already assigned to a task.`,
        );
      }
    }

    const entities = dto.matches.map((m) =>
      this.repo.create({
        shelter_task_id: m.shelter_task_id,
        volunteer_offer_id: m.volunteer_offer_id,
        score: m.score ?? null,
        algorithm: dto.algorithm,
        status: 'approved',
      }),
    );

    const saved = await this.repo.save(entities);
    return this.dedupeApprovedToDtos([...existing, ...saved]);
  }

  /**
   * Get approved assignments. At most one row per task and per offer (DB unique);
   * if legacy duplicates exist, keep the newest row per shelter_task_id then per volunteer_offer_id.
   */
  async findAll(): Promise<AssignmentDto[]> {
    const entities = await this.repo.find({
      where: { status: 'approved' },
      order: { created_at: 'DESC' },
    });
    return this.dedupeApprovedToDtos(entities);
  }

  /** Collapse duplicate rows (legacy) → one per task and per volunteer offer. */
  private dedupeApprovedToDtos(entities: AssignmentEntity[]): AssignmentDto[] {
    const approved = entities.filter((e) => e.status === 'approved');
    const byTask = new Map<string, AssignmentEntity>();
    for (const e of [...approved].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )) {
      if (!byTask.has(e.shelter_task_id)) byTask.set(e.shelter_task_id, e);
    }
    const stage1 = [...byTask.values()];
    const byOffer = new Map<string, AssignmentEntity>();
    for (const e of stage1.sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )) {
      if (!byOffer.has(e.volunteer_offer_id))
        byOffer.set(e.volunteer_offer_id, e);
    }
    const merged = [...byOffer.values()].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    return merged.map((e) => this.toDto(e));
  }

  /** Get assignments for a specific task. */
  async findByTask(taskId: string): Promise<AssignmentDto[]> {
    const entities = await this.repo.findBy({ shelter_task_id: taskId });
    return entities.map((e) => this.toDto(e));
  }

  /** Get assignments for a specific volunteer. */
  async findByVolunteer(offerId: string): Promise<AssignmentDto[]> {
    const entities = await this.repo.findBy({ volunteer_offer_id: offerId });
    return entities.map((e) => this.toDto(e));
  }

  /** Clear all assignments. */
  async clear(): Promise<void> {
    await this.repo.clear();
  }

  /** Convert entity → DTO */
  private toDto(e: AssignmentEntity): AssignmentDto {
    const dto = new AssignmentDto();
    dto.id = e.id;
    dto.shelter_task_id = e.shelter_task_id;
    dto.volunteer_offer_id = e.volunteer_offer_id;
    dto.score = e.score ?? undefined;
    dto.algorithm = e.algorithm;
    dto.status = e.status;
    dto.created_at = e.created_at.toISOString();
    return dto;
  }
}
