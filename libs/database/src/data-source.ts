import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { ProcessingJob } from './entities/processing-job.entity';
import { Annotation } from './entities/annotation.entity';

/**
 * Load env vars from the project root .env file.
 * Supports both running from libs/database/ and from project root.
 */
config({ path: join(__dirname, '../../../.env') });
config({ path: join(__dirname, '../../.env') });

/**
 * TypeORM DataSource configuration for CLI-driven migrations.
 *
 * This file is used by:
 * - `typeorm migration:generate` — generates migration files from entity diffs
 * - `typeorm migration:run` — applies pending migrations
 * - `typeorm migration:revert` — reverts the last applied migration
 *
 * It reads database credentials from environment variables with sensible
 * dev defaults. In production, these MUST be overridden.
 */
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  username: process.env['POSTGRES_USER'] || 'docflow',
  password: process.env['POSTGRES_PASSWORD'] || 'docflow_secret',
  database: process.env['POSTGRES_DB'] || 'docflow',
  entities: [User, Document, ProcessingJob, Annotation],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: process.env['NODE_ENV'] !== 'production',
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
