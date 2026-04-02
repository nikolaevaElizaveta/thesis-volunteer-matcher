import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AvailabilityWindowDto } from '../../common/dto/availability-window.dto';
import { LocationDto } from '../../common/dto/location.dto';

export class CreateOfferDto {
  @ApiPropertyOptional({
    description:
      'ID. Omit to let the backend generate a UUID (returned in response). Use it later for GET /offers/:id. Do not send the literal "string".',
    example: undefined,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ type: () => LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ example: ['medical', 'logistics'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiProperty({
    type: [AvailabilityWindowDto],
    description:
      'Exactly one continuous availability window per offer (simpler planning for shelters and volunteers).',
    maxItems: 1,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  availability: AvailabilityWindowDto[];

  @ApiProperty({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  max_distance_km: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Display address or area name (coordinates still required in location).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;
}
