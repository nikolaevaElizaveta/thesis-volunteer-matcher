import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationDto } from '../../common/dto/location.dto';
import { TimeWindowDto } from '../../common/dto/time-window.dto';

/** Task entity as returned by API. Matches matcher service ShelterTask. */
export class TaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => LocationDto })
  location: LocationDto;

  @ApiProperty({ type: [String] })
  required_skills: string[];

  @ApiProperty({ type: () => TimeWindowDto })
  time_window: TimeWindowDto;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Human-readable address or place label for UI.',
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Shelter owner display name (mock tenancy); null if created by coordinator without owner.',
  })
  owner_name?: string;

  @ApiPropertyOptional({
    description:
      'Bypass auto-matching deadline (last-minute / emergency). Coordinator or shelter can set when creating.',
  })
  urgent?: boolean;

  @ApiProperty({
    description:
      'ISO instant: auto-matching stops after this time (unless urgent). Derived from time_window.start and server cutoff hours.',
  })
  matching_deadline_at: string;

  @ApiProperty({
    description:
      'Whether this task is included in automatic matching right now.',
  })
  can_match_automatically: boolean;
}
