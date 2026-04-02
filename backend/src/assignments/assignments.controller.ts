import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignmentsService } from './assignments.service';
import { AssignmentDto } from './dto/assignment.dto';
import { ApproveMatchesDto } from './dto/approve-matches.dto';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coordinator')
  @ApiOperation({
    summary: 'Approve matching results',
    description:
      'Coordinator only. Merges proposed pairs into approved assignments.',
  })
  async approve(@Body() dto: ApproveMatchesDto): Promise<AssignmentDto[]> {
    return this.service.approve(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List assignments',
    description:
      'Get all assignments, optionally filtered by task_id or offer_id.',
  })
  @ApiQuery({ name: 'task_id', required: false })
  @ApiQuery({ name: 'offer_id', required: false })
  async findAll(
    @Query('task_id') taskId?: string,
    @Query('offer_id') offerId?: string,
  ): Promise<AssignmentDto[]> {
    if (taskId) return this.service.findByTask(taskId);
    if (offerId) return this.service.findByVolunteer(offerId);
    return this.service.findAll();
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles('coordinator')
  @ApiOperation({ summary: 'Clear all assignments (coordinator only)' })
  async clear(): Promise<{ message: string }> {
    await this.service.clear();
    return { message: 'All assignments cleared' };
  }
}
