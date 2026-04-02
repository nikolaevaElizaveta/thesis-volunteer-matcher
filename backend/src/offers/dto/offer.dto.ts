import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityWindowDto } from '../../common/dto/availability-window.dto';
import { LocationDto } from '../../common/dto/location.dto';

/** Offer entity as returned by API. Matches matcher service VolunteerOffer. */
export class OfferDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => LocationDto })
  location: LocationDto;

  @ApiProperty({ type: [String] })
  skills: string[];

  @ApiProperty({ type: [AvailabilityWindowDto] })
  availability: AvailabilityWindowDto[];

  @ApiProperty()
  max_distance_km: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Human-readable address or place label for UI.',
  })
  address?: string;
}
