import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { MatchResultDto } from './dto/match-result.dto';
import { MatchRequestDto } from './dto/match-request.dto';
import { AssignmentsService } from '../assignments/assignments.service';
import { OffersService } from '../offers/offers.service';
import { TasksService } from '../tasks/tasks.service';
import {
  canMatchAutomatically,
  parseMatchingCutoffHours,
} from '../tasks/matching-cutoff.util';
import type { OfferDto } from '../offers/dto/offer.dto';
import type { TaskDto } from '../tasks/dto/task.dto';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);
  private readonly matcherUrl: string;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly tasksService: TasksService,
    private readonly offersService: OffersService,
    private readonly assignmentsService: AssignmentsService,
  ) {
    this.matcherUrl = this.config.get<string>('MATCHER_URL', 'http://localhost:8000');
  }

  /**
   * Run matching: load tasks and offers from DB, exclude already-approved pairs,
   * call matcher service, return matches for the remaining pool only.
   */
  async runMatch(dto: MatchRequestDto): Promise<MatchResultDto> {
    const approved = await this.assignmentsService.findAll();
    const assignedTaskIds = new Set(
      approved.filter((a) => a.status === 'approved').map((a) => a.shelter_task_id),
    );
    const assignedOfferIds = new Set(
      approved.filter((a) => a.status === 'approved').map((a) => a.volunteer_offer_id),
    );

    const allTasks = await this.tasksService.findAll();
    const allOffers = await this.offersService.findAll();
    const openTasks = allTasks.filter((t) => !assignedTaskIds.has(t.id));
    const offers = allOffers.filter((o) => !assignedOfferIds.has(o.id));

    if (openTasks.length === 0 || offers.length === 0) {
      return { matches: [] };
    }

    const cutoffH = parseMatchingCutoffHours(
      this.config.get<string>('MATCHING_CUTOFF_HOURS_BEFORE_START'),
    );
    const now = new Date();
    const tasks = openTasks.filter((t) =>
      canMatchAutomatically(
        Boolean(t.urgent),
        new Date(t.time_window.start),
        cutoffH,
        now,
      ),
    );
    const skippedDeadline = openTasks.length - tasks.length;

    if (tasks.length === 0) {
      return {
        matches: [],
        tasks_in_run: 0,
        tasks_skipped_deadline: skippedDeadline,
      };
    }

    /**
     * This prefilter reduces the matching search space using PostGIS before applying optimization algorithms.
     * Per-task: offers whose geography is within each offer's own max_distance_km (meters = km * 1000).
     * On SQL/PostGIS errors we fall back to sending the full offer list (matcher unchanged).
     */
    const filteredOffers = await this.prefilterOffersByPostgisDistance(
      tasks,
      offers,
    );

    this.logger.log(
      `Prefilter reduced offers from ${offers.length} to ${filteredOffers.length}`,
    );

    const body = {
      tasks: tasks.map((t) => ({
        id: t.id,
        location: t.location,
        required_skills: t.required_skills,
        time_window: t.time_window,
        description: t.description,
      })),
      offers: filteredOffers.map((o) => ({
        id: o.id,
        location: o.location,
        skills: o.skills,
        availability: o.availability,
        max_distance_km: o.max_distance_km,
        description: o.description,
      })),
      algorithm: dto.algorithm ?? 'greedy',
      ...(dto.metadata && { metadata: dto.metadata }),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<MatchResultDto>(`${this.matcherUrl}/match`, body, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return {
        ...response.data,
        tasks_in_run: tasks.length,
        tasks_skipped_deadline: skippedDeadline,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Matcher service error';
      throw new BadGatewayException(`Matcher unavailable: ${message}`);
    }
  }

  /**
   * Union of offer ids that lie within ST_DWithin(offer.geog, task.geog, offer.max_distance_km * 1000)
   * for at least one task in the batch. One query per task for clarity.
   */
  private async prefilterOffersByPostgisDistance(
    tasks: TaskDto[],
    offers: OfferDto[],
  ): Promise<OfferDto[]> {
    if (offers.length === 0) {
      return offers;
    }

    const offerIdList = offers.map((o) => o.id);

    try {
      const candidateIds = new Set<string>();

      for (const task of tasks) {
        const rows: { id: string }[] = await this.dataSource.query(
          `
          SELECT o.id AS id
          FROM volunteer_offers o
          INNER JOIN shelter_tasks t ON t.id = $1
          WHERE o.id = ANY($2::uuid[])
            AND ST_DWithin(o.geog, t.geog, o.max_distance_km * 1000)
          `,
          [task.id, offerIdList],
        );

        for (const row of rows) {
          if (row?.id) {
            candidateIds.add(row.id);
          }
        }
      }

      return offers.filter((o) => candidateIds.has(o.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PostGIS spatial prefilter failed; using full offer list for matcher. Reason: ${msg}`,
      );
      return offers;
    }
  }
}
