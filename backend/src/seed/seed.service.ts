import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';
import { OfferEntity } from '../entities/offer.entity';
import { UserEntity } from '../entities/user.entity';

interface SeedTask {
  location: { lat: number; lon: number };
  required_skills: string[];
  time_window: { start: string; end: string };
  description?: string;
  owner_name?: string;
  address?: string;
}

interface SeedOffer {
  location: { lat: number; lon: number };
  skills: string[];
  availability: { start: string; end: string }[];
  max_distance_km: number;
  description?: string;
  address?: string;
}

interface SeedFile {
  tasks: SeedTask[];
  offers: SeedOffer[];
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TaskEntity)
    private readonly tasksRepo: Repository<TaskEntity>,
    @InjectRepository(OfferEntity)
    private readonly offersRepo: Repository<OfferEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Docker Compose sets process.env; ConfigService also reads .env if present — merge both.
    const raw =
      this.config.get<string | undefined>('SEED') ?? process.env.SEED ?? 'false';
    const flag = String(raw).trim().toLowerCase();
    if (flag !== 'true' && flag !== '1') {
      this.logger.log(
        `Dev seed skipped: SEED is "${raw}" (set SEED=true in root .env for docker compose, or backend/.env for local npm).`,
      );
      return;
    }

    await this.seedDemoUsersIfEmpty();

    const [taskCount, offerCount] = await Promise.all([
      this.tasksRepo.count(),
      this.offersRepo.count(),
    ]);

    if (taskCount > 0 || offerCount > 0) {
      this.logger.log(
        `SEED=true but database already has data (${taskCount} tasks, ${offerCount} offers) — skipping task/offer JSON seed. Clear both tables or use docker compose down -v for a fresh DB.`,
      );
      return;
    }

    const jsonPath = join(__dirname, 'dev-seed.json');
    if (!existsSync(jsonPath)) {
      this.logger.warn(
        `Seed file not found at ${jsonPath} — skipping. (Ensure nest-cli copies seed/*.json to dist/seed/.)`,
      );
      return;
    }

    let data: SeedFile;
    try {
      data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as SeedFile;
    } catch (e) {
      this.logger.error(
        `Failed to parse dev-seed.json: ${e instanceof Error ? e.message : e}`,
      );
      return;
    }

    if (!Array.isArray(data.tasks) || !Array.isArray(data.offers)) {
      this.logger.error('dev-seed.json must have "tasks" and "offers" arrays.');
      return;
    }

    const enriched = await this.appendGeneratedSeedData(data);

    for (const t of enriched.tasks) {
      await this.tasksRepo.save(
        this.tasksRepo.create({
          lat: t.location.lat,
          lon: t.location.lon,
          required_skills: t.required_skills,
          time_window_start: new Date(t.time_window.start),
          time_window_end: new Date(t.time_window.end),
          description: t.description ?? null,
          address: t.address?.trim() || null,
          owner_name: t.owner_name?.trim() || null,
        }),
      );
    }

    for (const o of enriched.offers) {
      await this.offersRepo.save(
        this.offersRepo.create({
          lat: o.location.lat,
          lon: o.location.lon,
          skills: o.skills,
          availability: o.availability,
          max_distance_km: o.max_distance_km,
          description: o.description ?? null,
          address: o.address?.trim() || null,
        }),
      );
    }

    this.logger.log(
      `Dev seed applied: ${enriched.tasks.length} tasks, ${enriched.offers.length} offers (base + generated).`,
    );
  }

  /**
   * Augment base JSON seed with extra shelter tasks + volunteer offers from seeded users.
   * The first block of tasks is intentionally aligned with generated offers so a reasonable
   * share of rows is matchable under normal skill/time/distance constraints.
   */
  private async appendGeneratedSeedData(base: SeedFile): Promise<SeedFile> {
    const users = await this.usersRepo.find({
      select: ['role', 'display_name'],
      order: { display_name: 'ASC' },
    });
    const shelters = users
      .filter((u) => u.role === 'shelter')
      .map((u) => u.display_name)
      .filter((n): n is string => Boolean(n));
    const volunteers = users
      .filter((u) => u.role === 'volunteer')
      .map((u) => u.display_name)
      .filter((n): n is string => Boolean(n));

    // If users are not available for some reason, keep the base seed untouched.
    if (shelters.length === 0 || volunteers.length === 0) {
      return base;
    }

    const skillPool = ['medical', 'logistics', 'first_aid', 'water', 'shelter', 'food'];
    const clusterA = { lat: 59.94, lon: 30.30 };
    const clusterB = { lat: 59.98, lon: 30.36 };
    const now = new Date();
    const baseStart = new Date(now.getTime() + 1000 * 60 * 60 * 48); // +48h

    const generatedOffers: SeedOffer[] = volunteers.map((name, i) => {
      const c = i % 5 === 0 ? clusterB : clusterA;
      const lat = c.lat + ((i % 7) - 3) * 0.003;
      const lon = c.lon + ((i % 9) - 4) * 0.003;
      const wStart = new Date(baseStart.getTime() + (i % 6) * 60 * 60 * 1000);
      const wEnd = new Date(wStart.getTime() + 8 * 60 * 60 * 1000);
      return {
        location: { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) },
        skills: [
          skillPool[i % skillPool.length],
          skillPool[(i + 1) % skillPool.length],
          skillPool[(i + 3) % skillPool.length],
        ],
        availability: [
          {
            start: wStart.toISOString(),
            end: wEnd.toISOString(),
          },
        ],
        max_distance_km: 20,
        description: name,
        address: `Seed volunteer area ${i % 2 === 0 ? 'A' : 'B'}`,
      };
    });

    // 3 tasks per shelter (minimum 24), with a guaranteed-match segment tied to offers.
    const desiredTasks = Math.max(24, shelters.length * 3);
    const generatedTasks: SeedTask[] = [];
    for (let i = 0; i < desiredTasks; i++) {
      const owner = shelters[i % shelters.length];
      const anchorOffer = generatedOffers[i % generatedOffers.length];
      const guaranteed = i < generatedOffers.length;

      const tStart = new Date(baseStart.getTime() + (i % 6) * 60 * 60 * 1000 + 30 * 60 * 1000);
      const tEnd = new Date(tStart.getTime() + 3 * 60 * 60 * 1000);
      const required = guaranteed
        ? [anchorOffer.skills[0]]
        : [skillPool[(i + 2) % skillPool.length], skillPool[(i + 4) % skillPool.length]].slice(
            0,
            (i % 3 === 0 ? 2 : 1),
          );

      const latJitter = guaranteed ? ((i % 5) - 2) * 0.002 : ((i % 11) - 5) * 0.005;
      const lonJitter = guaranteed ? ((i % 7) - 3) * 0.002 : ((i % 13) - 6) * 0.005;

      generatedTasks.push({
        location: {
          lat: Number((anchorOffer.location.lat + latJitter).toFixed(6)),
          lon: Number((anchorOffer.location.lon + lonJitter).toFixed(6)),
        },
        required_skills: required,
        time_window: {
          start: tStart.toISOString(),
          end: tEnd.toISOString(),
        },
        description: `Seed task #${i + 1}`,
        owner_name: owner,
        address: `Seed shelter area ${i % 2 === 0 ? 'A' : 'B'}`,
      });
    }

    // Add a small deterministic "challenge" block to provoke min-sum vs min-max behavior.
    // Time windows make the feasible graph sparse, while distances create a trade-off.
    const challengeSkill = 'challenge_match';
    const shelterOwner = shelters[0];
    const volunteerA = volunteers[0];
    const volunteerB = volunteers[Math.min(1, volunteers.length - 1)];
    const volunteerC = volunteers[Math.min(2, volunteers.length - 1)];

    const baseLon = 30.0;
    const lat = 59.95;
    const d40 = 0.72; // ~40 km around this latitude
    const d80 = 1.44; // ~80 km

    const cStart = new Date(baseStart.getTime() + 12 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString();

    generatedOffers.push(
      {
        // O1
        location: { lat, lon: Number((baseLon).toFixed(6)) },
        skills: [challengeSkill, 'logistics', 'food'],
        availability: [{ start: iso(cStart), end: iso(new Date(cStart.getTime() + 10 * 60 * 60 * 1000)) }],
        max_distance_km: 120,
        description: volunteerA,
        address: 'Challenge zone O1',
      },
      {
        // O2
        location: { lat, lon: Number((baseLon + d40).toFixed(6)) },
        skills: [challengeSkill, 'medical', 'water'],
        availability: [{ start: iso(cStart), end: iso(new Date(cStart.getTime() + 10 * 60 * 60 * 1000)) }],
        max_distance_km: 120,
        description: volunteerB,
        address: 'Challenge zone O2',
      },
      {
        // O3
        location: { lat, lon: Number((baseLon + d80).toFixed(6)) },
        skills: [challengeSkill, 'first_aid', 'shelter'],
        availability: [{ start: iso(cStart), end: iso(new Date(cStart.getTime() + 10 * 60 * 60 * 1000)) }],
        max_distance_km: 120,
        description: volunteerC,
        address: 'Challenge zone O3',
      },
    );

    generatedTasks.push(
      {
        // T1: feasible with O1/O2 only (time overlap with O1,O2)
        location: { lat, lon: Number((baseLon).toFixed(6)) },
        required_skills: [challengeSkill],
        time_window: {
          start: iso(new Date(cStart.getTime() + 0 * 60 * 60 * 1000)),
          end: iso(new Date(cStart.getTime() + 4 * 60 * 60 * 1000)),
        },
        description: 'Challenge task T1',
        owner_name: shelterOwner,
        address: 'Challenge task area T1',
      },
      {
        // T2: feasible with O2/O3 only
        location: { lat, lon: Number((baseLon + d40).toFixed(6)) },
        required_skills: [challengeSkill],
        time_window: {
          start: iso(new Date(cStart.getTime() + 3 * 60 * 60 * 1000)),
          end: iso(new Date(cStart.getTime() + 7 * 60 * 60 * 1000)),
        },
        description: 'Challenge task T2',
        owner_name: shelterOwner,
        address: 'Challenge task area T2',
      },
      {
        // T3: feasible with O1/O3 only, located near O1
        location: { lat, lon: Number((baseLon).toFixed(6)) },
        required_skills: [challengeSkill],
        time_window: {
          start: iso(new Date(cStart.getTime() + 6 * 60 * 60 * 1000)),
          end: iso(new Date(cStart.getTime() + 10 * 60 * 60 * 1000)),
        },
        description: 'Challenge task T3',
        owner_name: shelterOwner,
        address: 'Challenge task area T3',
      },
    );

    return {
      tasks: [...base.tasks, ...generatedTasks],
      offers: [...base.offers, ...generatedOffers],
    };
  }

  /** Demo logins — password for all: demo123 */
  private async seedDemoUsersIfEmpty(): Promise<void> {
    const n = await this.usersRepo.count();
    if (n > 0) {
      return;
    }
    const rounds = 10;
    const pwd = 'demo123';
    const rows: Pick<
      UserEntity,
      'username' | 'password_hash' | 'role' | 'display_name'
    >[] = [
      {
        username: 'coordinator',
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'coordinator',
        display_name: 'Coordinator',
      },
      {
        username: 'demo_shelter',
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'shelter',
        display_name: 'Demo Shelter',
      },
      {
        username: 'demo_volunteer_alex',
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'volunteer',
        display_name: 'Demo Volunteer Alex',
      },
      {
        username: 'demo_volunteer_sam',
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'volunteer',
        display_name: 'Demo Volunteer Sam',
      },
    ];

    // Extra seed users (not shown in login quick-picks) to start with a richer pool.
    // Useful for local demos when DB is empty before first backend start.
    const extraShelters = 8;
    const extraVolunteers = 24;

    for (let i = 1; i <= extraShelters; i++) {
      const idx = String(i).padStart(2, '0');
      rows.push({
        username: `seed_shelter_${idx}`,
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'shelter',
        display_name: `Seed Shelter ${idx}`,
      });
    }

    for (let i = 1; i <= extraVolunteers; i++) {
      const idx = String(i).padStart(2, '0');
      rows.push({
        username: `seed_volunteer_${idx}`,
        password_hash: await bcrypt.hash(pwd, rounds),
        role: 'volunteer',
        display_name: `Seed Volunteer ${idx}`,
      });
    }

    for (const r of rows) {
      await this.usersRepo.save(this.usersRepo.create(r));
    }
    this.logger.log(
      `Seed users created for empty DB: coordinator=1, shelters=${1 + extraShelters}, volunteers=${2 + extraVolunteers}.`,
    );
  }
}
