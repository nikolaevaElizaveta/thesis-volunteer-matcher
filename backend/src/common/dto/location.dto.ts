import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

/**
 * Geo point (WGS84). Matches matcher service schema.
 */
export class LocationDto {
  @ApiProperty({ example: 59.9, description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 30.3, description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}
