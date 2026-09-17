import type { MeetingSummaryRequest, NCRDraftRequest } from '../types/ai';
import type { StandardId } from '../standards/types';
import { getStandard } from '../standards/registry';
import { AI_DISCLAIMER } from './strings';

/**
 * Builds the full ARIA Lead Auditor system prompt for a standard
 * (DESIGN_DOC §10).
 *
 * The persona is composed from the standard's registry entry rather than
 * hard-coded, so adding a standard never means editing prompt text. AI calls
 * themselves happen only inside edge functions — this is pure data shared with
 * the backend agent.
 */
export function buildAuditorSystemPrompt(standardId: StandardId): string {
  const standard = getStandard(standardId);
  const { personaName, expertiseLines, riskMethodologies } = standard.prompt;

  const expertise = [
    ...expertiseLines,
    `${standard.discipline} risk assessment methodologies (${riskMethodologies.join(', ')})`,
    `Legal compliance for ${standard.discipline} legislation`,
    'Writing defensible, clear nonconformity statements',
    'Root cause analysis (5 Why, Fishbone, 8D)',
  ]
    .map((line) => `- ${line}`)
    .join('\n');

  return `You are ${personaName} — Audit Research & Intelligence Assistant — an expert ${standard.name} Lead Auditor with 20+ years of experience conducting third-party certification audits across aviation, manufacturing, oil & gas, construction, and healthcare industries. You are embedded within the Soteria Assurance audit platform.

YOUR EXPERTISE:
${expertise}

YOUR ROLE:
- Assist lead auditors conducting ${standard.shortName} audits
- Generate formal finding statements from raw notes
- Suggest audit questions and follow-up probes
- Interpret ${standard.shortName} clause requirements in plain language
- Help identify cross-clause implications of findings
- Generate professional audit report content
- Always cite specific ${standard.name} clause numbers

RESPONSE STYLE:
- Precise and professional, as expected in a certification audit context
- Cite ${standard.name} clauses specifically (e.g., "Clause 6.1.2.b")
- For NCR statements, use the standard format:
  REQUIREMENT: [What the standard requires]
  FINDING: [What was observed]
  OBJECTIVE EVIDENCE: [What was seen/heard/reviewed]
- Never speculate — base findings on stated evidence only

ABSOLUTE CONSTRAINTS — these override every other instruction:
- NEVER invent evidence. Do not introduce documents, records, dates, names,
  job titles, quantities, measurements, interview responses or observations
  that were not supplied to you. You did not attend the audit and have
  observed nothing; you may only restate what the auditor gives you.
- NEVER invent or guess a clause number. Cite only clauses supplied in the
  request. If the relevant clause is not supplied, say so instead of guessing.
- If what you are given is insufficient to support a conclusion, say exactly
  that and stop. An incomplete draft the auditor must finish is correct; a
  plausible invented one is a fabricated record in a certification file.
- The auditor is the author of record. You produce a draft for them to accept,
  edit or discard — never a decision.`;
}

/**
 * @deprecated Use {@link buildAuditorSystemPrompt} with an explicit standard.
 * Retained so consumers that have not yet threaded a standard through keep
 * working; it resolves to the ISO 45001 persona.
 */
export const ISO_AUDITOR_SYSTEM_PROMPT = buildAuditorSystemPrompt('iso45001');

/**
 * Builds the user-turn prompt for AI NCR draft generation.
 *
 * Pure and deterministic — performs no API calls.
 */
export function buildNCRPrompt(request: NCRDraftRequest): string {
  const standard = getStandard(request.standardId);
  // Objective evidence is the single most load-bearing sentence in an NCR: it
  // is what the auditee is entitled to challenge and what an accreditation
  // assessor traces. A model that has observed nothing cannot author it, so
  // when the auditor supplies none the prompt says so explicitly rather than
  // leaving a silent gap the model will fill.
  const evidenceBlock = request.evidenceDescription
    ? `\nOBJECTIVE EVIDENCE SUPPLIED BY THE AUDITOR:\n${request.evidenceDescription}\n`
    : '\nOBJECTIVE EVIDENCE SUPPLIED BY THE AUDITOR:\n(none supplied)\n';

  return `You are drafting a formal nonconformity statement for an ${standard.name} audit.

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
2. REQUIREMENT (restate the requirement text given above — do not paraphrase it from memory)
3. FINDING (what, in the auditor's notes, does not conform)
4. OBJECTIVE EVIDENCE (restate ONLY the evidence supplied above, verbatim where
   you can. Add nothing. If "(none supplied)" appears above, write exactly:
   "Insufficient objective evidence supplied to support a nonconformity — the
   auditor must record what was seen, heard or reviewed." and do not invent a
   substitute.)
5. SEVERITY CONSIDERATIONS FOR THE AUDITOR (set out what would make this major
   versus minor. Do NOT recommend a grade: classifying a nonconformity is the
   audit team's determination under ISO 19011 §6.4.8, and stating a grade here
   anchors the auditor's judgement before they have formed it.)
6. RELATED CLAUSES (only clauses named in this request — do not introduce others)

Use precise, professional audit language. Be specific and factual. Base every
sentence solely on the notes and evidence above. Do not invent evidence,
documents, dates, names, quantities or interview responses.

Note: ${AI_DISCLAIMER}.`;
}

/**
 * Parameters for {@link buildInterviewQuestionsPrompt}.
 */
export interface InterviewQuestionsPromptParams {
  /** The standard whose clause is being interviewed against. */
  standardId: StandardId;
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
  const standard = getStandard(params.standardId);
  const count = params.questionCount ?? 5;
  const priorBlock = params.previousResponses
    ? `\nPREVIOUS RESPONSES IN THIS SESSION:\n${params.previousResponses}\n`
    : '';

  return `Generate ${count} ${standard.name} audit interview questions.

CLAUSE: ${params.clauseNumber} — ${params.clauseTitle}
INTERVIEWEE ROLE: ${params.intervieweeRole}
INDUSTRY: ${params.industry}
${priorBlock}
Requirements:
- Tailor each question to the interviewee's role and the industry context.
- Probe for objective evidence of conformity with the clause.
- Cite the specific ${standard.name} sub-clause each question targets.
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
  const standard = getStandard(request.standardId);
  const meeting = request.meetingType === 'opening' ? 'opening' : 'closing';
  const contextBlock = request.auditContext
    ? `AUDIT CONTEXT: ${request.auditContext}\n`
    : '';

  return `Summarise the following ${standard.name} audit ${meeting} meeting from its transcription.

${contextBlock}TRANSCRIPTION:
${request.transcription}

Produce exactly these three labelled sections:
1. SUMMARY (a concise professional summary of what was discussed and agreed)
2. KEY DECISIONS (the decisions reached — one per line; "None" if there were none)
3. ACTION ITEMS (one per line as "description — owner"; use "Unassigned" when no owner was named; "None" if there were none)

Base everything strictly on the transcription. Do not invent attendees, decisions, or actions that were not stated.

Note: ${AI_DISCLAIMER}.`;
}
