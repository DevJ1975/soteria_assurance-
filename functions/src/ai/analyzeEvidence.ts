/**
 * `analyzeEvidence` callable — multimodal analysis of a workplace-safety photo
 * (DESIGN_DOC §10 "Photo Analysis").
 *
 * The image is provided as base64 (the client/storage layer is responsible for
 * fetching the Storage object and encoding it). The structured analysis is
 * returned in `aiAnalysis` shape and NEVER written directly onto the
 * auditor-confirmed evidence record by this function.
 *
 * Same guard / rate-limit / log pattern as the other AI callables.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { AI_DISCLAIMER, ISO_AUDITOR_SYSTEM_PROMPT } from '@soteria/core';
import { ANTHROPIC_API_KEY } from '../common/secrets';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';
import { enforceRateLimit } from './rateLimiter';
import { writeAiLog } from './aiLog';
import { callClaude, CLAUDE_MODEL, type ClaudeContentBlock } from './anthropicClient';
import { extractClauseReferences } from './parseNCR';

/** Media types accepted by the multimodal endpoint. */
export type SupportedImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Wire payload for `analyzeEvidence`. */
export interface AnalyzeEvidencePayload {
  tenantId: string;
  /** Base64-encoded image bytes (no data: URI prefix). */
  imageBase64: string;
  mediaType: SupportedImageMediaType;
  /** Optional auditor-supplied context about where the photo was taken. */
  contextDescription?: string;
}

/** Structured photo-analysis result (auditor-unconfirmed). */
export interface EvidenceAnalysis {
  /** Plain description of what the image shows. */
  description: string;
  /** OH&S hazards visible in the image. */
  hazardsDetected: string[];
  /** Potential ISO 45001 clause violations referenced by the model. */
  potentialClauseViolations: string[];
  /** Suggested audit finding text, if the model deemed one warranted. */
  suggestedFinding: string;
  /** Full raw model text for auditor review. */
  raw: string;
}

/** Successful response. */
export interface AnalyzeEvidenceResult {
  aiAnalysis: EvidenceAnalysis;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/** The fixed §10 photo-analysis instruction appended after any auditor note. */
const PHOTO_ANALYSIS_PROMPT = `Analyze this workplace safety photo. Identify, using clearly labelled sections:
1. DESCRIPTION (what the image shows)
2. HAZARDS (any OH&S hazards visible — one per line)
3. POTENTIAL CLAUSE VIOLATIONS (specific ISO 45001:2018 clause numbers that may be implicated)
4. SUGGESTED FINDING (a draft audit finding if warranted, otherwise "None")

Base your analysis only on what is visible. Do not speculate beyond the image.

Note: ${AI_DISCLAIMER}.`;

/**
 * Pure parser for the labelled photo-analysis text. Exported for testing.
 */
export function parseEvidenceAnalysis(raw: string): EvidenceAnalysis {
  const text = raw.trim();
  const section = (label: string): string => {
    const headings = ['DESCRIPTION', 'HAZARDS', 'POTENTIAL CLAUSE VIOLATIONS', 'SUGGESTED FINDING'];
    const others = headings.filter((h) => h !== label).join('|');
    const pattern = new RegExp(
      `(?:^|\\n)\\s*\\d*\\.?\\s*${label}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*\\d*\\.?\\s*(?:${others})\\s*[:\\-]|$)`,
      'i',
    );
    const m = pattern.exec(text);
    return m && m[1] ? m[1].trim() : '';
  };

  const hazardsRaw = section('HAZARDS');
  const hazardsDetected = hazardsRaw
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 0 && !/^none$/i.test(l));

  const violationsRaw = section('POTENTIAL CLAUSE VIOLATIONS');
  const suggestedFinding = section('SUGGESTED FINDING');

  return {
    description: section('DESCRIPTION'),
    hazardsDetected,
    potentialClauseViolations: extractClauseReferences(violationsRaw),
    suggestedFinding: /^none$/i.test(suggestedFinding) ? '' : suggestedFinding,
    raw: text,
  };
}

function assertPayload(data: unknown): AnalyzeEvidencePayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['tenantId'] !== 'string' || (d['tenantId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantId.');
  }
  if (typeof d['imageBase64'] !== 'string' || (d['imageBase64'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: imageBase64.');
  }
  const mediaType = d['mediaType'];
  if (
    typeof mediaType !== 'string' ||
    !(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mediaType)
  ) {
    throw new HttpsError('invalid-argument', 'Unsupported or missing mediaType.');
  }
  return {
    tenantId: d['tenantId'] as string,
    imageBase64: d['imageBase64'] as string,
    mediaType: mediaType as SupportedImageMediaType,
    ...(typeof d['contextDescription'] === 'string'
      ? { contextDescription: d['contextDescription'] }
      : {}),
  };
}

/** Core handler, exported for unit testing. */
export async function handleAnalyzeEvidence(
  request: CallableRequest<unknown>,
): Promise<AnalyzeEvidenceResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'ai_copilot');

  const db = getDb();
  await enforceRateLimit(db, payload.tenantId);

  const promptText = payload.contextDescription
    ? `AUDITOR CONTEXT: ${payload.contextDescription}\n\n${PHOTO_ANALYSIS_PROMPT}`
    : PHOTO_ANALYSIS_PROMPT;

  const content: ClaudeContentBlock[] = [
    {
      type: 'image',
      source: { type: 'base64', media_type: payload.mediaType, data: payload.imageBase64 },
    },
    { type: 'text', text: promptText },
  ];

  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, content, { maxTokens: 1024 });

  if (!result.ok) {
    await writeAiLog(db, payload.tenantId, {
      feature: 'analyze_evidence',
      uid: auth.uid,
      model: CLAUDE_MODEL,
      status: 'error',
      errorMessage: result.error,
    });
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  await writeAiLog(db, payload.tenantId, {
    feature: 'analyze_evidence',
    uid: auth.uid,
    model: result.model,
    status: 'success',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    aiAnalysis: parseEvidenceAnalysis(result.text),
    disclaimer: AI_DISCLAIMER,
    model: result.model,
  };
}

/** Callable export. */
export const analyzeEvidence = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  handleAnalyzeEvidence,
);
