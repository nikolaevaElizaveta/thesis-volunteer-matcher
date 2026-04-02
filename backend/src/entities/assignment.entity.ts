import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { OfferEntity } from './offer.entity';

@Entity('assignments')
export class AssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  shelter_task_id: string;

  @Column('uuid')
  volunteer_offer_id: string;

  @Column('double precision', { nullable: true })
  score: number | null;

  @Column('varchar', { length: 32 })
  algorithm: string;

  @Column('varchar', { length: 16, default: 'approved' })
  status: 'approved' | 'rejected' | 'pending';

  @CreateDateColumn()
  created_at: Date;

  /* ---- Relations (optional, for JOIN support) ---- */

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shelter_task_id' })
  task: TaskEntity;

  @ManyToOne(() => OfferEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_offer_id' })
  offer: OfferEntity;
}
