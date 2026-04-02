import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from '../../common/dto/location.dto';
import { TimeWindowDto } from '../../common/dto/time-window.dto';

export class CreateTaskDto {
  @ApiPropertyOptional({
    description:
      'ID. Omit to let the backend generate a UUID (returned in response). Use it later for GET /tasks/:id. Do not send the literal "string".',
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
  @MinLength(1, { each: true })
  required_skills: string[];

  @ApiProperty({ type: () => TimeWindowDto })
  @ValidateNested()
  @Type(() => TimeWindowDto)
  time_window: TimeWindowDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Display address or place name (coordinates still required in location).',
    example: 'Kazan, ul. Pushkina 10',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Shelter login name that owns this task (prototype). Shelters should send their display name; coordinator may omit.',
  })
  @IsOptional()
  @IsString()
  owner_name?: string;

  @ApiPropertyOptional({
    description:
      'If true, task stays in auto-matching even inside the usual pre-start cutoff window.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  urgent?: boolean;
}
