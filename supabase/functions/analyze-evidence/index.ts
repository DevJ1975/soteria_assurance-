/**
 * Analyses a captured evidence photo for visible OH&S hazards.
 *
 * The image is fetched server-side from its private bucket rather than
 * accepted in the request body: the client already proved who it is with its
 * JWT, and re-uploading megabytes of image it has already stored — through a
 * function that could then be handed any image at all — buys nothing. The
 * evidence row is read first, so the object is always one this tenant owns.
 */
import {
  buildAuditorSystemPrompt,
  isStandardId,
} from '../../../packages/core/dist-esm/index.mjs';
import { HttpError, handleRequest, jsonResponse } from '../_shared/auth.ts';
import { AI_DISCLAIMER, beginAICall, CLAUDE_MODEL, completeStructured } from '../_shared/ai.ts';

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'string',
      description: 'What is visible in the image, in professional audit language.',
    },
    hazards: {
      type: 'array',
      items: { type: 'string' },
      description: 'Distinct hazards visible in the image. Empty if none are visible.',
    },
    suggestedClauses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Clause numbers of the standard this evidence bears on.',
    },
  },
  required: ['analysis', 'hazards', 'suggestedClauses'],
  additionalProperties: false,
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Base64 without blowing the stack on a multi-megabyte photo. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const context = await beginAICall(request, body.tenantId);

    const standardId = typeof body.standardId === 'string' ? body.standardId : 'iso45001';
    if (!isStandardId(standardId)) throw new HttpError(400, 'Unknown standard.');

    const evidenceId = typeof body.evidenceId === 'string' ? body.evidenceId.trim() : '';
    if (evidenceId === '') throw new HttpError(400, '"evidenceId" is required.');

    // Scoped to the caller's tenant, so an id from another tenant resolves to
    // nothing rather than to someone else's photograph.
    const { data: evidence, error } = await context.admin
      .from('evidence')
      .select('id, tenant_id, storage_bucket, storage_path, mime_type, title, description')
      .eq('id', evidenceId)
      .eq('tenant_id', context.tenantId)
      .maybeSingle();
    if (error) throw new HttpError(500, 'Could not load that evidence.');
    if (!evidence) throw new HttpError(404, 'That evidence does not exist.');
    if (!evidence.storage_path) {
      throw new HttpError(409, 'That evidence has no stored file to analyse.');
    }
    if (!SUPPORTED_IMAGE_TYPES.has(evidence.mime_type)) {
      throw new HttpError(415, `${evidence.mime_type} cannot be analysed as an image.`);
    }

    const { data: file, error: downloadError } = await context.admin.storage
      .from(evidence.storage_bucket ?? 'evidence')
      .download(evidence.storage_path);
    if (downloadError || !file) {
      console.error(downloadError);
      throw new HttpError(502, 'The evidence file could not be read.');
    }

    const base64 = toBase64(new Uint8Array(await file.arrayBuffer()));

    const described = [evidence.title, evidence.description].filter(Boolean).join(' — ');
    const prompt = `Analyse this audit evidence photograph.

${described ? `AUDITOR'S LABEL: ${described}\n` : ''}
Describe only what is visible. Identify hazards that are actually shown, and say
so plainly when none are. Do not infer conditions outside the frame, and do not
speculate about management-system arrangements that a photograph cannot show.

Note: ${AI_DISCLAIMER}.`;

    const result = await completeStructured(context, {
      feature: 'analyze-evidence',
      system: buildAuditorSystemPrompt(standardId),
      prompt,
      schema: ANALYSIS_SCHEMA,
      contentBefore: [
        {
          type: 'image',
          source: { type: 'base64', media_type: evidence.mime_type, data: base64 },
        },
      ],
    });

    return jsonResponse({ ...result, disclaimer: AI_DISCLAIMER, model: CLAUDE_MODEL });
  }),
);
