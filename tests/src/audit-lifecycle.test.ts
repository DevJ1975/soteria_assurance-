/**
 * The audit record itself: creating one, assessing clauses against it, raising
 * a finding, and closing that finding through an effectiveness review.
 */
import {
  admin,
  createActor,
  createTenant,
  destroyTenant,
  seedAuditChain,
  type Actor,
} from './helpers/stack';

describe('audit lifecycle', () => {
  let tenantId: string;
  let auditor: Actor;
  let chain: { clientId: string; auditId: string; findingId: string };

  beforeAll(async () => {
    tenantId = await createTenant('Lifecycle Tenant');
    auditor = await createActor(tenantId, 'lead_auditor', 'lead');
    chain = await seedAuditChain(tenantId);
  });

  afterAll(async () => {
    await destroyTenant(tenantId);
  });

  it('creates a client and an audit in its own tenant', async () => {
    const { data: client, error } = await auditor.client
      .from('clients')
      .insert({ tenant_id: tenantId, organization_name: 'Created In Test' })
      .select('id, tenant_id')
      .single();
    expect(error).toBeNull();
    expect(client?.tenant_id).toBe(tenantId);

    const { error: auditError } = await auditor.client.from('audits').insert({
      tenant_id: tenantId,
      client_id: client!.id,
      audit_number: `AUD-CREATED-${Date.now()}`,
      audit_type: 'internal',
      scope: 'Scope',
      planned_start_date: '2026-02-01',
      planned_end_date: '2026-02-02',
    });
    expect(auditError).toBeNull();
  });

  it('saves and reads back a clause assessment', async () => {
    const { error } = await auditor.client.from('clause_assessments').upsert(
      {
        tenant_id: tenantId,
        audit_id: chain.auditId,
        standard_id: 'iso45001',
        clause_number: '6.1.2',
        clause_title: 'Hazard identification',
        conformity_status: 'conforming',
        score: 4,
        auditor_notes: 'Reviewed the register with the safety officer.',
        is_complete: true,
      },
      { onConflict: 'audit_id,clause_number' },
    );
    expect(error).toBeNull();

    const { data } = await auditor.client
      .from('clause_assessments')
      .select('auditor_notes, score, standard_id')
      .eq('audit_id', chain.auditId)
      .eq('clause_number', '6.1.2')
      .single();
    expect(data?.score).toBe(4);
    expect(data?.standard_id).toBe('iso45001');
  });

  it('raises a finding', async () => {
    const { data, error } = await auditor.client
      .from('findings')
      .insert({
        tenant_id: tenantId,
        audit_id: chain.auditId,
        client_id: chain.clientId,
        finding_number: `NCR-RAISED-${Date.now()}`,
        type: 'major_nc',
        clause_number: '8.1',
        clause_title: 'Operational planning',
        requirement: 'The organization shall...',
        title: 'No permit-to-work for hot works',
      })
      .select('id, status')
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe('open');
  });

  it('closes a finding only through an accepted effectiveness review', async () => {
    const { data: ca } = await admin
      .from('corrective_actions')
      .insert({
        tenant_id: tenantId,
        client_id: chain.clientId,
        audit_id: chain.auditId,
        finding_id: chain.findingId,
        ca_number: `CA-${Date.now()}`,
        title: 'Fit the guard',
        root_cause_method: 'five_why',
        target_date: '2026-03-01',
        status: 'submitted',
      })
      .select('id')
      .single();

    const { error } = await auditor.client.rpc('record_effectiveness_review', {
      p_corrective_action_id: ca!.id,
      p_effective: true,
      p_result: 'Re-inspected on site; guard fitted.',
      p_notes: null,
    });
    expect(error).toBeNull();

    const { data: finding } = await admin
      .from('findings')
      .select('status, closed_at')
      .eq('id', chain.findingId)
      .single();
    expect(finding?.status).toBe('closed');
    expect(finding?.closed_at).not.toBeNull();
  });

  it('refuses to review a corrective action nobody submitted', async () => {
    const { data: ca } = await admin
      .from('corrective_actions')
      .insert({
        tenant_id: tenantId,
        client_id: chain.clientId,
        audit_id: chain.auditId,
        finding_id: chain.findingId,
        ca_number: `CA-PENDING-${Date.now()}`,
        title: 'Not submitted',
        root_cause_method: 'five_why',
        target_date: '2026-03-01',
        status: 'pending',
      })
      .select('id')
      .single();

    const { error } = await auditor.client.rpc('record_effectiveness_review', {
      p_corrective_action_id: ca!.id,
      p_effective: true,
      p_result: 'Should not be allowed',
      p_notes: null,
    });
    expect(error).not.toBeNull();
  });

  it('writes an append-only audit log entry that clients cannot alter', async () => {
    const { data: logs } = await auditor.client
      .from('audit_logs')
      .select('id, table_name, operation')
      .eq('tenant_id', tenantId)
      .limit(1);
    expect((logs ?? []).length).toBeGreaterThan(0);

    await auditor.client.from('audit_logs').delete().eq('id', logs![0].id);
    const { data: still } = await admin.from('audit_logs').select('id').eq('id', logs![0].id);
    expect(still ?? []).toHaveLength(1);
  });
});
