#!/usr/bin/env node
/**
 * Seeds a self-contained DEMO tenant for client walkthroughs.
 *
 * Everything it writes is namespaced under a single tenant (default id
 * `demo-tenant`) and every document id is derived, never random — so the script
 * is idempotent: re-running it refreshes the demo in place rather than
 * accumulating duplicates. `--wipe` removes the tenant first for a clean slate.
 *
 * WHY THIS EXISTS (beyond convenience): `setTenantClaims` requires the caller to
 * already hold a `super_admin` / `tenant_admin` claim, and custom claims are
 * only ever minted by that callable. A brand-new Firebase project therefore has
 * no path to its first admin — a user can register and sign in, but lands with
 * no `tenantId`, `useTenantId()` returns '', every query stays disabled and the
 * app looks empty. This script breaks that cycle with the Admin SDK, which
 * bypasses both the callable's role gate and the Firestore rules.
 *
 * USAGE
 *   # against the live project (needs Admin credentials — see below)
 *   node scripts/seed-demo.mjs --project soteria-assurance
 *
 *   # against a local emulator suite (no credentials needed)
 *   node scripts/seed-demo.mjs --emulator
 *
 *   # start over
 *   node scripts/seed-demo.mjs --project soteria-assurance --wipe
 *
 * CREDENTIALS (live project only) — either:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   # ...or Application Default Credentials:
 *   gcloud auth application-default login
 *
 * FLAGS
 *   --project <id>    Firebase project id (default: $GCLOUD_PROJECT or soteria-assurance)
 *   --emulator        Target the local emulator suite (Firestore 8080, Auth 9099)
 *   --wipe            Delete the demo tenant + demo auth users before seeding
 *   --tenant <id>     Demo tenant id (default: demo-tenant)
 *   --email <addr>    Demo login email (default: demo@soteria-demo.com)
 *   --password <pw>   Demo login password (default: SoteriaDemo!2026)
 *   --dry-run         Print what would be written, write nothing
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);

// firebase-admin lives in the workspace store (declared by `functions`), and
// @soteria/core is consumed from its built CJS bundle so this script shares the
// exact ROLE_PERMISSIONS / clause dataset the app ships.
const admin = require(require.resolve('firebase-admin', { paths: [join(repoRoot, 'functions')] }));
const core = require(join(repoRoot, 'packages/core/dist/index.js'));

const { ROLE_PERMISSIONS, getClauseByNumber, computeFindingsSummary, clauseScoreFromVerdicts } =
  core;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    project: process.env.GCLOUD_PROJECT ?? 'soteria-assurance',
    tenantId: 'demo-tenant',
    email: 'demo@soteria-demo.com',
    password: 'SoteriaDemo!2026',
    emulator: false,
    wipe: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return v;
    };
    switch (arg) {
      case '--project': opts.project = next(); break;
      case '--tenant': opts.tenantId = next(); break;
      case '--email': opts.email = next(); break;
      case '--password': opts.password = next(); break;
      case '--emulator': opts.emulator = true; break;
      case '--wipe': opts.wipe = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Demo narrative
//
// A certification body (the tenant) running ISO 45001 audits for three client
// organisations, deliberately spread across the audit lifecycle so every screen
// in the app has something real to show.
// ---------------------------------------------------------------------------

const TENANT = {
  name: 'Meridian Assurance Partners',
  type: 'certification_body', // Tenant.type vocabulary
  claimType: 'cb', // FirebaseCustomClaims.tenantType vocabulary — deliberately different
};

const PEOPLE = {
  admin: { id: 'demo-user-admin', name: 'Alex Reyes', role: 'tenant_admin' },
  lead: { id: 'demo-user-lead', name: 'Priya Raman', role: 'lead_auditor' },
  auditor: { id: 'demo-user-auditor', name: 'Tom Okafor', role: 'auditor' },
};

/** Fixed reference date so the demo reads consistently regardless of run time. */
const TODAY = new Date('2026-07-28T09:00:00Z');

