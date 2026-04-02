import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MatchResultDto } from './dto/match-result.dto';
import { MatchRequestDto } from './dto/match-request.dto';
import { MatchService } from './match.service';

const MATCH_EXAMPLE = {
  algorithm: 'greedy' as const,
  metadata: { experiment_id: 'test_01' },
};

@ApiTags('match')
@ApiBearerAuth()
@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coordinator')
  @ApiOperation({
    summary: 'Run matching',
    description:
      'Coordinator only. Loads tasks and offers from DB, calls matcher (greedy / hungarian / max_coverage / bottleneck).',
  })
  @ApiBody({
    type: MatchRequestDto,
    examples: { default: { summary: 'Ready to run', value: MATCH_EXAMPLE } },
  })
  async runMatch(@Body() dto: MatchRequestDto): Promise<MatchResultDto> {
    return this.matchService.runMatch(dto);
  }
}
