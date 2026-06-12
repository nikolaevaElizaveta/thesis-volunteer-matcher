import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthReadiness, HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Readiness check (no auth)',
    description:
      'Returns 200 when PostgreSQL and matcher (if enabled) are reachable; 503 otherwise.',
  })
  async health(): Promise<HealthReadiness> {
    const result = await this.healthService.checkReadiness();
    if (!result.ready) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
