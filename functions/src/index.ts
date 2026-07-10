/**
 * Soteria Assurance Cloud Functions entry point.
 *
 * Re-exports every deployed function. Firebase deploys each named export as an
 * individual function, so only function handles (not helpers) are surfaced
 * here.
 *
 * @packageDocumentation
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { FIREBASE_FUNCTIONS_REGION } from '@soteria/core';

// Every function deploys to the single region clients are wired to call
// (getFunctions(app, FIREBASE_FUNCTIONS_REGION) in @soteria/firebase) — the
// shared constant keeps runtime and clients in lockstep.
setGlobalOptions({ region: FIREBASE_FUNCTIONS_REGION });

// AI co-pilot
export { draftNCR } from './ai/draftNCR';
export { suggestQuestions } from './ai/suggestQuestions';
export { analyzeEvidence } from './ai/analyzeEvidence';
export { generateReportSection } from './ai/generateReportSection';

// Auth / tenant claims
export { setTenantClaims } from './auth/setTenantClaims';

// Audit lifecycle
export { onAuditComplete } from './audit/onAuditComplete';
export { generateReport } from './audit/generateReport';

// Notifications
export { caReminders } from './notifications/caReminders';
