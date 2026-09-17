/**
 * Builds the vector index over the clause corpus, one bounded batch per call.
 *
 * The corpus lives in @soteria/core, not in Postgres — `standards/<id>/clauses.ts`
 * is the single source of truth and this reads the same ESM bundle every other
 * AI function imports. So indexing is a derivation, not a data entry step: run
 * it after the clause dataset changes and the index matches again.
 *
 * Embeddings come from Supabase's built-in `gte-small` model running inside the
 * Edge Runtime. No API key, no third-party call, and the clause text never
 * leaves the project.
 *
 * WHY THIS IS BATCHED RATHER THAN ONE CALL
 * Embedding all 56 ISO 45001 clauses in a single request exceeds the Edge
 * Runtime's per-request CPU budget — locally it fails with "CPU time hard limit
 * reached: request has been cancelled by supervisor", and that ceiling exists on
 * hosted Supabase too, so a version that happened to fit locally would still
 * fail in production. Each call embeds a slice and returns the next offset;
 * the caller drives the loop (see callIndexClauses in lib/supabase-functions.ts).
 *
 * Superadmin-only: it rewrites reference data every tenant reads.
 */
import {
  flattenClauses,
  isStandardId,
} from '../../../packages/core/dist-esm/index.mjs';
import {
  HttpError,
  handleRequest,
  jsonResponse,
  requireCaller,
  serviceClient,
} from '../_shared/auth.ts';

interface StandardClause {
  number: string;
  title: string;
  requirementText: string;
  auditFocus: string[];
  typicalAuditQuestions: string[];
  commonNonconformities: string[];
}

/**
 * Clauses embedded per request.
 *
 * Eight sits well inside the CPU budget with margin for a cold isolate, which
 * is the case that actually fails — a warm one manages far more. Raising this
 * trades a shorter rebuild for a rebuild that breaks on hosted under load.
 */
const DEFAULT_BATCH_SIZE = 8;
const MAX_BATCH_SIZE = 16;

/**
 * The text that actually gets embedded.
 *
 * Deliberately more than the requirement sentence. An auditor searches with
 * what they observed, and what they observed resembles a `commonNonconformity`
 * or an `auditFocus` item far more than it resembles the formal requirement
 * wording — folding those in is what makes "induction records stop after 2024"
 * find the competence clause.
 */
function embeddableText(clause: StandardClause): string {
  return [
    `Clause ${clause.number}: ${clause.title}`,
    clause.requirementText,
    clause.auditFocus.join('. '),
    clause.typicalAuditQuestions.join(' '),
    clause.commonNonconformities.join('. '),
  ]
    .filter((part) => part.trim() !== '')
    .join('\n');
}

// @ts-expect-error -- Supabase.ai is provided by the Edge Runtime, not by types.
const session = new Supabase.ai.Session('gte-small');

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const caller = await requireCaller(request);
    if (caller.role !== 'super_admin') {
      throw new HttpError(403, 'Only a platform administrator can rebuild the clause index.');
    }

    const body = (await request.json().catch(() => ({}))) as {
      standardId?: unknown;
      offset?: unknown;
      batchSize?: unknown;
    };

    const standardId = typeof body.standardId === 'string' ? body.standardId : 'iso45001';
    if (!isStandardId(standardId)) throw new HttpError(400, 'Unknown standard.');

    const offset =
      typeof body.offset === 'number' && Number.isInteger(body.offset) && body.offset >= 0
        ? body.offset
        : 0;
    const batchSize =
      typeof body.batchSize === 'number'
        ? Math.min(Math.max(Math.trunc(body.batchSize), 1), MAX_BATCH_SIZE)
        : DEFAULT_BATCH_SIZE;

    const clauses = flattenClauses(standardId) as StandardClause[];
    const total = clauses.length;
    const slice = clauses.slice(offset, offset + batchSize);

    // A standard with no clause data yet (a roadmap placeholder) yields nothing
    // to index, which is an answer rather than an error.
    if (slice.length === 0) {
      return jsonResponse({
        standardId,
        total,
        processed: 0,
        nextOffset: null,
        model: 'gte-small',
        dimensions: 384,
      });
    }

    const rows = [];
    for (const clause of slice) {
      const content = embeddableText(clause);
      const embedding = await session.run(content, { mean_pool: true, normalize: true });
      rows.push({
        standard_id: standardId,
        clause_number: clause.number,
        clause_title: clause.title,
        content,
        embedding,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await serviceClient()
      .from('clause_embeddings')
      .upsert(rows, { onConflict: 'standard_id,clause_number' });
    if (error) {
      console.error(error);
      throw new HttpError(500, 'Could not write the clause index.');
    }

    const nextOffset = offset + slice.length;
    return jsonResponse({
      standardId,
      total,
      processed: slice.length,
      // Null means done. The caller loops until it sees this rather than
      // computing the end itself, so the batch size stays a server concern.
      nextOffset: nextOffset < total ? nextOffset : null,
      model: 'gte-small',
      dimensions: 384,
    });
  }),
);
