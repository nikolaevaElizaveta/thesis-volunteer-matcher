import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  shelter_task_id: string;

  @ApiProperty()
  volunteer_offer_id: string;

  @ApiPropertyOptional()
  score?: number;

  @ApiProperty({ enum: ['greedy', 'hungarian', 'max_coverage', 'bottleneck'] })
  algorithm: string;

  @ApiProperty({ enum: ['approved', 'rejected', 'pending'] })
  status: 'approved' | 'rejected' | 'pending';

  @ApiProperty()
  created_at: string;
}
