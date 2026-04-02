import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({
      where: { username: username.trim().toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    };
  }

  async register(dto: RegisterDto) {
    const username = dto.username.trim().toLowerCase();
    const exists = await this.usersRepo.exist({ where: { username } });
    if (exists) {
      throw new ConflictException('Username already taken');
    }
    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      username,
      password_hash,
      role: dto.role,
      display_name: dto.display_name.trim(),
    });
    await this.usersRepo.save(user);
    return this.login({ username, password: dto.password });
  }
}
