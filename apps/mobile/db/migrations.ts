/**
 * WatermelonDB schema migrations.
 *
 * Empty for v1 (the initial schema), but wired into the adapter so future
 * schema bumps have a home and existing field-audit databases upgrade in place
 * rather than being wiped (which would lose un-synced offline work).
 */
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Example for the next version:
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({ table: 'findings', columns: [{ name: 'witness_id', type: 'string', isOptional: true }] }),
    //   ],
    // },
  ],
});
