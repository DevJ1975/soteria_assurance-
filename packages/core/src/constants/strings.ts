/**
 * Centralised user-facing copy for Soteria Assurance.
 *
 * SOTERIA RULE 4 — every user-facing string lives here (no hardcoded UI
 * strings in components). This enables future i18n.
 */

/**
 * Mandatory disclaimer shown alongside any AI-generated content
 * (multi-agent-guide §8).
 */
export const AI_DISCLAIMER = 'AI-generated — auditor must review and approve' as const;

export const SoteriaStrings = {
  common: {
    appName: 'Soteria Assurance',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    loading: 'Loading…',
    search: 'Search',
    retry: 'Retry',
    syncing: 'Syncing…',
    synced: 'All changes saved',
    offline: 'Offline — changes saved locally',
  },
  auth: {
    signInTitle: 'Sign in to Soteria Assurance',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    signInButton: 'Sign in',
    signOutButton: 'Sign out',
    forgotPassword: 'Forgot your password?',
    invalidCredentials: 'The email or password you entered is incorrect.',
    sessionExpired: 'Your session has expired. Please sign in again.',
  },
  audit: {
    listTitle: 'Audits',
    newAudit: 'New audit',
    auditNumberLabel: 'Audit number',
    scopeLabel: 'Scope of the OH&S management system',
    leadAuditorLabel: 'Lead auditor',
    plannedDatesLabel: 'Planned dates',
    statusLabel: 'Status',
    startAudit: 'Start audit',
    completeAudit: 'Complete audit',
    certificationReadiness: 'Certification readiness',
    noAudits: 'No audits yet. Create your first audit to get started.',
    downloadPdf: 'Download PDF',
    generatingPdf: 'Generating report…',
    reportFailed: 'Could not generate the report. Please try again.',
  },
  clauses: {
    navigatorTitle: 'Clause navigator',
    conformityLabel: 'Conformity',
    scoreLabel: 'Score',
    notesLabel: 'Auditor notes',
    markComplete: 'Mark clause complete',
    notAudited: 'Not audited',
  },
  findings: {
    listTitle: 'Findings',
    newFinding: 'New finding',
    typeLabel: 'Finding type',
    severityLabel: 'Severity',
    clauseLabel: 'ISO 45001 clause',
    titleLabel: 'Finding title',
    objectiveEvidenceLabel: 'Objective evidence',
    statementLabel: 'Nonconformity statement',
    targetClosureLabel: 'Target closure date',
    raiseFinding: 'Raise finding',
    acknowledgeFinding: 'Acknowledge finding',
    closeFinding: 'Close finding',
    overdue: 'Overdue',
    noFindings: 'No findings recorded for this audit.',
  },
  evidence: {
    listTitle: 'Evidence',
    capturePhoto: 'Capture photo',
    attachFile: 'Attach file',
    descriptionLabel: 'Description',
    linkedClausesLabel: 'Linked clauses',
    verify: 'Verify evidence',
    verified: 'Verified',
    noEvidence: 'No evidence captured yet.',
  },
  meetings: {
    openingTitle: 'Opening meeting',
    closingTitle: 'Closing meeting',
    attendeesLabel: 'Attendees',
    agendaLabel: 'Agenda',
    startMeeting: 'Start meeting',
    endMeeting: 'End meeting',
    captureSignature: 'Capture signature',
    actionItemsLabel: 'Action items',
    summarize: 'Summarize meeting',
    summaryLabel: 'AI summary',
    keyDecisionsLabel: 'Key decisions',
  },
  correctiveActions: {
    listTitle: 'Corrective actions',
    newCorrectiveAction: 'New corrective action',
    rootCauseLabel: 'Root cause analysis',
    immediateActionLabel: 'Immediate (containment) action',
    correctiveActionLabel: 'Corrective action',
    preventiveActionLabel: 'Preventive action',
    effectivenessCheckLabel: 'Effectiveness check',
    targetDateLabel: 'Target completion date',
    responsiblePersonLabel: 'Responsible person',
    submit: 'Submit corrective action',
    accept: 'Accept',
    reject: 'Reject',
    noCorrectiveActions: 'No corrective actions raised.',
  },
  ai: {
    copilotTitle: 'AI Co-Pilot',
    askPlaceholder: 'Ask ARIA about ISO 45001, this clause, or this finding…',
    draftNCR: 'Draft NCR statement',
    suggestQuestions: 'Suggest interview questions',
    analyzePhoto: 'Analyze photo',
    disclaimer: AI_DISCLAIMER,
    generating: 'ARIA is thinking…',
    unavailable: 'The AI co-pilot is temporarily unavailable. You can continue without it.',
    reviewRequired: 'Review the AI draft and edit before saving.',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Unable to reach the server. Your work is saved locally.',
    permissionDenied: 'You do not have permission to perform this action.',
    notFound: 'The requested item could not be found.',
    validation: 'Please correct the highlighted fields and try again.',
    tenantMismatch: 'This record belongs to a different organization.',
    aiTimeout: 'The AI request took too long. Please try again.',
    configErrorTitle: 'This app is not configured correctly.',
    configError:
      'The app could not start because its connection settings are missing. ' +
      'If you are the administrator, set the required environment variables for this deployment and redeploy.',
  },
} as const;

/** Deeply-readonly type of the Soteria string catalogue. */
export type SoteriaStringsType = typeof SoteriaStrings;
