import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo_shelter' })
  @IsString()
  @MinLength(2)
  username: string;

  @ApiProperty({ example: 'demo123' })
  @IsString()
  @MinLength(1)
  password: string;
}
