import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

const TASK_EXAMPLE = {
  location: { lat: 59.9, lon: 30.3 },
  required_skills: ['medical'],
  time_window: { start: '2026-02-10T12:00:00', end: '2026-02-10T16:00:00' },
  description: 'Need medical help',
};

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coordinator', 'shelter')
  @ApiOperation({ summary: 'Create a shelter task' })
  @ApiBody({
    type: CreateTaskDto,
    examples: { default: { summary: 'Ready to run (id auto-generated)', value: TASK_EXAMPLE } },
  })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskDto> {
    if (user.role === 'shelter') {
      dto.owner_name = user.displayName;
    }
    return this.tasksService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all tasks (or filter by shelter)',
    description:
      '**Coordinator / volunteer:** optional `owner_name` filter. **Shelter:** always sees only own tasks (server-enforced from JWT).',
  })
  @ApiQuery({
    name: 'owner_name',
    required: false,
    description: 'Coordinator/volunteer only: filter by shelter display name (case-insensitive).',
    example: '',
    allowEmptyValue: true,
  })
  async findAll(
    @Query('owner_name') ownerName: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskDto[]> {
    if (user.role === 'shelter') {
      return this.tasksService.findAll(user.displayName);
    }
    return this.tasksService.findAll(ownerName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by id' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskDto> {
    const t = await this.tasksService.findOne(id);
    if (user.role === 'shelter') {
      const own =
        t.owner_name &&
        t.owner_name.trim().toLowerCase() === user.displayName.trim().toLowerCase();
      if (!own) {
        throw new ForbiddenException('Not your task');
      }
    }
    return t;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete task (coordinator or owning shelter)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    if (user.role === 'coordinator') {
      return this.tasksService.delete(id);
    }
    if (user.role === 'shelter') {
      const t = await this.tasksService.findOne(id);
      const own =
        t.owner_name &&
        t.owner_name.trim().toLowerCase() === user.displayName.trim().toLowerCase();
      if (!own) {
        throw new ForbiddenException('Not your task');
      }
      return this.tasksService.delete(id);
    }
    throw new ForbiddenException();
  }
}
