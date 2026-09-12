/**
 * Evidence storage authorization.
 *
 * Evidence is the objective basis of a nonconformity, so who can read and
 * write an object matters as much as who can read the row describing it. The
 * buckets are private and the policies key on the object's first path segment
 * being the caller's tenant id.
 */
import { createActor, createTenant, destroyTenant, admin, type Actor } from './helpers/stack';

describe('evidence storage', () => {
  let tenantA: string;
  let tenantB: string;
  let auditorA: Actor;
  let auditorB: Actor;
  let pathA: string;

  beforeAll(async () => {
    tenantA = await createTenant('Storage A');
    tenantB = await createTenant('Storage B');
    auditorA = await createActor(tenantA, 'auditor', 'storage-a');
    auditorB = await createActor(tenantB, 'auditor', 'storage-b');
    pathA = `${tenantA}/audit-1/photo.txt`;
  });

  afterAll(async () => {
    await admin.storage.from('evidence').remove([pathA]).catch(() => undefined);
    await destroyTenant(tenantA);
    await destroyTenant(tenantB);
  });

  it('the evidence bucket exists and is private', async () => {
    const { data } = await admin.storage.getBucket('evidence');
    expect(data?.public).toBe(false);
  });

  it('uploads under its own tenant prefix', async () => {
    const { error } = await auditorA.client.storage
      .from('evidence')
      .upload(pathA, new Blob(['evidence bytes']), { contentType: 'text/plain', upsert: true });
    expect(error).toBeNull();
  });

  it('cannot upload under another tenant\'s prefix', async () => {
    const { error } = await auditorA.client.storage
      .from('evidence')
      .upload(`${tenantB}/audit-1/planted.txt`, new Blob(['nope']), { upsert: true });
    expect(error).not.toBeNull();
  });

  it('cannot download another tenant\'s object', async () => {
    const { error } = await auditorB.client.storage.from('evidence').download(pathA);
    expect(error).not.toBeNull();
  });

  it('can download its own object', async () => {
    const { data, error } = await auditorA.client.storage.from('evidence').download(pathA);
    expect(error).toBeNull();
    expect(await data?.text()).toBe('evidence bytes');
  });
});
