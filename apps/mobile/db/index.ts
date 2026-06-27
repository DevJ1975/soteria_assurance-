/**
 * WatermelonDB database singleton for the Soteria field-audit app.
 *
 * Wires the {@link mySchema} + {@link migrations} to the SQLite adapter and
 * registers every model class. The instance is created once and shared via the
 * `DatabaseProvider` mounted at the router root (`app/_layout.tsx`).
 *
 * JSI mode is enabled for the synchronous, high-throughput access pattern a
 * field audit needs (rapid evidence capture + clause edits while offline).
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import { migrations } from './migrations';
import { Audit } from './models/Audit';
import { ClauseAssessment } from './models/ClauseAssessment';
import { Finding } from './models/Finding';
import { Evidence } from './models/Evidence';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
  // Stable on-disk database name; survives app restarts so offline work persists.
  dbName: 'soteria_assurance',
  jsi: true,
  onSetUpError: (error: Error): void => {
    // A schema/adapter setup failure is fatal for offline work — surface it so
    // the error boundary can offer recovery rather than silently corrupting.
    // eslint-disable-next-line no-console -- intentional fatal-path diagnostic
    console.error('[WatermelonDB] adapter setup failed', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Audit, ClauseAssessment, Finding, Evidence],
});

export { Audit, ClauseAssessment, Finding, Evidence };
export type { SyncStatus } from './schema';
export type { UploadStatus } from './models/Evidence';
