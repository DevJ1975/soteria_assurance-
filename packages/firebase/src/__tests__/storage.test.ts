/**
 * Tests for tenant-scoped Storage path building.
 *
 * `firebase/storage` is mocked; we assert on the deterministic path string
 * produced by `evidencePath` and its sanitisation behaviour.
 */

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApp: jest.fn(),
  getApps: jest.fn(() => [{ name: 'mock-app' }]),
}));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn() }));
const mockRef = jest.fn((_storage: unknown, path: string) => ({ __path: path }));
const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({ __storage: true })),
  ref: mockRef,
  uploadBytes: mockUploadBytes,
  getDownloadURL: mockGetDownloadURL,
}));

import {
  evidencePath,
  evidenceRef,
  getDownloadUrl,
  getDownloadUrlForPath,
  uploadEvidence,
} from '../storage';

const TENANT = 'tenant-abc';
const AUDIT = 'audit-123';

describe('evidencePath', () => {
  it('builds a tenant- and audit-scoped path', () => {
    expect(evidencePath(TENANT, AUDIT, 'photo.jpg')).toBe(
      'tenants/tenant-abc/audits/audit-123/evidence/photo.jpg',
    );
  });

  it('strips directory separators from the file name (no prefix escape)', () => {
    expect(evidencePath(TENANT, AUDIT, '../../etc/passwd')).toBe(
      'tenants/tenant-abc/audits/audit-123/evidence/.._.._etc_passwd',
    );
    expect(evidencePath(TENANT, AUDIT, 'a/b\\c.png')).toBe(
      'tenants/tenant-abc/audits/audit-123/evidence/a_b_c.png',
    );
  });

  it('always stays under the tenant prefix (RULE 2 isolation)', () => {
    expect(evidencePath(TENANT, AUDIT, 'x.png')).toMatch(/^tenants\/tenant-abc\/audits\//);
  });

  it('rejects empty tenantId, auditId or fileName', () => {
    expect(() => evidencePath('', AUDIT, 'x.png')).toThrow(/tenantId/);
    expect(() => evidencePath(TENANT, '', 'x.png')).toThrow(/auditId/);
    expect(() => evidencePath(TENANT, AUDIT, '   ')).toThrow(/fileName/);
  });
});

describe('storage operations', () => {
  it('evidenceRef builds a ref at the tenant-scoped path', () => {
    const reference = evidenceRef(TENANT, AUDIT, 'photo.jpg') as unknown as { __path: string };
    expect(reference.__path).toBe('tenants/tenant-abc/audits/audit-123/evidence/photo.jpg');
  });

  it('uploadEvidence uploads bytes to the evidence ref (no metadata)', async () => {
    mockUploadBytes.mockResolvedValueOnce({ ref: { fullPath: 'p' } });
    const data = new Uint8Array([1, 2, 3]);
    await uploadEvidence(TENANT, AUDIT, 'photo.jpg', data);
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    const call = mockUploadBytes.mock.calls[0];
    expect((call?.[0] as { __path: string }).__path).toBe(
      'tenants/tenant-abc/audits/audit-123/evidence/photo.jpg',
    );
    expect(call?.[1]).toBe(data);
    // metadata arg omitted when not supplied
    expect(call?.length).toBe(2);
  });

  it('uploadEvidence forwards metadata when provided', async () => {
    mockUploadBytes.mockResolvedValueOnce({ ref: { fullPath: 'p' } });
    const metadata = { contentType: 'image/jpeg' };
    await uploadEvidence(TENANT, AUDIT, 'photo.jpg', new Uint8Array([1]), metadata);
    expect(mockUploadBytes.mock.calls[0]?.[2]).toEqual(metadata);
  });

  it('getDownloadUrl resolves a URL for the evidence ref', async () => {
    mockGetDownloadURL.mockResolvedValueOnce('https://example/photo.jpg');
    await expect(getDownloadUrl(TENANT, AUDIT, 'photo.jpg')).resolves.toBe(
      'https://example/photo.jpg',
    );
  });

  it('getDownloadUrlForPath rejects an empty path', () => {
    // `requireSegment` validates synchronously before a promise is returned.
    expect(() => getDownloadUrlForPath('')).toThrow(/path/);
  });
});
