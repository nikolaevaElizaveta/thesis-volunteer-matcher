import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import type { UserRole } from '../../entities/user.entity';

const REGISTER_ROLES: UserRole[] = ['shelter', 'volunteer'];

export class RegisterDto {
  @ApiProperty({ example: 'my_shelter' })
  @IsString()
  @MinLength(2)
  username: string;

  @ApiProperty({ example: 'securepass123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Demo Shelter', description: 'Shown in UI / task ownership for shelters' })
  @IsString()
  @MinLength(1)
  display_name: string;

  @ApiProperty({ enum: REGISTER_ROLES })
  @IsIn(REGISTER_ROLES)
  role: 'shelter' | 'volunteer';
}