function daysFrom(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
/** ISO date STRING (yyyy-mm-dd) — used by the date fields that are not Timestamps. */
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function ts(date) {
  return admin.firestore.Timestamp.fromDate(date);
}

const CLIENTS = [
  {
    id: 'demo-client-cascade',
    organizationName: 'Cascade Precision Manufacturing',
    industry: 'Precision engineering & metal fabrication',
    address: {
      street: '1400 Foundry Road', city: 'Sheffield', state: 'South Yorkshire',
      country: 'United Kingdom', postalCode: 'S9 2YL',
    },
    contactName: 'Dawn Whitfield', contactEmail: 'dwhitfield@cascade-precision.example',
    contactPhone: '+44 114 496 0182',
    numberOfEmployees: 340,
    certificationStatus: 'certified',
    certificationBody: 'Meridian Assurance Partners',
    certificationExpiry: isoDate(daysFrom(TODAY, 430)),
    sites: [
      {
        siteId: 'site-cascade-main', siteName: 'Sheffield Machining Plant',
        address: { street: '1400 Foundry Road', city: 'Sheffield', state: 'South Yorkshire', country: 'United Kingdom', postalCode: 'S9 2YL' },
        siteContactName: 'Dawn Whitfield', siteContactEmail: 'dwhitfield@cascade-precision.example',
        numberOfWorkers: 260, hazardCategory: 'high',
      },
      {
        siteId: 'site-cascade-finishing', siteName: 'Rotherham Finishing & Coating',
        address: { street: '22 Canklow Way', city: 'Rotherham', state: 'South Yorkshire', country: 'United Kingdom', postalCode: 'S60 2XL' },
        siteContactName: 'Mark Ellery', siteContactEmail: 'mellery@cascade-precision.example',
        numberOfWorkers: 80, hazardCategory: 'very_high',
      },
    ],
  },
  {
    id: 'demo-client-harbour',
    organizationName: 'Harbour Logistics Group',
    industry: 'Warehousing & distribution',
    address: {
      street: 'Unit 7, Dockside Park', city: 'Liverpool', state: 'Merseyside',
      country: 'United Kingdom', postalCode: 'L3 4BQ',
    },
    contactName: 'Samuel Achebe', contactEmail: 'sachebe@harbourlogistics.example',
    contactPhone: '+44 151 704 3355',
    numberOfEmployees: 615,
    certificationStatus: 'not_certified',
    sites: [
      {
        siteId: 'site-harbour-dock', siteName: 'Liverpool Dockside DC',
        address: { street: 'Unit 7, Dockside Park', city: 'Liverpool', state: 'Merseyside', country: 'United Kingdom', postalCode: 'L3 4BQ' },
        siteContactName: 'Samuel Achebe', siteContactEmail: 'sachebe@harbourlogistics.example',
        numberOfWorkers: 410, hazardCategory: 'high',
      },
      {
        siteId: 'site-harbour-inland', siteName: 'Warrington Inland Hub',
        address: { street: 'Kingsland Grange', city: 'Warrington', state: 'Cheshire', country: 'United Kingdom', postalCode: 'WA1 4RW' },
        siteContactName: 'Ruth Farrow', siteContactEmail: 'rfarrow@harbourlogistics.example',
        numberOfWorkers: 205, hazardCategory: 'medium',
      },
    ],
  },
  {
    id: 'demo-client-northwind',
    organizationName: 'Northwind Energy Services',
    industry: 'Utilities & renewable energy maintenance',
    address: {
      street: 'Kittiwake House, Energy Park', city: 'Aberdeen', state: 'Aberdeenshire',
      country: 'United Kingdom', postalCode: 'AB12 3FG',
    },
    contactName: 'Iona Mackenzie', contactEmail: 'imackenzie@northwind-energy.example',
    contactPhone: '+44 1224 887 210',
    numberOfEmployees: 190,
    certificationStatus: 'certified',
    certificationBody: 'Meridian Assurance Partners',
    certificationExpiry: isoDate(daysFrom(TODAY, 96)),
    sites: [
      {
        siteId: 'site-northwind-base', siteName: 'Aberdeen Operations Base',
        address: { street: 'Kittiwake House, Energy Park', city: 'Aberdeen', state: 'Aberdeenshire', country: 'United Kingdom', postalCode: 'AB12 3FG' },
        siteContactName: 'Iona Mackenzie', siteContactEmail: 'imackenzie@northwind-energy.example',
        numberOfWorkers: 190, hazardCategory: 'very_high',
      },
    ],
  },
];

/**
 * Findings, keyed by audit. Clause numbers are validated against the real
 * ISO 45001 dataset at run time, so a typo fails loudly instead of seeding a
 * finding that points at a clause the UI cannot resolve.
 */
const FINDING_SPECS = [
  {
    auditKey: 'harbour', num: 1, type: 'major_nc', severity: 'major', clause: '6.1.2',
    title: 'Hazard identification does not cover non-routine yard movements',
    objectiveEvidence:
      'The hazard register (HLG-OHS-REG-02, rev 4) addresses routine forklift and pedestrian flows only. Night-shift trailer shunting and the ad-hoc use of the overflow yard during peak weeks are absent. Interviews with two yard supervisors confirmed shunting is performed weekly and has never been risk assessed.',
    nonconformityStatement:
      'The organization has not established a process for hazard identification that is proactive and ongoing across non-routine activities and situations, as required for yard shunting operations at the Liverpool Dockside DC.',
    status: 'ca_submitted', caStatus: 'submitted',
  },
  {
    auditKey: 'harbour', num: 2, type: 'minor_nc', severity: 'minor', clause: '7.2',
    title: 'Competence records incomplete for agency warehouse operatives',
    objectiveEvidence:
      'Sampled 8 agency operatives active in weeks 22–26. Three had no record of the site OH&S induction and two held expired counterbalance truck certificates (expired 2026-02 and 2026-04).',
    nonconformityStatement:
      'The organization has not retained appropriate documented information as evidence of competence for all workers performing work under its control.',
    status: 'acknowledged', caStatus: 'in_progress',
  },
  {
    auditKey: 'harbour', num: 3, type: 'minor_nc', severity: 'minor', clause: '5.4',
    title: 'Worker consultation not evidenced for the Warrington hub',
    objectiveEvidence:
      'OH&S committee minutes exist for the Liverpool site (monthly, complete for 12 months). No equivalent consultation record was available for the Warrington Inland Hub, which has operated since 2025-09.',
    nonconformityStatement:
      'The organization has not demonstrated consultation with non-managerial workers at all sites within the scope of the OH&S management system.',
    status: 'closed', caStatus: 'closed',
  },
  {
    auditKey: 'harbour', num: 4, type: 'ofi', clause: '9.2',
    title: 'Internal audit programme could be risk-weighted',
    objectiveEvidence:
      'The internal audit schedule allocates equal frequency to all clauses regardless of risk profile. Higher-risk operational areas (8.1.2, 8.2) would benefit from increased frequency.',
    nonconformityStatement:
      'Opportunity for improvement: weight the internal audit programme by the significance of OH&S risks and the results of previous audits.',
    status: 'open',
  },
  {
    auditKey: 'harbour', num: 5, type: 'strong_point', clause: '5.1',
    title: 'Visible and consistent leadership engagement',
    objectiveEvidence:
      'The Managing Director has completed documented safety walkarounds at both sites every month for 14 consecutive months, with actions tracked to closure in the OH&S action log.',
    nonconformityStatement:
      'Strong point: top management demonstrates sustained, evidenced leadership and commitment to the OH&S management system.',
    status: 'closed',
  },
  {
    auditKey: 'cascade', num: 6, type: 'minor_nc', severity: 'minor', clause: '8.1.4.2',
    title: 'Contractor OH&S pre-qualification not applied to specialist coating subcontractor',
    objectiveEvidence:
      'The Rotherham finishing line uses a specialist coating subcontractor engaged in 2026-05. No completed contractor pre-qualification questionnaire or method statement was on file at the time of audit.',
    nonconformityStatement:
      'The organization has not coordinated its procurement process to ensure that contractors and their workers meet the requirements of the OH&S management system.',
    status: 'open', caStatus: 'pending',
  },
  {
    auditKey: 'cascade', num: 7, type: 'observation', clause: '10.2',
    title: 'Incident investigation timeliness drifting',
    objectiveEvidence:
      'Median time from incident report to completed investigation was 19 days across the last 11 incidents, against an internal target of 10 days.',
    nonconformityStatement:
      'Observation: investigation closure times exceed the organization’s own target; no requirement of the standard is currently breached.',
    status: 'open',
  },
];

const CA_SPECS = [
  {
    id: 'demo-ca-001', findingNum: 1, auditKey: 'harbour', clientKey: 'harbour',
    caNum: 1, status: 'submitted',
    title: 'Extend hazard identification to non-routine yard operations',
    rootCauseMethod: 'five_why',
    rootCauseAnalysis:
      'Why was shunting not assessed? It was not on the activity list. Why? The activity list was built from the routine shift pattern. Why? The hazard identification procedure triggers on new equipment, not new activities. Why? The procedure was written around the 2023 fleet upgrade. Root cause: the hazard identification procedure has no trigger for non-routine or seasonal activities.',
    immediateAction:
      'Night-shift shunting suspended pending assessment; trailers repositioned by the day-shift team under the existing assessed procedure.',
    correctiveAction:
      'Hazard register extended to cover shunting, overflow-yard use and peak-week traffic changes. Three new risk assessments completed and briefed to all yard staff.',
    preventiveAction:
      'Hazard identification procedure HLG-OHS-P-01 revised to add a mandatory review trigger for any non-routine or seasonal activity, with a quarterly activity-list review owned by the site OH&S lead.',
    effectivenessCheck:
      'Verify at the next surveillance audit that the quarterly activity review has run twice and that any new activity appears in the hazard register within 30 days.',
    responsiblePersonName: 'Samuel Achebe', responsiblePersonEmail: 'sachebe@harbourlogistics.example',
    offsetTarget: 60, offsetSubmitted: 41,
  },
  {
    id: 'demo-ca-002', findingNum: 2, auditKey: 'harbour', clientKey: 'harbour',
    caNum: 2, status: 'in_progress',
    title: 'Close competence record gaps for agency workers',
    rootCauseMethod: 'fishbone',
    rootCauseAnalysis:
      'Method: agency onboarding runs through the labour supplier’s system, which is not reconciled against the site training matrix. People: no named owner for agency competence. Measurement: no periodic expiry check on truck certificates.',
    immediateAction:
      'The three operatives without induction records were stood down and re-inducted the same day; the two expired truck certificates were re-tested within the week.',
    correctiveAction:
      'All 47 currently active agency operatives audited against the training matrix; 6 further gaps found and closed.',
    preventiveAction:
      'Weekly automated reconciliation between the supplier feed and the site training matrix, with expiry alerts at 60/30/7 days. Agency competence ownership assigned to the shift operations manager.',
    effectivenessCheck:
      'Re-sample 10 agency records at the next surveillance audit; zero tolerance for missing induction or expired licences.',
    responsiblePersonName: 'Ruth Farrow', responsiblePersonEmail: 'rfarrow@harbourlogistics.example',
    offsetTarget: 90,
  },
  {
    id: 'demo-ca-003', findingNum: 3, auditKey: 'harbour', clientKey: 'harbour',
    caNum: 3, status: 'closed',
    title: 'Establish worker consultation at the Warrington hub',
    rootCauseMethod: 'free_form',
    rootCauseAnalysis:
      'The Warrington hub was brought into scope in 2025-09 under an existing management system, but the OH&S committee terms of reference were never amended to cover a second location, so no forum existed for its workers.',
    immediateAction:
      'Interim consultation held with Warrington workers 2026-04-02, minuted and circulated.',
    correctiveAction:
      'Committee terms of reference amended to a two-site structure with elected representatives from each location; three monthly meetings held and minuted since.',
    preventiveAction:
      'Site mobilisation checklist updated so any new location in scope must have consultation arrangements confirmed before go-live.',
    effectivenessCheck:
      'Confirmed at closure review: three consecutive minuted meetings with Warrington representation and evidence of worker-raised items being actioned.',
    effectivenessResult: 'effective',
    responsiblePersonName: 'Ruth Farrow', responsiblePersonEmail: 'rfarrow@harbourlogistics.example',
    offsetTarget: 90, offsetSubmitted: 52, offsetReviewed: 60, offsetClosed: 63,
    closureNotes:
      'Closed at the report review meeting. Evidence pack reviewed: amended terms of reference, three sets of minutes, and the updated mobilisation checklist.',
  },
  {
    id: 'demo-ca-004', findingNum: 6, auditKey: 'cascade', clientKey: 'cascade',
    caNum: 4, status: 'pending',
    title: 'Apply contractor pre-qualification to the coating subcontractor',
    rootCauseMethod: '8d',
    rootCauseAnalysis:
      'Pending — root cause analysis due with the corrective action response.',
    immediateAction:
      'Coating subcontractor escorted at all times pending completion of pre-qualification.',
    correctiveAction: 'To be submitted by the client.',
    preventiveAction: 'To be submitted by the client.',
    effectivenessCheck: 'To be agreed once the corrective action is submitted.',
    responsiblePersonName: 'Mark Ellery', responsiblePersonEmail: 'mellery@cascade-precision.example',
    offsetTarget: 90,
  },
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function requireClause(number) {
  const clause = getClauseByNumber(number);
  if (clause === undefined) {
    throw new Error(
      `Clause ${number} is not in the ISO 45001 dataset — fix the seed spec rather than seeding an unresolvable reference.`,
    );
  }
  return clause;
}

function buildAudits(tenantId) {
  const team = (roles) => roles.map(({ person, role, clauses }) => ({
    userId: person.id, displayName: person.name, role, clauseAssignments: clauses,
  }));

  const planFor = (clauses, areas) => ({
    activities: [
      { activityId: 'act-open', time: '09:00', duration: 45, activity: 'Opening meeting', clauses: [], location: 'Main meeting room', auditorIds: [PEOPLE.lead.id, PEOPLE.auditor.id], intervieweeIds: ['int-mr'] },
      { activityId: 'act-leadership', time: '09:45', duration: 90, activity: 'Leadership, policy and worker consultation', clauses: ['5.1', '5.2', '5.4'], location: 'Main meeting room', auditorIds: [PEOPLE.lead.id], intervieweeIds: ['int-mr'] },
      { activityId: 'act-floor', time: '11:30', duration: 150, activity: 'Operational control — floor walk and interviews', clauses, location: 'Operations area', auditorIds: [PEOPLE.auditor.id], intervieweeIds: ['int-super'] },
      { activityId: 'act-close', time: '16:00', duration: 60, activity: 'Closing meeting and findings presentation', clauses: [], location: 'Main meeting room', auditorIds: [PEOPLE.lead.id, PEOPLE.auditor.id], intervieweeIds: ['int-mr'] },
    ],
    documentReviewList: [
      'OH&S policy and objectives', 'Hazard register and risk assessments',
      'Legal and other requirements register', 'Training matrix and competence records',
      'Incident log and investigation reports', 'Internal audit programme and reports',
      'Management review minutes',
    ],
    intervieweeList: [
      { intervieweeId: 'int-mr', name: 'Management representative', jobTitle: 'Head of HSE', department: 'HSE', topics: ['Policy', 'Objectives', 'Management review'], scheduledTime: '09:45' },
      { intervieweeId: 'int-super', name: 'Operations supervisor', jobTitle: 'Shift Supervisor', department: 'Operations', topics: ['Operational control', 'Emergency preparedness'], scheduledTime: '11:30' },
    ],
    areaInspectionList: areas,
  });

  return [
    {
      key: 'harbour',
      id: 'demo-audit-harbour-001',
      clientId: 'demo-client-harbour',
      auditNumber: 'AUD-2026-001',
      auditType: 'initial_certification',
      auditStage: 'stage_2',
      scope:
        'ISO 45001:2018 certification audit of the occupational health and safety management system covering warehousing, distribution and yard operations at the Liverpool Dockside DC and the Warrington Inland Hub.',
      status: 'report_issued',
      leadAuditorId: PEOPLE.lead.id,
      auditTeam: team([
        { person: PEOPLE.lead, role: 'lead_auditor', clauses: ['4', '5', '6', '9', '10'] },
        { person: PEOPLE.auditor, role: 'auditor', clauses: ['7', '8'] },
      ]),
      managementRepresentativeName: 'Samuel Achebe',
      plannedStart: daysFrom(TODAY, -74), plannedEnd: daysFrom(TODAY, -71),
      actualStart: daysFrom(TODAY, -74), actualEnd: daysFrom(TODAY, -71),
      auditDays: 4,
      sitesInScope: ['site-harbour-dock', 'site-harbour-inland'],
      plan: planFor(['8.1', '8.1.2', '8.2'], [
        { areaId: 'area-yard', name: 'Dockside yard & trailer park', hazards: ['Vehicle/pedestrian interface', 'Trailer shunting', 'Working at height on trailers'], clauses: ['6.1.2', '8.1.2'], scheduledTime: '11:30' },
        { areaId: 'area-racking', name: 'High-bay racking & pick faces', hazards: ['Falling objects', 'MHE collision', 'Manual handling'], clauses: ['8.1.2'], scheduledTime: '13:30' },
      ]),
      completedAt: daysFrom(TODAY, -71),
      reportIssuedAt: daysFrom(TODAY, -64),
      aiCertificationReadinessScore: 78,
      aiRiskFlags: [
        'Non-routine activities under-represented in hazard identification',
        'Agency-worker competence assurance depends on a third-party system',
      ],
    },
    {
      key: 'cascade',
      id: 'demo-audit-cascade-002',
      clientId: 'demo-client-cascade',
      auditNumber: 'AUD-2026-002',
      auditType: 'surveillance',
      auditStage: 'not_applicable',
      scope:
        'First surveillance audit of the ISO 45001:2018 management system covering precision machining at Sheffield and finishing/coating operations at Rotherham.',
      status: 'in_progress',
      leadAuditorId: PEOPLE.lead.id,
      auditTeam: team([
        { person: PEOPLE.lead, role: 'lead_auditor', clauses: ['4', '5', '9', '10'] },
        { person: PEOPLE.auditor, role: 'auditor', clauses: ['6', '7', '8'] },
      ]),
      managementRepresentativeName: 'Dawn Whitfield',
      plannedStart: daysFrom(TODAY, -1), plannedEnd: daysFrom(TODAY, 1),
      actualStart: daysFrom(TODAY, -1),
      auditDays: 3,
      sitesInScope: ['site-cascade-main', 'site-cascade-finishing'],
      plan: planFor(['8.1', '8.1.4.2', '8.2'], [
        { areaId: 'area-machine', name: 'CNC machine shop', hazards: ['Rotating machinery', 'Metalworking fluid exposure', 'Noise'], clauses: ['6.1.2', '8.1.2'], scheduledTime: '11:30' },
        { areaId: 'area-coating', name: 'Coating & paint line', hazards: ['Isocyanate exposure', 'Flammable atmosphere', 'Confined space entry'], clauses: ['6.1.2', '8.2'], scheduledTime: '14:00' },
      ]),
      aiCertificationReadinessScore: 86,
      aiRiskFlags: ['Contractor control at the Rotherham coating line'],
    },
    {
      key: 'northwind',
      id: 'demo-audit-northwind-003',
      clientId: 'demo-client-northwind',
      auditNumber: 'AUD-2026-003',
      auditType: 'recertification',
      auditStage: 'not_applicable',
      scope:
        'Three-yearly recertification audit covering offshore and onshore maintenance operations delivered from the Aberdeen operations base.',
      status: 'planned',
      leadAuditorId: PEOPLE.lead.id,
      auditTeam: team([{ person: PEOPLE.lead, role: 'lead_auditor', clauses: ['4', '5', '6', '7', '8', '9', '10'] }]),
      managementRepresentativeName: 'Iona Mackenzie',
      plannedStart: daysFrom(TODAY, 38), plannedEnd: daysFrom(TODAY, 41),
      auditDays: 4,
      sitesInScope: ['site-northwind-base'],
      plan: planFor(['8.1', '8.1.2', '8.2'], [
        { areaId: 'area-workshop', name: 'Turbine component workshop', hazards: ['Lifting operations', 'Working at height', 'Stored energy'], clauses: ['6.1.2', '8.1.2'], scheduledTime: '11:30' },
      ]),
    },
    {
      key: 'cascade-prior',
      id: 'demo-audit-cascade-2025',
      clientId: 'demo-client-cascade',
      auditNumber: 'AUD-2025-014',
      auditType: 'initial_certification',
      auditStage: 'stage_2',
      scope:
        'Initial ISO 45001:2018 certification audit of precision machining and finishing operations. Closed; certificate issued.',
      status: 'closed',
      leadAuditorId: PEOPLE.lead.id,
      auditTeam: team([{ person: PEOPLE.lead, role: 'lead_auditor', clauses: ['4', '5', '6', '7', '8', '9', '10'] }]),
      managementRepresentativeName: 'Dawn Whitfield',
      plannedStart: daysFrom(TODAY, -380), plannedEnd: daysFrom(TODAY, -377),
      actualStart: daysFrom(TODAY, -380), actualEnd: daysFrom(TODAY, -377),
      auditDays: 4,
      sitesInScope: ['site-cascade-main', 'site-cascade-finishing'],
      plan: planFor(['8.1', '8.2'], [
        { areaId: 'area-machine', name: 'CNC machine shop', hazards: ['Rotating machinery', 'Noise'], clauses: ['6.1.2'], scheduledTime: '11:30' },
      ]),
      completedAt: daysFrom(TODAY, -377),
      reportIssuedAt: daysFrom(TODAY, -370),
      aiCertificationReadinessScore: 91,
    },
  ].map((a) => ({ ...a, tenantId }));
}

/**
 * Clause assessments are generated from the REAL dataset (every level-1 and
 * level-2 clause in groups 4–10) so no assessment can reference a clause the UI
 * cannot resolve. Verdicts are seeded deterministically and the score is derived
 * with the app's own `clauseScoreFromVerdicts`, so the numbers on screen are
 * internally consistent rather than made up.
 */
function buildClauseAssessments(tenantId, audit, findings) {
  const clauses = core.ISO45001_CLAUSES.filter((c) => c.level <= 2 && Number(c.number.split('.')[0]) >= 4);

  // Which clauses this audit actually got through, by status.
  const coverage = {
    report_issued: clauses.length,
    closed: clauses.length,
    in_progress: Math.ceil(clauses.length * 0.55),
    planned: 0,
  }[audit.status] ?? clauses.length;

  const findingsByClause = new Map();
  for (const f of findings) {
    const list = findingsByClause.get(f.clauseNumber) ?? [];
    list.push(f);
    findingsByClause.set(f.clauseNumber, list);
  }

  return clauses.slice(0, coverage).map((clause, index) => {
    const related = findingsByClause.get(clause.number) ?? [];
    const major = related.some((f) => f.type === 'major_nc');
    const minor = related.some((f) => f.type === 'minor_nc');

    // Deterministic verdict pattern; NC clauses get a 'no' so the score reflects it.
    const questions = clause.typicalAuditQuestions.slice(0, 3);
    const subClauseNotes = questions.map((question, qi) => {
      let verdict = 'yes';
      if ((major && qi === 0) || (minor && qi === 1)) verdict = 'no';
      else if ((index + qi) % 5 === 0) verdict = 'partial';
      return {
        subClauseNumber: clause.number,
        requirementText: clause.requirementText,
        auditQuestion: question,
        auditorResponse: verdict === 'no'
          ? 'Requirement not met — see the finding raised against this clause.'
          : verdict === 'partial'
            ? 'Partially met; arrangements exist but evidence of consistent application was limited.'
            : 'Requirement met; objective evidence sighted and corroborated by interview.',
        conformityVerdict: verdict,
      };
    });

    const conformityStatus = major ? 'major_nc' : minor ? 'minor_nc' : 'conforming';
    const isComplete = audit.status !== 'in_progress' || index < coverage - 3;

    return {
      id: `${audit.id}-clause-${clause.number.replace(/\./g, '-')}`,
      auditId: audit.id,
      tenantId,
      clauseNumber: clause.number,
      clauseTitle: clause.title,
      assignedAuditorId: index % 2 === 0 ? PEOPLE.lead.id : PEOPLE.auditor.id,
      conformityStatus,
      score: clauseScoreFromVerdicts(subClauseNotes.map((n) => n.conformityVerdict)),
      auditorNotes: related.length > 0
        ? `Evidence reviewed against clause ${clause.number}. ${related.length} finding(s) raised — see the findings tab.`
        : `Evidence reviewed against clause ${clause.number}. Arrangements were found to be established, implemented and maintained.`,
      evidenceIds: [],
      findingIds: related.map((f) => f.id),
      subClauseNotes,
      isComplete,
      ...(isComplete ? { completedAt: ts(audit.actualEnd ?? audit.plannedEnd) } : {}),
      updatedAt: ts(audit.actualEnd ?? audit.plannedStart),
    };
  });
}

function buildFindings(tenantId, auditsByKey) {
  return FINDING_SPECS.map((spec) => {
    const clause = requireClause(spec.clause);
    const audit = auditsByKey.get(spec.auditKey);
    const raisedAt = daysFrom(audit.actualStart ?? audit.plannedStart, 1);
    const window = spec.type === 'major_nc' ? 60 : spec.type === 'minor_nc' ? 90 : null;

    const finding = {
      id: `demo-finding-${String(spec.num).padStart(3, '0')}`,
      auditId: audit.id,
      tenantId,
      clientId: audit.clientId,
      findingNumber: `NCR-2026-${String(spec.num).padStart(3, '0')}`,
      type: spec.type,
      ...(spec.severity !== undefined ? { severity: spec.severity } : {}),
      clauseNumber: clause.number,
      clauseTitle: clause.title,
      requirement: clause.requirementText,
      title: spec.title,
      objectiveEvidence: spec.objectiveEvidence,
      nonconformityStatement: spec.nonconformityStatement,
      evidenceIds: [],
      raisedByAuditorId: PEOPLE.lead.id,
      raisedByAuditorName: PEOPLE.lead.name,
      raisedAt: ts(raisedAt),
      status: spec.status,
      updatedAt: ts(daysFrom(raisedAt, 3)),
    };

    if (window !== null) {
      finding.targetClosureDate = isoDate(daysFrom(raisedAt, window));
    }
    if (spec.status !== 'open') {
      finding.acknowledgedByName = audit.managementRepresentativeName;
      finding.acknowledgedAt = ts(daysFrom(raisedAt, 4));
    }
    if (spec.status === 'closed') {
      finding.actualClosureDate = isoDate(daysFrom(raisedAt, 63));
      finding.closedAt = ts(daysFrom(raisedAt, 63));
      finding.closedByAuditorId = PEOPLE.lead.id;
    }
    if (spec.caStatus !== undefined) {
      finding.correctiveActionStatus = spec.caStatus;
    }
    return finding;
  });
}

function buildCorrectiveActions(tenantId, auditsByKey, findingsById) {
  return CA_SPECS.map((spec) => {
    const audit = auditsByKey.get(spec.auditKey);
    const findingId = `demo-finding-${String(spec.findingNum).padStart(3, '0')}`;
    const finding = findingsById.get(findingId);
    if (finding === undefined) {
      throw new Error(`Corrective action ${spec.id} references unknown finding ${findingId}`);
    }
    const raisedAt = daysFrom(audit.actualStart ?? audit.plannedStart, 1);

    const history = [
      { timestamp: ts(daysFrom(raisedAt, 1)), action: 'Corrective action request issued', performedBy: PEOPLE.lead.name, notes: `Raised against ${finding.findingNumber}.` },
    ];
    if (spec.offsetSubmitted !== undefined) {
      history.push({ timestamp: ts(daysFrom(raisedAt, spec.offsetSubmitted)), action: 'Response submitted by client', performedBy: spec.responsiblePersonName });
    }
    if (spec.offsetReviewed !== undefined) {
      history.push({ timestamp: ts(daysFrom(raisedAt, spec.offsetReviewed)), action: 'Response reviewed and accepted', performedBy: PEOPLE.lead.name });
    }
    if (spec.offsetClosed !== undefined) {
      history.push({ timestamp: ts(daysFrom(raisedAt, spec.offsetClosed)), action: 'Corrective action closed', performedBy: PEOPLE.lead.name, notes: spec.closureNotes });
    }

    const ca = {
      id: spec.id,
      tenantId,
      clientId: audit.clientId,
      auditId: audit.id,
      findingId,
      caNumber: `CA-2026-${String(spec.caNum).padStart(3, '0')}`,
      title: spec.title,
      rootCauseMethod: spec.rootCauseMethod,
      rootCauseAnalysis: spec.rootCauseAnalysis,
      immediateAction: spec.immediateAction,
      correctiveAction: spec.correctiveAction,
      preventiveAction: spec.preventiveAction,
      effectivenessCheck: spec.effectivenessCheck,
      responsiblePersonName: spec.responsiblePersonName,
      responsiblePersonEmail: spec.responsiblePersonEmail,
      targetDate: isoDate(daysFrom(raisedAt, spec.offsetTarget)),
      closureEvidenceIds: [],
      status: spec.status,
      history,
      createdAt: ts(daysFrom(raisedAt, 1)),
      updatedAt: ts(history[history.length - 1].timestamp.toDate()),
    };
    if (spec.offsetSubmitted !== undefined) ca.submittedDate = isoDate(daysFrom(raisedAt, spec.offsetSubmitted));
    if (spec.offsetReviewed !== undefined) ca.reviewedDate = isoDate(daysFrom(raisedAt, spec.offsetReviewed));
    if (spec.offsetClosed !== undefined) {
      ca.closedDate = isoDate(daysFrom(raisedAt, spec.offsetClosed));
      ca.reviewedByAuditorId = PEOPLE.lead.id;
      if (spec.closureNotes !== undefined) ca.closureNotes = spec.closureNotes;
    }
    if (spec.effectivenessResult !== undefined) {
      ca.effectivenessResult = spec.effectivenessResult;
      ca.effectivenessCheckDate = isoDate(daysFrom(raisedAt, spec.offsetClosed ?? spec.offsetTarget));
    }
    return ca;
  });
}

function buildTenantDoc(tenantId, now) {
  return {
    id: tenantId,
    name: TENANT.name,
    type: TENANT.type,
    subscriptionTier: 'professional',
    subscriptionStatus: 'active',
    maxAuditors: 25,
    maxAuditsPerMonth: 40,
    settings: {
      timezone: 'Europe/London',
      defaultLanguage: 'en-GB',
      requireEvidencePerFinding: true,
      requireWitnessStatement: false,
      autoGenerateNCRNumbers: true,
      ncrPrefix: 'NCR',
      reportTemplate: 'comprehensive',
      brandingColor: '#1F4E5F',
    },
    createdAt: ts(daysFrom(TODAY, -540)),
    updatedAt: now,
  };
}

function buildUserDocs(tenantId, demoEmail) {
  return Object.entries(PEOPLE).map(([key, person]) => ({
    id: person.id,
    tenantId,
    email: key === 'admin' ? demoEmail : `${person.name.split(' ')[0].toLowerCase()}@meridian-assurance.example`,
    displayName: person.name,
    role: person.role,
    qualifications: person.role === 'tenant_admin' ? [] : [{
      standard: 'ISO 45001:2018',
      level: person.role === 'lead_auditor' ? 'lead_auditor' : 'auditor',
      certBody: 'IRCA',
      certNumber: `IRCA-${person.id.slice(-5).toUpperCase()}`,
      issuedDate: isoDate(daysFrom(TODAY, -900)),
      expiryDate: isoDate(daysFrom(TODAY, 460)),
    }],
    clientIds: [],
    isActive: true,
    createdAt: ts(daysFrom(TODAY, -540)),
  }));
}

function buildClientDocs(tenantId, audits, now) {
  const auditIdsByClient = new Map();
  for (const a of audits) {
    const list = auditIdsByClient.get(a.clientId) ?? [];
    list.push(a.id);
    auditIdsByClient.set(a.clientId, list);
  }
  return CLIENTS.map((client) => ({
    id: client.id,
    tenantId,
    organizationName: client.organizationName,
    industry: client.industry,
    address: client.address,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    numberOfEmployees: client.numberOfEmployees,
    numberOfSites: client.sites.length,
    sites: client.sites,
    certificationStatus: client.certificationStatus,
    ...(client.certificationBody !== undefined ? { certificationBody: client.certificationBody } : {}),
    ...(client.certificationExpiry !== undefined ? { certificationExpiry: client.certificationExpiry } : {}),
    auditHistory: auditIdsByClient.get(client.id) ?? [],
    createdAt: ts(daysFrom(TODAY, -500)),
    updatedAt: now,
  }));
}

function buildAuditDoc(tenantId, audit, auditFindings, now) {
  const doc = {
    id: audit.id,
    tenantId,
    clientId: audit.clientId,
    auditNumber: audit.auditNumber,
    auditType: audit.auditType,
    auditStage: audit.auditStage,
    standard: 'ISO 45001:2018',
    scope: audit.scope,
    status: audit.status,
    leadAuditorId: audit.leadAuditorId,
    auditTeam: audit.auditTeam,
    managementRepresentativeName: audit.managementRepresentativeName,
    plannedStartDate: isoDate(audit.plannedStart),
    plannedEndDate: isoDate(audit.plannedEnd),
    auditDays: audit.auditDays,
    sitesInScope: audit.sitesInScope,
    auditPlan: audit.plan,
    findings: computeFindingsSummary(auditFindings),
    confidentiality: 'standard',
    createdAt: ts(daysFrom(audit.plannedStart, -30)),
    updatedAt: now,
  };
  if (audit.actualStart !== undefined) doc.actualStartDate = isoDate(audit.actualStart);
  if (audit.actualEnd !== undefined) doc.actualEndDate = isoDate(audit.actualEnd);
  if (audit.completedAt !== undefined) doc.completedAt = ts(audit.completedAt);
  if (audit.reportIssuedAt !== undefined) doc.reportIssuedAt = ts(audit.reportIssuedAt);
  if (audit.aiCertificationReadinessScore !== undefined) doc.aiCertificationReadinessScore = audit.aiCertificationReadinessScore;
  if (audit.aiRiskFlags !== undefined) doc.aiRiskFlags = audit.aiRiskFlags;
  return doc;
}

// ---------------------------------------------------------------------------
// Validation
//
// The Admin SDK bypasses Firestore rules and Firestore itself is schemaless, so
// nothing downstream will reject a malformed document — a wrong field name or a
// Timestamp where the app expects an ISO string surfaces as a blank screen or an
// "Invalid Date" during the demo. These checks mirror the core types so a bad
// document fails here instead.
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SCHEMAS = {
  tenant: {
    required: ['id', 'name', 'type', 'subscriptionTier', 'subscriptionStatus', 'maxAuditors', 'maxAuditsPerMonth', 'settings', 'createdAt', 'updatedAt'],
    enums: {
      type: ['certification_body', 'consultancy', 'enterprise'],
      subscriptionTier: ['starter', 'professional', 'enterprise'],
      subscriptionStatus: ['active', 'trialing', 'past_due', 'canceled'],
    },
    timestamps: ['createdAt', 'updatedAt'],
    isoDates: [],
  },
  user: {
    required: ['id', 'tenantId', 'email', 'displayName', 'role', 'qualifications', 'clientIds', 'isActive', 'createdAt'],
    enums: { role: ['super_admin', 'tenant_admin', 'lead_auditor', 'auditor', 'auditee', 'viewer'] },
    timestamps: ['createdAt'],
    isoDates: [],
  },
  client: {
    required: ['id', 'tenantId', 'organizationName', 'industry', 'address', 'contactName', 'contactEmail', 'contactPhone', 'numberOfEmployees', 'numberOfSites', 'sites', 'certificationStatus', 'auditHistory', 'createdAt', 'updatedAt'],
    enums: { certificationStatus: ['not_certified', 'certified', 'expired', 'suspended'] },
    timestamps: ['createdAt', 'updatedAt'],
    isoDates: ['certificationExpiry'],
  },
  audit: {
    required: ['id', 'tenantId', 'clientId', 'auditNumber', 'auditType', 'auditStage', 'standard', 'scope', 'status', 'leadAuditorId', 'auditTeam', 'managementRepresentativeName', 'plannedStartDate', 'plannedEndDate', 'auditDays', 'sitesInScope', 'auditPlan', 'findings', 'confidentiality', 'createdAt', 'updatedAt'],
    enums: {
      auditType: ['initial_certification', 'surveillance', 'recertification', 'internal', 'special'],
      auditStage: ['stage_1', 'stage_2', 'not_applicable'],
      status: ['planned', 'in_progress', 'findings_review', 'report_pending', 'report_issued', 'closed', 'canceled'],
      standard: ['ISO 45001:2018'],
      confidentiality: ['standard', 'restricted'],
    },
    timestamps: ['createdAt', 'updatedAt', 'completedAt', 'reportIssuedAt'],
    isoDates: ['plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate'],
  },
  finding: {
    required: ['id', 'auditId', 'tenantId', 'clientId', 'findingNumber', 'type', 'clauseNumber', 'clauseTitle', 'requirement', 'title', 'objectiveEvidence', 'nonconformityStatement', 'evidenceIds', 'raisedByAuditorId', 'raisedByAuditorName', 'raisedAt', 'status', 'updatedAt'],
    enums: {
      type: ['major_nc', 'minor_nc', 'ofi', 'strong_point', 'observation'],
      severity: ['major', 'minor'],
      status: ['open', 'acknowledged', 'ca_submitted', 'ca_review', 'closed', 'overdue'],
      correctiveActionStatus: ['pending', 'in_progress', 'submitted', 'accepted', 'rejected', 'closed'],
    },
    timestamps: ['raisedAt', 'updatedAt', 'acknowledgedAt', 'closedAt'],
    isoDates: ['targetClosureDate', 'actualClosureDate'],
  },
  clauseAssessment: {
    required: ['id', 'auditId', 'tenantId', 'clauseNumber', 'clauseTitle', 'assignedAuditorId', 'conformityStatus', 'score', 'auditorNotes', 'evidenceIds', 'findingIds', 'subClauseNotes', 'isComplete', 'updatedAt'],
    enums: { conformityStatus: ['conforming', 'major_nc', 'minor_nc', 'not_audited', 'not_applicable'] },
    timestamps: ['updatedAt', 'completedAt'],
    isoDates: [],
  },
  correctiveAction: {
    required: ['id', 'tenantId', 'clientId', 'auditId', 'findingId', 'caNumber', 'title', 'rootCauseMethod', 'rootCauseAnalysis', 'immediateAction', 'correctiveAction', 'preventiveAction', 'effectivenessCheck', 'responsiblePersonName', 'responsiblePersonEmail', 'targetDate', 'closureEvidenceIds', 'status', 'history', 'createdAt', 'updatedAt'],
    enums: {
      rootCauseMethod: ['five_why', '8d', 'fishbone', 'free_form'],
      status: ['pending', 'in_progress', 'submitted', 'accepted', 'rejected', 'closed'],
      effectivenessResult: ['effective', 'not_effective'],
    },
    timestamps: ['createdAt', 'updatedAt'],
    isoDates: ['targetDate', 'submittedDate', 'reviewedDate', 'closedDate', 'effectivenessCheckDate'],
  },
};

function validateDoc(kind, doc, label, errors) {
  const schema = SCHEMAS[kind];
  for (const field of schema.required) {
    if (doc[field] === undefined) errors.push(`${label}: missing required field '${field}'`);
  }
  for (const [field, allowed] of Object.entries(schema.enums)) {
    const value = doc[field];
    if (value !== undefined && !allowed.includes(value)) {
      errors.push(`${label}: ${field}='${value}' is not one of ${allowed.join('|')}`);
    }
  }
  for (const field of schema.timestamps) {
    const value = doc[field];
    if (value !== undefined && typeof value?.toDate !== 'function') {
      errors.push(`${label}: ${field} must be a Firestore Timestamp, got ${typeof value}`);
    }
  }
  for (const field of schema.isoDates) {
    const value = doc[field];
    if (value !== undefined && !(typeof value === 'string' && ISO_DATE.test(value))) {
      errors.push(`${label}: ${field} must be a yyyy-mm-dd string, got ${JSON.stringify(value)}`);
    }
  }
  for (const [field, value] of Object.entries(doc)) {
    if (value === undefined) errors.push(`${label}: field '${field}' is undefined (Firestore rejects undefined)`);
  }
}

/** Cross-document referential integrity — the demo must hang together. */
function validateAll({ tenant, users, clients, audits, findings, clauseAssessments, correctiveActions }) {
  const errors = [];
  validateDoc('tenant', tenant, 'tenant', errors);
  users.forEach((u) => validateDoc('user', u, `user ${u.id}`, errors));
  clients.forEach((c) => validateDoc('client', c, `client ${c.id}`, errors));
  audits.forEach((a) => validateDoc('audit', a, `audit ${a.auditNumber}`, errors));
  findings.forEach((f) => validateDoc('finding', f, `finding ${f.findingNumber}`, errors));
  clauseAssessments.forEach((c) => validateDoc('clauseAssessment', c, `clause ${c.id}`, errors));
  correctiveActions.forEach((ca) => validateDoc('correctiveAction', ca, `CA ${ca.caNumber}`, errors));

  const clientIds = new Set(clients.map((c) => c.id));
  const auditIds = new Set(audits.map((a) => a.id));
  const findingIds = new Set(findings.map((f) => f.id));
  const userIds = new Set(users.map((u) => u.id));

  for (const a of audits) {
    if (!clientIds.has(a.clientId)) errors.push(`audit ${a.auditNumber}: unknown clientId ${a.clientId}`);
    if (!userIds.has(a.leadAuditorId)) errors.push(`audit ${a.auditNumber}: unknown leadAuditorId ${a.leadAuditorId}`);
    const siteIds = new Set(clients.find((c) => c.id === a.clientId)?.sites.map((s) => s.siteId) ?? []);
    for (const s of a.sitesInScope) {
      if (!siteIds.has(s)) errors.push(`audit ${a.auditNumber}: sitesInScope references unknown site ${s}`);
    }
  }
  for (const f of findings) {
    if (!auditIds.has(f.auditId)) errors.push(`finding ${f.findingNumber}: unknown auditId`);
    if (!clientIds.has(f.clientId)) errors.push(`finding ${f.findingNumber}: unknown clientId`);
    if ((f.type === 'major_nc' || f.type === 'minor_nc') && f.severity === undefined) {
      errors.push(`finding ${f.findingNumber}: NC without a severity`);
    }
    if (f.type !== 'major_nc' && f.type !== 'minor_nc' && f.severity !== undefined) {
      errors.push(`finding ${f.findingNumber}: severity set on a non-NC finding`);
    }
  }
  const findingById = new Map(findings.map((f) => [f.id, f]));
  for (const ca of correctiveActions) {
    if (!auditIds.has(ca.auditId)) errors.push(`CA ${ca.caNumber}: unknown auditId`);
    const parent = findingById.get(ca.findingId);
    if (parent === undefined) {
      errors.push(`CA ${ca.caNumber}: unknown findingId ${ca.findingId}`);
      continue;
    }
    // A CA filed against a different audit/client than its own finding would
    // surface on the wrong screen — cheap to get wrong, very visible in a demo.
    if (parent.auditId !== ca.auditId) {
      errors.push(`CA ${ca.caNumber}: auditId ${ca.auditId} does not match finding ${parent.findingNumber} (${parent.auditId})`);
    }
    if (parent.clientId !== ca.clientId) {
      errors.push(`CA ${ca.caNumber}: clientId ${ca.clientId} does not match finding ${parent.findingNumber} (${parent.clientId})`);
    }
    // The finding's denormalized CA status must agree with the CA itself.
    if (parent.correctiveActionStatus !== undefined && parent.correctiveActionStatus !== ca.status) {
      errors.push(`CA ${ca.caNumber}: status '${ca.status}' disagrees with finding ${parent.findingNumber}.correctiveActionStatus '${parent.correctiveActionStatus}'`);
    }
  }
  for (const c of clauseAssessments) {
    if (!auditIds.has(c.auditId)) errors.push(`clause ${c.id}: unknown auditId`);
    if (getClauseByNumber(c.clauseNumber) === undefined) errors.push(`clause ${c.id}: ${c.clauseNumber} not in the ISO 45001 dataset`);
    if (typeof c.score !== 'number' || c.score < 0 || c.score > 100) errors.push(`clause ${c.id}: score out of range (${c.score})`);
    for (const fid of c.findingIds) {
      if (!findingIds.has(fid)) errors.push(`clause ${c.id}: findingIds references unknown ${fid}`);
    }
  }

  // Denormalized counts on the audit must match the findings actually seeded.
  for (const a of audits) {
    const own = findings.filter((f) => f.auditId === a.id);
    const expected = computeFindingsSummary(own);
    for (const [k, v] of Object.entries(expected)) {
      if (a.findings[k] !== v) errors.push(`audit ${a.auditNumber}: findings.${k} is ${a.findings[k]}, expected ${v}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Firestore / Auth writes
// ---------------------------------------------------------------------------

async function deleteCollectionDeep(db, ref, log) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const subs = await doc.ref.listCollections();
    for (const sub of subs) {
      await deleteCollectionDeep(db, sub, log);
    }
    await doc.ref.delete();
  }
  if (snap.size > 0) log(`  deleted ${snap.size} from ${ref.path}`);
}

async function wipe(db, auth, tenantId, emails, log) {
  log(`Wiping tenant ${tenantId} …`);
  const tenantRef = db.doc(`tenants/${tenantId}`);
  for (const sub of await tenantRef.listCollections()) {
    await deleteCollectionDeep(db, sub, log);
  }
  await tenantRef.delete().catch(() => {});
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      log(`  deleted auth user ${email}`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }
}

async function ensureAuthUser(auth, { uid, email, password, displayName }, log) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName, emailVerified: true });
    log(`  auth user updated: ${email} (${existing.uid})`);
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({ uid, email, password, displayName, emailVerified: true });
    log(`  auth user created: ${email} (${created.uid})`);
    return created.uid;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(String(await import('node:fs').then((fs) => fs.readFileSync(new URL(import.meta.url), 'utf8')))
      .split('\n').filter((l) => l.startsWith(' *') || l.startsWith('/**')).join('\n'));
    return;
  }
  const log = (msg) => console.log(msg);

  if (opts.emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    log(`Targeting EMULATORS (firestore ${process.env.FIRESTORE_EMULATOR_HOST}, auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST})`);
  } else {
    log(`Targeting LIVE project: ${opts.project}`);
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS === undefined) {
      log('  (no GOOGLE_APPLICATION_CREDENTIALS — falling back to Application Default Credentials)');
    }
  }

  admin.initializeApp({ projectId: opts.project });
  const db = admin.firestore();
  const auth = admin.auth();
  const tenantId = opts.tenantId;

  // ---- assemble -----------------------------------------------------------
  const audits = buildAudits(tenantId);
  const auditsByKey = new Map(audits.map((a) => [a.key, a]));
  const findings = buildFindings(tenantId, auditsByKey);
  const findingsById = new Map(findings.map((f) => [f.id, f]));
  const correctiveActions = buildCorrectiveActions(tenantId, auditsByKey, findingsById);

  const findingsByAudit = new Map();
  for (const f of findings) {
    const list = findingsByAudit.get(f.auditId) ?? [];
    list.push(f);
    findingsByAudit.set(f.auditId, list);
  }

  const clauseAssessments = audits.flatMap((audit) =>
    buildClauseAssessments(tenantId, audit, findingsByAudit.get(audit.id) ?? []),
  );

  const now = ts(TODAY);
  const tenantDoc = buildTenantDoc(tenantId, now);
  const userDocs = buildUserDocs(tenantId, opts.email);
  const clientDocs = buildClientDocs(tenantId, audits, now);
  const auditDocs = audits.map((a) => buildAuditDoc(tenantId, a, findingsByAudit.get(a.id) ?? [], now));

  const errors = validateAll({
    tenant: tenantDoc, users: userDocs, clients: clientDocs, audits: auditDocs,
    findings, clauseAssessments, correctiveActions,
  });
  if (errors.length > 0) {
    console.error(`\nValidation failed — ${errors.length} problem(s), nothing written:\n`);
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }
  log('Validation passed: all documents conform to the core types and cross-reference correctly.');

  if (opts.dryRun) {
    log('\nDRY RUN — nothing written.');
    log(`  tenant             1  (${tenantId})`);
    log(`  users              ${userDocs.length}`);
    log(`  clients            ${clientDocs.length}`);
    log(`  audits             ${auditDocs.length}`);
    log(`  findings           ${findings.length}`);
    log(`  correctiveActions  ${correctiveActions.length}`);
    log(`  clauseAssessments  ${clauseAssessments.length}`);
    return;
  }

  if (opts.wipe) {
    await wipe(db, auth, tenantId, [opts.email], log);
  }

  // ---- auth + claims ------------------------------------------------------
  log('\nAuth:');
  const uid = await ensureAuthUser(auth, {
    uid: PEOPLE.admin.id, email: opts.email, password: opts.password, displayName: PEOPLE.admin.name,
  }, log);

  const claims = {
    tenantId,
    tenantType: TENANT.claimType,
    role: PEOPLE.admin.role,
    permissions: [...ROLE_PERMISSIONS[PEOPLE.admin.role]],
  };
  await auth.setCustomUserClaims(uid, claims);
  log(`  claims minted: role=${claims.role} tenantId=${claims.tenantId} (${claims.permissions.length} permissions)`);

  // ---- firestore ----------------------------------------------------------
  log('\nFirestore:');
  let batch = db.batch();
  let queued = 0;
  const commitIfFull = async () => {
    if (queued >= 400) { await batch.commit(); batch = db.batch(); queued = 0; }
  };
  const put = async (path, data) => {
    batch.set(db.doc(path), data);
    queued += 1;
    await commitIfFull();
  };

  await put(`tenants/${tenantId}`, tenantDoc);

  for (const user of userDocs) {
    await put(`tenants/${tenantId}/users/${user.id}`, user);
  }
  log(`  users              ${userDocs.length}`);

  for (const client of clientDocs) {
    await put(`tenants/${tenantId}/clients/${client.id}`, client);
  }
  log(`  clients            ${clientDocs.length}`);

  for (const audit of auditDocs) {
    await put(`tenants/${tenantId}/audits/${audit.id}`, audit);
  }
  log(`  audits             ${auditDocs.length}`);

  for (const f of findings) {
    await put(`tenants/${tenantId}/audits/${f.auditId}/findings/${f.id}`, f);
  }
  log(`  findings           ${findings.length}`);

  for (const c of clauseAssessments) {
    await put(`tenants/${tenantId}/audits/${c.auditId}/clauses/${c.id}`, c);
  }
  log(`  clauseAssessments  ${clauseAssessments.length}`);

  for (const ca of correctiveActions) {
    await put(`tenants/${tenantId}/correctiveActions/${ca.id}`, ca);
  }
  log(`  correctiveActions  ${correctiveActions.length}`);

  if (queued > 0) await batch.commit();

  // ---- summary ------------------------------------------------------------
  log('\n─────────────────────────────────────────────');
  log('Demo tenant ready.');
  log(`  URL       https://soteria-assurance-web.vercel.app/login`);
  log(`  Email     ${opts.email}`);
  log(`  Password  ${opts.password}`);
  log('');
  log('  If sign-in fails with auth/unauthorized-domain, add the host in');
  log('  Firebase Console → Authentication → Settings → Authorized domains.');
  log('─────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  if (err.code !== undefined) console.error('  code:', err.code);
  process.exit(1);
});
