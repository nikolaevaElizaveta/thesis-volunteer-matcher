import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentEntity } from '../entities/assignment.entity';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([AssignmentEntity])],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
