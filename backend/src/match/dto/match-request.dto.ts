import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class MatchRequestDto {
  @ApiPropertyOptional({
    enum: ['greedy', 'hungarian', 'max_coverage', 'bottleneck'],
    default: 'greedy',
  })
  @IsOptional()
  @IsEnum(['greedy', 'hungarian', 'max_coverage', 'bottleneck'])
  algorithm?: 'greedy' | 'hungarian' | 'max_coverage' | 'bottleneck' = 'greedy';

  @ApiPropertyOptional({ description: 'Optional metadata for logging/experiments' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
