import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
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
      'Coordinator: all approved assignments. Shelter/volunteer: only rows for their tasks/offers. Optional task_id or offer_id filter (role-checked).',
  })
  @ApiQuery({ name: 'task_id', required: false })
  @ApiQuery({ name: 'offer_id', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('task_id') taskId?: string,
    @Query('offer_id') offerId?: string,
  ): Promise<AssignmentDto[]> {
    if (taskId) {
      await this.service.assertCanViewTaskAssignments(user, taskId);
      return this.service.findByTask(taskId);
    }
    if (offerId) {
      await this.service.assertCanViewOfferAssignments(user, offerId);
      return this.service.findByVolunteer(offerId);
    }
    return this.service.findAllForUser(user);
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
