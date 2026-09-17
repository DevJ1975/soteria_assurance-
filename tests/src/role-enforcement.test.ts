/**
 * Proves the RBAC matrix is enforced by the DATABASE, not just hidden in the UI.
 *
 * WHY THIS FILE EXISTS
 * Every authorization test in this suite was cross-TENANT: it proved tenant A
 * cannot touch tenant B. None was cross-ROLE — nothing asserted that a
 * `viewer` or an `auditee` is refused a write INSIDE their own tenant. That
 * gap is why every policy on the six business tables shipped tenant-scoped
 * only, and an `auditee` — the organization being audited — could rewrite and
 * delete the findings raised against them over PostgREST while the UI showed
 * them a read-only screen.
 *
 * NOTE ON WHAT FAILURE LOOKS LIKE
 * RLS does not raise on a refused UPDATE or DELETE; it filters the row out, so
 * PostgREST returns success having changed nothing. Asserting on the status
 * code would therefore pass against the vulnerable schema. Every test here
 * reads the row back with the service role and asserts the VALUE, which is the
 * only thing that distinguishes "refused" from "applied".
 */
import { admin, createActor, createTenant, destroyTenant, seedAuditChain } from './helpers/stack';

jest.setTimeout(60_000);

describe('role enforcement within a tenant', () => {
  let tenantId: string;
  let auditId: string;
  let findingId: string;
  let clientId: string;

  beforeAll(async () => {
    tenantId = await createTenant(`Role Enforcement ${Date.now()}`);
    ({ auditId, findingId, clientId } = await seedAuditChain(tenantId));
  });

  afterAll(async () => {
    await destroyTenant(tenantId);
  });

  /** Reads with the service role, bypassing RLS — the ground truth. */
  async function findingStatement(): Promise<string> {
    const { data, error } = await admin
      .from('findings')
      .select('nonconformity_statement')
      .eq('id', findingId)
      .single();
    if (error) throw error;
    return data.nonconformity_statement as string;
  }

  describe.each(['auditee', 'viewer'] as const)('%s', (role) => {
    it('cannot rewrite a finding raised against them', async () => {
      const actor = await createActor(tenantId, role, role);
      const before = await findingStatement();

      await actor.client
        .from('findings')
        .update({ nonconformity_statement: `TAMPERED BY ${role}` })
        .eq('id', findingId);

      expect(await findingStatement()).toBe(before);
    });

    it('cannot delete a finding', async () => {
      const actor = await createActor(tenantId, role, role);

      await actor.client.from('findings').delete().eq('id', findingId);

      const { count } = await admin
        .from('findings')
        .select('id', { count: 'exact', head: true })
        .eq('id', findingId);
      expect(count).toBe(1);
    });

    it('cannot edit the audit', async () => {
      const actor = await createActor(tenantId, role, role);
      const { data: before } = await admin
        .from('audits')
        .select('scope')
        .eq('id', auditId)
        .single();

      await actor.client.from('audits').update({ scope: `edited by ${role}` }).eq('id', auditId);

      const { data: after } = await admin
        .from('audits')
        .select('scope')
        .eq('id', auditId)
        .single();
      expect(after?.scope).toBe(before?.scope);
    });

    it('cannot insert a clause assessment', async () => {
      const actor = await createActor(tenantId, role, role);

      await actor.client.from('clause_assessments').insert({
        tenant_id: tenantId,
        audit_id: auditId,
        clause_number: '6.1.2.1',
        clause_title: 'Hazard identification',
        conformity_status: 'conforming',
        score: 100,
        auditor_notes: `inserted by ${role}`,
        sub_clause_notes: {},
        is_complete: true,
        evidence_ids: [],
        finding_ids: [],
        standard_id: 'iso45001',
      });

      const { count } = await admin
        .from('clause_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('audit_id', auditId)
        .eq('auditor_notes', `inserted by ${role}`);
      expect(count).toBe(0);
    });

    it('can still READ its tenant"s findings', async () => {
      // view_audit_reports is granted to every role. Locking down writes must
      // not have locked down reads.
      const actor = await createActor(tenantId, role, role);
      const { data, error } = await actor.client.from('findings').select('id').eq('id', findingId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe('auditee, specifically', () => {
    it('CAN write its own corrective action', async () => {
      // ISO 45001 clause 10.2 puts the corrective action with the organization,
      // not the auditor. Locking the auditee out of this would be wrong.
      const actor = await createActor(tenantId, 'auditee', 'auditee');
      const { data: ca, error: caError } = await admin
        .from('corrective_actions')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          audit_id: auditId,
          finding_id: findingId,
          ca_number: `CA-ROLE-${Date.now()}`,
          title: 'Auditee writable',
          root_cause_method: 'five_why',
          root_cause_analysis: '',
          immediate_action: '',
          corrective_action: '',
          preventive_action: '',
          effectiveness_check: '',
          responsible_person_name: 'Auditee',
          responsible_person_email: 'auditee@example.test',
          target_date: new Date().toISOString().slice(0, 10),
          closure_evidence_ids: [],
          history: [],
        })
        .select('id')
        .single();
      if (caError) throw caError;

      await actor.client
        .from('corrective_actions')
        .update({ closure_notes: 'submitted by the auditee' })
        .eq('id', ca.id);

      const { data: after } = await admin
        .from('corrective_actions')
        .select('closure_notes')
        .eq('id', ca.id)
        .single();
      expect(after?.closure_notes).toBe('submitted by the auditee');
    });
  });

  describe.each(['lead_auditor', 'auditor'] as const)('%s', (role) => {
    it('CAN edit a finding', async () => {
      const actor = await createActor(tenantId, role, role);

      await actor.client
        .from('findings')
        .update({ area: `set by ${role}` })
        .eq('id', findingId);

      const { data } = await admin
        .from('findings')
        .select('area')
        .eq('id', findingId)
        .single();
      expect(data?.area).toBe(`set by ${role}`);
    });
  });

  describe('retention', () => {
    it('refuses a hard delete of an audit even for a lead auditor', async () => {
      // Destruction of an audit takes its findings, assessments, evidence and
      // corrective actions with it by FK cascade. No role reaches it by API.
      const actor = await createActor(tenantId, 'lead_auditor', 'lead');

      await actor.client.from('audits').delete().eq('id', auditId);

      const { count } = await admin
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .eq('id', auditId);
      expect(count).toBe(1);
    });

    it('hides soft-deleted rows from reads', async () => {
      const { auditId: doomedAudit } = await seedAuditChain(tenantId);
      const actor = await createActor(tenantId, 'lead_auditor', 'lead');

      const before = await actor.client.from('audits').select('id').eq('id', doomedAudit);
      expect(before.data).toHaveLength(1);

      await admin
        .from('audits')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doomedAudit);

      const after = await actor.client.from('audits').select('id').eq('id', doomedAudit);
      expect(after.data).toHaveLength(0);
    });
  });

  describe('lifecycle lock', () => {
    it('freezes findings once the report is issued', async () => {
      const chain = await seedAuditChain(tenantId);
      await admin.from('audits').update({ status: 'report_issued' }).eq('id', chain.auditId);

      const actor = await createActor(tenantId, 'lead_auditor', 'lead');
      const { error } = await actor.client
        .from('findings')
        .update({ area: 'edited after issue' })
        .eq('id', chain.findingId);

      // This one DOES raise: a trigger, not a policy, so the write is rejected
      // rather than filtered.
      expect(error).not.toBeNull();

      const { data } = await admin
        .from('findings')
        .select('area')
        .eq('id', chain.findingId)
        .single();
      expect(data?.area).not.toBe('edited after issue');
    });
  });
});

describe('independence rules (ISO/IEC 17021-1 5.2, 9.5)', () => {
  let tenantId: string;
  let auditId: string;
  let clientId: string;

  beforeAll(async () => {
    tenantId = await createTenant(`Independence ${Date.now()}`);
    ({ auditId, clientId } = await seedAuditChain(tenantId));
  });

  afterAll(async () => {
    await destroyTenant(tenantId);
  });

  it('refuses an auditor reviewing their own impartiality declaration', async () => {
    const auditor = await createActor(tenantId, 'auditor', 'self');
    const { data: declaration, error: insertError } = await admin
      .from('auditor_declarations')
      .insert({
        tenant_id: tenantId,
        audit_id: auditId,
        auditor_id: auditor.user.id,
        auditor_name: 'Self Reviewer',
        competence_statement: 'Competent.',
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { error } = await auditor.client
      .from('auditor_declarations')
      .update({
        reviewed_by: auditor.user.id,
        reviewed_by_name: 'Self Reviewer',
        reviewed_at: new Date().toISOString(),
        review_outcome: 'accepted',
      })
      .eq('id', declaration.id);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/cannot review their own/);
  });

  it('accepts a review by a different team member', async () => {
    const auditor = await createActor(tenantId, 'auditor', 'declarant');
    const lead = await createActor(tenantId, 'lead_auditor', 'reviewer');
    const { data: declaration } = await admin
      .from('auditor_declarations')
      .insert({
        tenant_id: tenantId,
        audit_id: auditId,
        auditor_id: auditor.user.id,
        auditor_name: 'Declarant',
        competence_statement: 'Competent.',
      })
      .select('id')
      .single();

    const { error } = await lead.client
      .from('auditor_declarations')
      .update({
        reviewed_by: lead.user.id,
        reviewed_by_name: 'Reviewer',
        reviewed_at: new Date().toISOString(),
        review_outcome: 'accepted',
      })
      .eq('id', declaration?.id);
    expect(error).toBeNull();
  });

  it('refuses a certification decision by someone on the audit team', async () => {
    const lead = await createActor(tenantId, 'lead_auditor', 'lead-decider');
    const { data: programme, error: programmeError } = await admin
      .from('audit_programmes')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        cycle_start: '2026-01-01',
        cycle_end: '2029-01-01',
      })
      .select('id')
      .single();
    if (programmeError) throw programmeError;

    // Put the would-be decision maker on the cycle's audit team.
    await admin
      .from('audits')
      .update({ programme_id: programme.id, lead_auditor_id: lead.user.id })
      .eq('id', auditId);

    const { error } = await lead.client
      .from('audit_programmes')
      .update({
        certification_decision: 'granted',
        decided_by: lead.user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', programme.id);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not on the audit team/);

    const { data: after } = await admin
      .from('audit_programmes')
      .select('certification_decision')
      .eq('id', programme.id)
      .single();
    expect(after?.certification_decision).toBe('pending');
  });
});
