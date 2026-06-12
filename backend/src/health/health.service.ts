import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';

export type DependencyStatus = 'ok' | 'error' | 'skipped';

export interface HealthReadiness {
  status: 'ok' | 'degraded';
  database: DependencyStatus;
  matcher: DependencyStatus;
  ready: boolean;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async checkReadiness(): Promise<HealthReadiness> {
    const database = await this.checkDatabase();
    const matcher = await this.checkMatcher();

    const ready =
      database === 'ok' && (matcher === 'ok' || matcher === 'skipped');

    return {
      status: ready ? 'ok' : 'degraded',
      database,
      matcher,
      ready,
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Database health check failed: ${msg}`);
      return 'error';
    }
  }

  private async checkMatcher(): Promise<DependencyStatus> {
    const enabled =
      (this.config.get<string>('HEALTH_CHECK_MATCHER') ?? 'true').toLowerCase() !==
      'false';
    if (!enabled) {
      return 'skipped';
    }

    const base = this.config.get<string>('MATCHER_URL', 'http://localhost:8000');
    const url = `${base.replace(/\/$/, '')}/health`;

    try {
      const resp = await firstValueFrom(
        this.httpService.get<{ status?: string }>(url, { timeout: 5000 }),
      );
      return resp.data?.status === 'ok' ? 'ok' : 'error';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Matcher health check failed (${url}): ${msg}`);
      return 'error';
    }
  }
}
