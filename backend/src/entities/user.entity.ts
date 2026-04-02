import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type UserRole = 'coordinator' | 'shelter' | 'volunteer';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'varchar', length: 32 })
  role: UserRole;

  /** Shown in UI; for shelters should match task owner_name in seed data */
  @Column({ type: 'varchar', length: 256 })
  display_name: string;

  @CreateDateColumn()
  created_at: Date;
}
