import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('IDX_shelter_tasks_geog', ['geog'], { spatial: true })
@Entity('shelter_tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lon: number;

  /** PostGIS: derived from lon/lat; GiST index for map / radius SQL. Not inserted/updated from app code. */
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    generatedType: 'STORED',
    asExpression: 'ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography',
    insert: false,
    update: false,
    select: false,
  })
  geog: string | null;

  @Column('text', { array: true })
  required_skills: string[];

  @Column('timestamp')
  time_window_start: Date;

  @Column('timestamp')
  time_window_end: Date;

  @Column('text', { nullable: true })
  description: string | null;

  /** Human-readable place (from geocoder / form); coordinates stay in lat/lon for matching. */
  @Column('varchar', { length: 512, nullable: true })
  address: string | null;

  /** Mock “shelter identity”: login name of shelter user who owns this task (coordinator may leave null). */
  @Column('varchar', { length: 256, nullable: true })
  owner_name: string | null;

  /** If true, auto-matching ignores the pre-start cutoff (last-minute / emergency). */
  @Column('boolean', { default: false })
  urgent: boolean;

  @CreateDateColumn()
  created_at: Date;
}
