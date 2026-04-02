import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MatchItemInput {
  @ApiProperty()
  @IsString()
  shelter_task_id: string;

  @ApiProperty()
  @IsString()
  volunteer_offer_id: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  score?: number;
}

export class ApproveMatchesDto {
  @ApiProperty({ type: [MatchItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchItemInput)
  matches: MatchItemInput[];

  @ApiProperty({ enum: ['greedy', 'hungarian', 'max_coverage', 'bottleneck'] })
  @IsEnum(['greedy', 'hungarian', 'max_coverage', 'bottleneck'])
  algorithm: 'greedy' | 'hungarian' | 'max_coverage' | 'bottleneck';
}
