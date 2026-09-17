#!/usr/bin/env node
/**
 * Seeds a reviewable DEMO tenant into the LOCAL Supabase stack.
 *
 * WHY THIS EXISTS
 * ---------------
 * `supabase/seed.sql` is empty and `scripts/seed-demo.mjs` still targets the
 * old Firebase backend, so a freshly reset local stack has no data at all.
 * Worse, the product currently has NO UI path that inserts a `clients` row
 * (see the ISO 45001 audit, MNC "client organization cannot be created"), so a
 * reviewer cannot create one by hand either — the New Audit wizard requires a
 * client and its dropdown would be permanently empty.
 *
 * This script writes, with the service-role key, what the product cannot yet
 * write itself: a tenant, users at several roles, two client organizations, a
 * part-complete ISO 45001 audit with clause assessments, findings across all
 * four grades, and a corrective action mid-workflow.
 *
 * IT IS A REVIEW FIXTURE, NOT A FIX. The missing create/edit paths are still
 * missing; this only makes the screens that DO exist reviewable.
 *
 * Everything is derived from fixed UUIDs, so re-running refreshes in place
 * rather than duplicating. `--wipe` deletes the demo tenant first.
 *
 * USAGE
 *   export SUPABASE_URL=http://127.0.0.1:54521
 *   export SUPABASE_SERVICE_ROLE_KEY=<local service_role key from `supabase status`>
 *   node scripts/seed-local-demo.mjs
 *
 * FLAGS
 *   --wipe            Delete the demo tenant and its auth users, then reseed
 *   --password <pw>   Password for every demo login (default: SoteriaDemo!2026)
 */
import process from 'node:process';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

// Fixed ids keep the seed idempotent and make rows easy to find in Studio.
const T = '11111111-1111-4111-8111-111111111111'; // tenant
const CLIENT_A = '22222222-2222-4222-8222-222222222221';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const AUDIT = '33333333-3333-4333-8333-333333333331';
const F = (n) => `44444444-4444-4444-8444-44444444444${n}`;
const CA = '55555555-5555-4555-8555-555555555551';

const USERS = [
  { key: 'lead',  email: 'lead@soteria.demo',    name: 'Dana Okafor',   role: 'lead_auditor' },
  { key: 'admin', email: 'admin@soteria.demo',   name: 'Priya Raman',   role: 'tenant_admin' },
  { key: 'aud',   email: 'auditor@soteria.demo', name: 'Marcus Webb',   role: 'auditor' },
  { key: 'ee',    email: 'auditee@soteria.demo', name: 'Sam Lindqvist', role: 'auditee' },
  { key: 'view',  email: 'viewer@soteria.demo',  name: 'Jo Adeyemi',    role: 'viewer' },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? (i += 1, next) : 'true';
  }
  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Fails closed on anything that is not the local Docker stack. */
function requireLocalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return fail(`SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    fail(
      `Refusing to run against "${parsed.host}". This seeds demo data with the ` +
        'service-role key and is local-only.',
    );
  }
  return parsed.origin;
}

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = requireLocalUrl(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54521');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    fail('SUPABASE_SERVICE_ROLE_KEY is not set. Read it from `supabase status`.');
  }
  const password = args.password ?? 'SoteriaDemo!2026';

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  async function api(path, init = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
    }
    return body;
  }

  /** PostgREST upsert: insert, or overwrite the row with the same primary key. */
  const upsert = (table, rows) =>
    api(`/rest/v1/${table}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });

  async function findUserIdByEmail(address) {
    for (let page = 1; page <= 20; page += 1) {
      const result = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
      const users = result.users ?? [];
      const match = users.find((u) => u.email?.toLowerCase() === address);
      if (match) return match.id;
      if (users.length < 200) return null;
    }
    return null;
  }

  // -- wipe ------------------------------------------------------------------
  if (args.wipe === 'true') {
    for (const u of USERS) {
      const id = await findUserIdByEmail(u.email);
      if (id) await api(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }
    // Everything else cascades from the tenant.
    await api(`/rest/v1/tenants?id=eq.${T}`, { method: 'DELETE' });
    console.log('  wiped previous demo tenant');
  }

  // -- 1. tenant -------------------------------------------------------------
  await upsert('tenants', [
    {
      id: T,
      name: 'Meridian Certification Services',
      type: 'certification_body',
      subscription_tier: 'professional',
      subscription_status: 'active',
      max_auditors: 25,
      max_audits_per_month: 50,
      enabled_standards: ['iso45001'],
    },
  ]);
  console.log('  tenant');

  // -- 2. users + profiles ---------------------------------------------------
  const ids = {};
  for (const u of USERS) {
    let id = await findUserIdByEmail(u.email);
    if (!id) {
      const created = await api('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: u.email, password, email_confirm: true }),
      });
      id = created.id;
    } else {
      await api(`/auth/v1/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ password, email_confirm: true }),
      });
    }
    ids[u.key] = id;
    await upsert('profiles', [
      {
        id,
        tenant_id: T,
        email: u.email,
        display_name: u.name,
        role: u.role,
        is_active: true,
        onboarded_at: new Date().toISOString(),
      },
    ]);
  }
  console.log(`  ${USERS.length} users + profiles`);

  // -- 3. clients ------------------------------------------------------------
  await upsert('clients', [
    {
      id: CLIENT_A,
      tenant_id: T,
      organization_name: 'Northgate Steel Fabrication Ltd',
      industry: 'Metal fabrication',
      address: { line1: 'Unit 7, Northgate Industrial Estate', city: 'Sheffield', country: 'UK' },
      contact_name: 'Sam Lindqvist',
      contact_email: 'auditee@soteria.demo',
      contact_phone: '+44 114 496 0122',
      number_of_employees: 240,
      number_of_sites: 2,
      sites: [
        { name: 'Sheffield Works', city: 'Sheffield', employees: 180 },
        { name: 'Rotherham Finishing', city: 'Rotherham', employees: 60 },
      ],
      certification_status: 'certified',
      certification_body: 'Meridian Certification Services',
      certification_expiry: isoDate(420),
    },
    {
      id: CLIENT_B,
      tenant_id: T,
      organization_name: 'Harbour Logistics Group',
      industry: 'Warehousing and distribution',
      address: { line1: '14 Dockside Way', city: 'Felixstowe', country: 'UK' },
      contact_name: 'Ellen Mbeki',
      contact_email: 'ellen@harbourlogistics.demo',
      contact_phone: '+44 1394 555 108',
      number_of_employees: 95,
      number_of_sites: 1,
      sites: [{ name: 'Felixstowe DC', city: 'Felixstowe', employees: 95 }],
      certification_status: 'not_certified',
      // PostgREST bulk insert requires every object in the array to carry the
      // same keys, so these are present-but-null rather than omitted.
      certification_body: null,
      certification_expiry: null,
    },
  ]);
  console.log('  2 clients');

  // -- 4. audit --------------------------------------------------------------
  await upsert('audits', [
    {
      id: AUDIT,
      tenant_id: T,
      client_id: CLIENT_A,
      audit_number: 'AUD-2026-0041',
      audit_type: 'surveillance',
      audit_stage: 'not_applicable',
      standard_id: 'iso45001',
      scope:
        'Occupational health & safety management system covering structural steel fabrication, ' +
        'welding, surface finishing and despatch at the Sheffield Works and Rotherham Finishing sites.',
      status: 'in_progress',
      lead_auditor_id: ids.lead,
      audit_team: [
        { userId: ids.lead, displayName: 'Dana Okafor', role: 'lead_auditor', clauseAssignments: ['4', '5', '6'] },
        { userId: ids.aud, displayName: 'Marcus Webb', role: 'auditor', clauseAssignments: ['7', '8', '9', '10'] },
      ],
      management_representative_name: 'Sam Lindqvist',
      planned_start_date: isoDate(-3),
      planned_end_date: isoDate(-1),
      actual_start_date: isoDate(-3),
      audit_days: 3,
      audit_plan: {
        activities: [
          { day: 1, time: '09:00', activity: 'Opening meeting', clauses: [], location: 'Sheffield Works — Boardroom' },
          { day: 1, time: '09:30', activity: 'Leadership and worker participation interviews', clauses: ['5.1', '5.4'], location: 'Sheffield Works' },
          { day: 1, time: '13:30', activity: 'Hazard identification and risk assessment review', clauses: ['6.1.2', '6.1.2.1', '6.1.2.2'], location: 'Sheffield Works — OH&S office' },
          { day: 2, time: '09:00', activity: 'Shop floor observation — welding and finishing', clauses: ['8.1', '8.1.2'], location: 'Sheffield Works — Bay 3' },
          { day: 2, time: '14:00', activity: 'Emergency preparedness walkthrough', clauses: ['8.2'], location: 'Rotherham Finishing' },
          { day: 3, time: '09:00', activity: 'Performance evaluation and management review records', clauses: ['9.1', '9.2', '9.3'], location: 'Sheffield Works' },
          { day: 3, time: '15:00', activity: 'Closing meeting', clauses: [], location: 'Sheffield Works — Boardroom' },
        ],
        documentReviewList: [
          'OH&S policy (rev 6)',
          'Hazard register and risk assessment methodology',
          'Legal register and compliance evaluation',
          'Internal audit programme and reports',
          'Management review minutes',
          'Incident and near-miss records, last 12 months',
        ],
        intervieweeList: [
          { name: 'Sam Lindqvist', role: 'OH&S Manager', clauses: ['5.1', '6.1', '9.3'] },
          { name: 'Rob Traynor', role: 'Production Supervisor', clauses: ['7.2', '8.1'] },
          { name: 'Amira Haddad', role: 'Safety Representative', clauses: ['5.4', '7.4'] },
        ],
        areaInspectionList: ['Welding Bay 3', 'Surface finishing line', 'Despatch yard', 'Rotherham paint shop'],
      },
      findings: {},
      confidentiality: 'standard',
    },
  ]);
  console.log('  1 audit (in_progress, with a full plan)');

  // -- 5. clause assessments -------------------------------------------------
  const assess = (n, number, title, status, score, notes, complete = true) => ({
    id: `66666666-6666-4666-8666-6666666666${String(n).padStart(2, '0')}`,
    tenant_id: T,
    audit_id: AUDIT,
    standard_id: 'iso45001',
    clause_number: number,
    clause_title: title,
    assigned_auditor_id: ids.lead,
    conformity_status: status,
    score,
    auditor_notes: notes,
    sub_clause_notes: {},
    is_complete: complete,
    evidence_ids: [],
    finding_ids: [],
    completed_at: complete ? new Date().toISOString() : null,
  });

  await upsert('clause_assessments', [
    assess(1, '4.1', 'Understanding the organization and its context', 'conforming', 100,
      'Context analysis reviewed (rev 4, dated this year). Covers legal, market, technological and workforce factors. Refreshed after the Rotherham acquisition.'),
    assess(2, '5.1', 'Leadership and commitment', 'conforming', 100,
      'MD interviewed. Able to describe OH&S objectives without prompting and chairs the monthly safety committee. Attendance records corroborate.'),
    assess(3, '5.4', 'Consultation and participation of workers', 'minor_nc', 60,
      'Safety committee is active, but two of three non-managerial representatives were appointed by management rather than elected by the workers they represent. Raised as NC.'),
    assess(4, '6.1.2.1', 'Hazard identification', 'major_nc', 20,
      'Hazard register covers physical hazards only. No psychosocial or work-organization hazards identified anywhere, despite two stress-related absence cases in the last 12 months. Raised as MNC.'),
    assess(5, '6.1.2.2', 'Assessment of OH&S risks and other risks to the OH&S management system', 'conforming', 90,
      'Documented 5x5 methodology applied consistently across sampled assessments. Residual risk recorded after existing controls.'),
    assess(6, '7.2', 'Competence', 'conforming', 100,
      'Welder and FLT competence records sampled (8 of 34). All current; renewal tracker in place.'),
    assess(7, '8.1.2', 'Eliminating hazards and reducing OH&S risks', 'conforming', 80,
      'Hierarchy of controls applied. Note the finishing line still relies on RPE where local exhaust ventilation was specified in the 2025 improvement plan — recorded as OFI.'),
    assess(8, '8.2', 'Emergency preparedness and response', 'conforming', 95,
      'Two drills in the last 12 months, both documented with debrief actions closed. Rotherham drill included the contractor workforce.'),
    assess(9, '9.2', 'Internal audit', 'conforming', 100,
      'Programme covers all clauses across the 3-year cycle. Auditor independence demonstrated. Strong point recorded for the trend analysis pack.'),
    assess(10, '9.3', 'Management review', 'conforming', 90,
      'Reviewed minutes from the last two reviews. All required inputs present including compliance evaluation and worker consultation. Outputs carry owners and dates.'),
    assess(11, '10.2', 'Incident, nonconformity and corrective action', 'minor_nc', 60,
      'Corrective actions raised and closed, but effectiveness review is signed the same day as implementation in 4 of 6 sampled cases. Raised as NC.'),
    assess(12, '7.4.2', 'Internal communication', 'not_audited', 0, '', false),
  ]);
  console.log('  12 clause assessments');

  // -- 6. findings -----------------------------------------------------------
  const finding = (n, num, type, severity, clause, clauseTitle, requirement, title, evidence, statement, status, target) => ({
    id: F(n),
    tenant_id: T,
    audit_id: AUDIT,
    client_id: CLIENT_A,
    finding_number: num,
    type,
    severity,
    clause_number: clause,
    clause_title: clauseTitle,
    requirement,
    title,
    objective_evidence: evidence,
    nonconformity_statement: statement,
    evidence_ids: [],
    raised_by_auditor_id: ids.lead,
    raised_by_auditor_name: 'Dana Okafor',
    raised_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    status,
    target_closure_date: target,
  });

  await upsert('findings', [
    finding(1, 'MNC-2026-0001', 'major_nc', 'major', '6.1.2.1', 'Hazard identification',
      'The organization must establish ongoing, proactive processes for hazard identification that take account of social factors including workload, work hours, victimization, harassment and bullying, as well as how work is organized.',
      'Psychosocial and work-organization hazards are not identified',
      'The hazard register (HR-01 rev 9, sampled in full) contains 214 entries, all physical or chemical. The OH&S Manager confirmed in interview that workload, work hours, harassment and bullying have never been assessed as hazards. Occupational health referrals for 2 stress-related absence cases in the preceding 12 months were sighted, neither of which triggered a hazard review.',
      'The organization has not established a process for the identification of psychosocial and work-organization hazards, contrary to the requirement that hazard identification take account of social factors and how work is organized.',
      'open', isoDate(58)),
    finding(2, 'NC-2026-0002', 'minor_nc', 'minor', '5.4', 'Consultation and participation of workers',
      'The organization must ensure consultation and participation of non-managerial workers, including determining their representatives without undue influence from management.',
      'Two worker representatives were appointed by management',
      'Safety committee terms of reference (TOR-3) and the appointment emails for representatives for the Finishing and Despatch areas, both dated 14 February, sent by the Production Manager. The Sheffield Works representative was elected by ballot; records sighted.',
      'For two of three areas, non-managerial worker representatives were appointed by management rather than determined by the workers themselves.',
      'ca_submitted', isoDate(88)),
    finding(3, 'NC-2026-0003', 'minor_nc', 'minor', '10.2', 'Incident, nonconformity and corrective action',
      'The organization must review the effectiveness of any corrective action taken.',
      'Corrective action effectiveness reviewed on the day of implementation',
      'Corrective action records CA-2025-014, -019, -022 and -027. In each case the "effectiveness verified" field is signed by the OH&S Manager with the same date as the implementation entry, with no interval over which effectiveness could be observed.',
      'In four of six sampled corrective actions, the effectiveness review was recorded on the date of implementation, so effectiveness was not reviewed.',
      'open', isoDate(88)),
    finding(4, 'OFI-2026-0004', 'ofi', null, '8.1.2', 'Eliminating hazards and reducing OH&S risks',
      'The organization must apply a hierarchy of controls, preferring elimination and engineering controls over personal protective equipment.',
      'Finishing line still relies on RPE where LEV was planned',
      'The 2025 OH&S improvement plan item 7 specifies local exhaust ventilation for the finishing line by Q3. Observation on day 2 found operators using half-mask RPE; the LEV installation is recorded as deferred on budget grounds.',
      'Conformant — the control is effective and RPE use was correct. The organization is encouraged to reinstate the planned engineering control, which sits higher in the hierarchy than the PPE currently relied upon.',
      'open', null),
    finding(5, 'SP-2026-0005', 'strong_point', null, '9.2', 'Internal audit',
      'The organization must conduct internal audits at planned intervals to provide information on whether the OH&S management system conforms and is effectively implemented.',
      'Internal audit trend analysis is genuinely decision-useful',
      'Internal audit programme IA-2026 and the quarterly trend pack presented to the management review. The pack tracks repeat findings by clause across three years and explicitly flags 7.2 as a recurring weakness, which drove the competence tracker introduced this year.',
      'Strong point. The internal audit function produces trend analysis that demonstrably changes management decisions, which is materially beyond the requirement.',
      'closed', null),
  ]);
  console.log('  5 findings (MNC / NC / NC / OFI / SP)');

  // -- 7. corrective action --------------------------------------------------
  await upsert('corrective_actions', [
    {
      id: CA,
      tenant_id: T,
      client_id: CLIENT_A,
      audit_id: AUDIT,
      finding_id: F(2),
      ca_number: 'CA-2026-0002',
      title: 'Re-determine worker representatives by ballot in Finishing and Despatch',
      root_cause_method: 'five_why',
      root_cause_analysis:
        'Why were representatives appointed? Because the areas had no nominations by the deadline. '
        + 'Why no nominations? Because the call was issued by email only. Why email only? Because the '
        + 'TOR does not specify how the call must reach shift workers. Why not? Because the TOR was '
        + 'written for office-based staff. Root cause: the consultation procedure does not define a '
        + 'nomination route that reaches non-office workers.',
      immediate_action:
        'Both appointed representatives stood down from formal representative duties on 3 March pending election.',
      corrective_action:
        'TOR-3 revised to require a nomination call by toolbox talk and notice board in every area, with a '
        + '10-working-day window, followed by secret ballot where nominations exceed vacancies. Ballot for '
        + 'Finishing and Despatch scheduled.',
      preventive_action:
        'Annual review of TOR-3 added to the OH&S calendar. The same nomination route will be applied to the '
        + 'Rotherham site at its next cycle.',
      effectiveness_check:
        'Verify at the next surveillance that representatives in all areas hold a ballot record, and that '
        + 'committee minutes show non-managerial representatives raising items.',
      responsible_person_name: 'Sam Lindqvist',
      responsible_person_email: 'auditee@soteria.demo',
      target_date: isoDate(88),
      submitted_date: isoDate(-1),
      status: 'submitted',
      closure_evidence_ids: [],
      history: [
        { at: new Date(Date.now() - 86400000).toISOString(), by: 'Sam Lindqvist', action: 'submitted', note: 'Root cause and action plan submitted for review.' },
      ],
      reminder_count: 0,
    },
  ]);
  console.log('  1 corrective action (submitted, awaiting effectiveness review)');

  // -- 8. meetings -----------------------------------------------------------
  await upsert('meetings', [
    {
      id: '77777777-7777-4777-8777-777777777771',
      tenant_id: T,
      audit_id: AUDIT,
      type: 'opening',
      scheduled_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      location: 'Sheffield Works — Boardroom',
      is_virtual: false,
      attendees: [
        { attendeeId: 'a1', name: 'Dana Okafor', jobTitle: 'Lead Auditor', organization: 'Meridian Certification Services', role: 'auditor', isPresent: true },
        { attendeeId: 'a2', name: 'Marcus Webb', jobTitle: 'Auditor', organization: 'Meridian Certification Services', role: 'auditor', isPresent: true },
        { attendeeId: 'a3', name: 'Sam Lindqvist', jobTitle: 'OH&S Manager', organization: 'Northgate Steel Fabrication Ltd', role: 'auditee', isPresent: true },
        { attendeeId: 'a4', name: 'Amira Haddad', jobTitle: 'Safety Representative', organization: 'Northgate Steel Fabrication Ltd', role: 'auditee', isPresent: true },
        { attendeeId: 'a5', name: 'Rob Traynor', jobTitle: 'Production Supervisor', organization: 'Northgate Steel Fabrication Ltd', role: 'auditee', isPresent: false },
      ],
      agenda_items: [],
      action_items: [],
      signature_urls: [],
      key_decisions: [
        'Audit plan confirmed; no changes requested by the auditee.',
        'Rotherham Finishing to be visited on day 2 as planned.',
        'Confidentiality and the complaints/appeals process confirmed with the auditee.',
      ],
      // Present-but-null so both rows carry identical keys; only a closing
      // meeting presents a findings summary.
      findings_summary_presented: null,
      status: 'completed',
      notes:
        'Scope, criteria, methods and the audit plan were confirmed. Sampling and its '
        + 'limitations explained. Safety induction completed for both auditors. Production '
        + 'Supervisor absent; interview rescheduled to day 2.',
    },
    {
      id: '77777777-7777-4777-8777-777777777772',
      tenant_id: T,
      audit_id: AUDIT,
      type: 'closing',
      scheduled_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      location: 'Sheffield Works — Boardroom',
      is_virtual: false,
      attendees: [
        { attendeeId: 'b1', name: 'Dana Okafor', jobTitle: 'Lead Auditor', organization: 'Meridian Certification Services', role: 'auditor', isPresent: true },
        { attendeeId: 'b2', name: 'Marcus Webb', jobTitle: 'Auditor', organization: 'Meridian Certification Services', role: 'auditor', isPresent: true },
        { attendeeId: 'b3', name: 'Sam Lindqvist', jobTitle: 'OH&S Manager', organization: 'Northgate Steel Fabrication Ltd', role: 'auditee', isPresent: true },
        { attendeeId: 'b4', name: 'Helen Voss', jobTitle: 'Managing Director', organization: 'Northgate Steel Fabrication Ltd', role: 'auditee', isPresent: true },
      ],
      agenda_items: [],
      action_items: [],
      signature_urls: [],
      key_decisions: [
        'All five findings presented and acknowledged by the auditee.',
        'MNC-2026-0001 requires corrective action before a certification decision.',
        'Corrective action plans due within the agreed timeframe.',
      ],
      // The record of what was PRESENTED, not a live join — this is what an
      // accreditation assessor asks to see.
      findings_summary_presented: {
        totalFindings: 5,
        majorNCs: 1,
        minorNCs: 2,
        ofis: 1,
        strongPoints: 1,
        observations: 0,
        closedNCs: 1,
        openNCs: 2,
      },
      status: 'completed',
      notes:
        'Findings presented clause by clause and acknowledged. The Managing Director '
        + 'accepted the major nonconformity on psychosocial hazard identification and '
        + 'committed to a corrective action plan. Sampling limitations restated. Appeals '
        + 'process explained.',
    },
  ]);
  console.log('  2 meetings (opening + closing, with attendance)');

  console.log(`
✔ Demo data seeded.

  Sign in at http://127.0.0.1:3000 with any of these (password: ${password}):

    lead@soteria.demo      Lead auditor   — the main review persona
    admin@soteria.demo     Tenant admin
    auditor@soteria.demo   Auditor
    auditee@soteria.demo   Auditee        — should be read-only (see audit MNC on RBAC)
    viewer@soteria.demo    Viewer         — should be read-only

  Tenant: Meridian Certification Services
  Audit:  AUD-2026-0041 — Northgate Steel Fabrication Ltd (surveillance, in progress)
`);
}

main().catch((error) => fail(error.message));
