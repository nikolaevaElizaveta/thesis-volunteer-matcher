import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../../entities/user.entity';

export class AuthUserDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  display_name: string;

  @ApiProperty({ enum: ['coordinator', 'shelter', 'volunteer'] })
  role: UserRole;
}

export class LoginResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
