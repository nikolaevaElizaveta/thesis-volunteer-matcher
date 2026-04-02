import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — returns JWT (use Authorization: Bearer <token>)' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register shelter or volunteer (coordinators are seeded only)',
  })
  @ApiBody({ type: RegisterDto })
  async register(@Body() dto: RegisterDto): Promise<LoginResponseDto> {
    return this.auth.register(dto);
  }
}
