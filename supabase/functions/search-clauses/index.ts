/**
 * Finds the clauses closest in meaning to what an auditor describes.
 *
 * The counterpart to the wiki's substring filter, for the case that filter
 * cannot serve: an auditor who has observed something and does not yet know
 * which requirement it bears on. The query is embedded with the same
 * `gte-small` model that built the index, then matched by cosine distance.
 *
 * Read-only and tenant-agnostic. The clause corpus is the published standard as
 * paraphrased in @soteria/core — identical for every tenant, carrying nothing
 * tenant-owned — so this needs authentication but no tenant scoping, and
 * `match_clauses` runs SECURITY INVOKER against a policy that says exactly that.
 *
 * Deliberately NOT routed through _shared/ai.ts: that wraps the Anthropic
 * co-pilot and meters it against the per-tenant hourly cap. This calls no
 * external provider and costs nothing per request, so metering it would consume
 * an auditor's AI budget for a search box.
 */
import { isStandardId } from '../../../packages/core/dist-esm/index.mjs';
import {
  HttpError,
  callerClient,
  handleRequest,
  jsonResponse,
  requireCaller,
} from '../_shared/auth.ts';

// @ts-expect-error -- Supabase.ai is provided by the Edge Runtime, not by types.
const session = new Supabase.ai.Session('gte-small');

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    // Authenticated, but any role: every role already has `view_audit_reports`,
    // and looking up what a standard requires is reading the standard.
    await requireCaller(request);

    const body = (await request.json().catch(() => ({}))) as {
      query?: unknown;
      standardId?: unknown;
      limit?: unknown;
    };

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query === '') throw new HttpError(400, '"query" is required.');
    // Long enough to be a paragraph of field notes, short enough that nobody is
    // using this as a general-purpose embedding endpoint.
    if (query.length > 2000) throw new HttpError(400, 'That query is too long.');

    const standardId = typeof body.standardId === 'string' ? body.standardId : 'iso45001';
    if (!isStandardId(standardId)) throw new HttpError(400, 'Unknown standard.');

    const limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 25) : 8;

    const embedding = await session.run(query, { mean_pool: true, normalize: true });

    // The caller's own client, not the service role: `match_clauses` is
    // SECURITY INVOKER behind a policy that grants reads to `authenticated`, and
    // routing this through the service role would bypass the very policy that
    // defines who may read the corpus.
    const { data, error } = await callerClient(request).rpc('match_clauses', {
      p_standard_id: standardId,
      p_query_embedding: JSON.stringify(embedding),
      p_match_count: limit,
    });
    if (error) {
      console.error(error);
      throw new HttpError(500, 'Could not search the clause index.');
    }

    return jsonResponse({
      standardId,
      // Empty is a real answer, not a failure: it means nothing in the corpus
      // is close enough to be worth showing, which is better than four
      // irrelevant clauses presented as if they were relevant.
      matches: data ?? [],
      model: 'gte-small',
    });
  }),
);
