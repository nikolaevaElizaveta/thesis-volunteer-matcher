import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Time interval (ISO 8601). Matches matcher service schema.
 */
export class TimeWindowDto {
  @ApiProperty({ example: '2026-02-05T12:00:00', description: 'Start (ISO 8601)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, {
    message: 'start must be ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss)',
  })
  start: string;

  @ApiProperty({ example: '2026-02-05T16:00:00', description: 'End (ISO 8601)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, {
    message: 'end must be ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss)',
  })
  end: string;
}
