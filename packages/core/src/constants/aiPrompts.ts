import type { MeetingSummaryRequest, NCRDraftRequest } from '../types/ai';
import { AI_DISCLAIMER } from './strings';

/**
 * The full ARIA Lead Auditor system prompt (DESIGN_DOC §10).
 *
 * This is the canonical persona used for every AI co-pilot interaction. AI
 * calls themselves happen only inside Firebase Functions — this constant is
 * pure data shared with the backend agent.
 */
export const ISO_AUDITOR_SYSTEM_PROMPT = `You are ARIA — Audit Research & Intelligence Assistant — an expert ISO 45001:2018 Lead Auditor with 20+ years of experience conducting third-party certification audits across aviation, manufacturing, oil & gas, construction, and healthcare industries. You are embedded within the Soteria Assurance audit platform.

YOUR EXPERTISE:
- Deep knowledge of ISO 45001:2018 text, intent, and application
- ISO 19011:2018 audit methodology and best practices
- OHSAS 18001 transition requirements
- Occupational health & safety risk assessment methodologies (HIRA, Bowtie, FMEA)
- Legal compliance for OH&S legislation
- Writing defensible, clear nonconformity statements
- Root cause analysis (5 Why, Fishbone, 8D)

YOUR ROLE:
- Assist lead auditors conducting ISO 45001 audits
- Generate formal finding statements from raw notes
- Suggest audit questions and follow-up probes
- Interpret ISO 45001 clause requirements in plain language
- Help identify cross-clause implications of findings
- Generate professional audit report content
- Always cite specific ISO 45001:2018 clause numbers

RESPONSE STYLE:
- Precise and professional, as expected in a certification audit context
- Cite ISO 45001:2018 clauses specifically (e.g., "Clause 6.1.2.b")
- For NCR statements, use the standard format:
  REQUIREMENT: [What the standard requires]
  FINDING: [What was observed]
  OBJECTIVE EVIDENCE: [What was seen/heard/reviewed]
- Never speculate — base findings on stated evidence only`;

/**
 * Builds the user-turn prompt for AI NCR draft generation.
 *
 * Pure and deterministic — performs no API calls.
 */
export function buildNCRPrompt(request: NCRDraftRequest): string {
  const evidenceBlock = request.evidenceDescription
    ? `\nEVIDENCE DESCRIPTION:\n${request.evidenceDescription}\n`
    : '';

  return `You are drafting a formal nonconformity statement for an ISO 45001:2018 audit.

ORGANIZATION CONTEXT:
${request.organizationContext}

CLAUSE: ${request.clauseNumber} — ${request.clauseTitle}
ISO REQUIREMENT:
${request.requirementText}

AUDITOR'S RAW NOTES:
${request.auditorRawNotes}
${evidenceBlock}
Draft a formal NCR with these sections:
1. NCR TITLE (a short descriptive title)
2. REQUIREMENT (what the standard requires)
3. FINDING (what was observed that does not conform)
4. OBJECTIVE EVIDENCE (specific evidence observed)
5. RECOMMENDED SEVERITY (Major or Minor) with justification
6. RELATED CLAUSES (other ISO 45001:2018 clauses affected)

Use precise, professional audit language. Be specific and factual. Base the finding only on the stated notes and evidence — do not speculate.

Note: ${AI_DISCLAIMER}.`;
}

/**
 * Parameters for {@link buildInterviewQuestionsPrompt}.
 */
export interface InterviewQuestionsPromptParams {
  clauseNumber: string;
  clauseTitle: string;
  intervieweeRole: string;
  industry: string;
  /** How many questions to generate (defaults to 5). */
  questionCount?: number;
  /** Optional notes from earlier in the interview to inform follow-ups. */
  previousResponses?: string;
}

/**
 * Builds the user-turn prompt for smart interview question generation.
 *
 * Pure and deterministic — performs no API calls.
 */
export function buildInterviewQuestionsPrompt(
  params: InterviewQuestionsPromptParams,
): string {
  const count = params.questionCount ?? 5;
  const priorBlock = params.previousResponses
    ? `\nPREVIOUS RESPONSES IN THIS SESSION:\n${params.previousResponses}\n`
    : '';

  return `Generate ${count} ISO 45001:2018 audit interview questions.

CLAUSE: ${params.clauseNumber} — ${params.clauseTitle}
INTERVIEWEE ROLE: ${params.intervieweeRole}
INDUSTRY: ${params.industry}
${priorBlock}
Requirements:
- Tailor each question to the interviewee's role and the industry context.
- Probe for objective evidence of conformity with the clause.
- Cite the specific ISO 45001:2018 sub-clause each question targets.
- Phrase questions as open-ended (avoid yes/no) to elicit evidence.

Return a numbered list of ${count} questions.

Note: ${AI_DISCLAIMER}.`;
}

/**
 * Builds the user-turn prompt for AI meeting summarisation (DESIGN_DOC §9.2 /
 * §9.6). Produces three clearly-labelled sections that
 * {@link parseMeetingSummaryText} (in the backend) can parse deterministically.
 *
 * Pure and deterministic — performs no API calls.
 */
export function buildMeetingSummaryPrompt(request: MeetingSummaryRequest): string {
  const meeting = request.meetingType === 'opening' ? 'opening' : 'closing';
  const contextBlock = request.auditContext
    ? `AUDIT CONTEXT: ${request.auditContext}\n`
    : '';

  return `Summarise the following ISO 45001:2018 audit ${meeting} meeting from its transcription.

${contextBlock}TRANSCRIPTION:
${request.transcription}

Produce exactly these three labelled sections:
1. SUMMARY (a concise professional summary of what was discussed and agreed)
2. KEY DECISIONS (the decisions reached — one per line; "None" if there were none)
3. ACTION ITEMS (one per line as "description — owner"; use "Unassigned" when no owner was named; "None" if there were none)

Base everything strictly on the transcription. Do not invent attendees, decisions, or actions that were not stated.

Note: ${AI_DISCLAIMER}.`;
}
