import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('IDX_volunteer_offers_geog', ['geog'], { spatial: true })
@Entity('volunteer_offers')
export class OfferEntity {
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
  skills: string[];

  /** Array of { start: string, end: string } windows, stored as JSONB. */
  @Column('jsonb')
  availability: { start: string; end: string }[];

  @Column('double precision')
  max_distance_km: number;

  @Column('text', { nullable: true })
  description: string | null;

  /** Human-readable place (from geocoder / form). */
  @Column('varchar', { length: 512, nullable: true })
  address: string | null;

  @CreateDateColumn()
  created_at: Date;
}
