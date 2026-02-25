import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { ProcessingJob } from './entities/processing-job.entity';
import { Annotation } from './entities/annotation.entity';

/** All entity classes registered in this database library */
const ENTITIES = [User, Document, ProcessingJob, Annotation] as const;

/**
 * DatabaseModule — registers all TypeORM entity repositories.
 *
 * Import this module in both api-gateway and worker to get access
 * to the entity repositories via dependency injection.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [DatabaseModule.forFeature()],
 * })
 * export class SomeFeatureModule {}
 * ```
 */
@Module({})
export class DatabaseModule {
  /**
   * Registers all entity repositories for injection.
   * Uses TypeOrmModule.forFeature under the hood.
   */
  static forFeature(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forFeature([...ENTITIES])],
      exports: [TypeOrmModule],
    };
  }

  /**
   * Returns the array of all entity classes.
   * Useful for passing to TypeOrmModule.forRoot({ entities }).
   */
  static get entities(): ReadonlyArray<Function> {
    return ENTITIES;
  }
}
