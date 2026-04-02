import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Single availability window for a volunteer. */
export class AvailabilityWindowDto {
  @ApiProperty({ example: '2026-02-05T09:00:00' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  start: string;

  @ApiProperty({ example: '2026-02-05T18:00:00' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  end: string;
}
