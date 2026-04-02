import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MatchItemDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiProperty()
  shelter_task_id: string;

  @ApiProperty()
  volunteer_offer_id: string;

  @ApiPropertyOptional()
  score?: number;
}

export class MatchResultDto {
  @ApiProperty({ type: [MatchItemDto] })
  matches: MatchItemDto[];

  @ApiPropertyOptional({
    description:
      'Tasks actually sent to the matcher (after auto-matching deadline filter).',
  })
  tasks_in_run?: number;

  @ApiPropertyOptional({
    description:
      'Open tasks excluded: auto-matching closed (past deadline, not urgent).',
  })
  tasks_skipped_deadline?: number;
}
