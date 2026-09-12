/**
 * Tenant isolation.
 *
 * The most important tests in this repository. Soteria is multi-tenant by
 * design and its customers are certification bodies auditing each other's
 * competitors — a cross-tenant read is not a bug, it is the end of the
 * product. Every assertion here is against real RLS, not application code.
 */
import { admin, createActor, createTenant, destroyTenant, seedAuditChain, type Actor } from './helpers/stack';

describe('tenant isolation', () => {
  let tenantA: string;
  let tenantB: string;
  let auditorA: Actor;
  let chainB: { clientId: string; auditId: string; findingId: string };

  beforeAll(async () => {
    tenantA = await createTenant('Isolation A');
    tenantB = await createTenant('Isolation B');
    auditorA = await createActor(tenantA, 'auditor', 'auditor-a');
    await seedAuditChain(tenantA);
    chainB = await seedAuditChain(tenantB);
  });

  afterAll(async () => {
    await destroyTenant(tenantA);
    await destroyTenant(tenantB);
  });

  it('reads only its own tenant across every business table', async () => {
    for (const table of [
      'clients',
      'audits',
      'findings',
      'corrective_actions',
      'clause_assessments',
      'evidence',
    ]) {
      const { data, error } = await auditorA.client.from(table).select('tenant_id');
      expect(error).toBeNull();
      // Not "returns nothing" — the point is it never returns another tenant's.
      expect((data ?? []).every((row) => row.tenant_id === tenantA)).toBe(true);
    }
  });

  it('cannot read a specific row from another tenant even knowing its id', async () => {
    const { data } = await auditorA.client
      .from('findings')
      .select('id')
      .eq('id', chainB.findingId);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot write into another tenant', async () => {
    const { error } = await auditorA.client.from('clients').insert({
      tenant_id: tenantB,
      organization_name: 'Planted by tenant A',
    });
    expect(error).not.toBeNull();

    // And nothing landed.
    const { data } = await admin
      .from('clients')
      .select('id')
      .eq('organization_name', 'Planted by tenant A');
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot update or delete another tenant\'s rows', async () => {
    await auditorA.client.from('findings').update({ title: 'tampered' }).eq('id', chainB.findingId);
    await auditorA.client.from('findings').delete().eq('id', chainB.findingId);

    const { data } = await admin
      .from('findings')
      .select('title')
      .eq('id', chainB.findingId)
      .single();
    expect(data?.title).toBe('Test finding');
  });

  it('cannot see another tenant\'s audit log', async () => {
    const { data } = await auditorA.client.from('audit_logs').select('tenant_id');
    expect((data ?? []).every((row) => row.tenant_id === tenantA)).toBe(true);
  });
});
