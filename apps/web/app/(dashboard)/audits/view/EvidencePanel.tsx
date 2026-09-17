'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import type { EvidenceType } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '@/lib/auth-context';
import { useEvidence, useTenantId } from '@/lib/hooks';
import { getEvidenceObjectRef, insertEvidence, sha256Hex } from '@/lib/supabase-data';
import { createSignedDownloadUrl, uploadTenantFile } from '@/lib/supabase-storage';

const EVIDENCE_TYPES: ReadonlyArray<EvidenceType> = [
  'photo',
  'document',
  'screenshot',
  'video',
  'audio',
];

/**
 * Views and captures audit evidence on the web.
 *
 * WHY THIS EXISTS
 * `listEvidence`, `getEvidenceObjectRef` and `insertEvidence` had existed in
 * the data layer with NO callers anywhere in `apps/web` — there was no
 * evidence route at all. The platform where the report is produced, and where
 * the lead auditor reviews the team's work, could not display a single
 * photograph, document or recording (ISO 19011 §6.4.7).
 *
 * Every upload records a SHA-256 of the bytes. The evidence bucket is
 * write-once, so an object cannot be replaced — but the digest is what makes
 * integrity demonstrable to an assessor rather than merely asserted, and a row
 * with no digest says so plainly rather than implying one.
 *
 * Downloads go through a short-lived signed URL. The bucket is private and the
 * stored `storage_path` is a path, not a URL: rendering it directly is exactly
 * the bug that made mobile evidence thumbnails go blank the moment an upload
 * succeeded.
 */
export function EvidencePanel({ auditId }: { auditId: string }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: evidence, isLoading } = useEvidence(auditId);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EvidenceType>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload() {
    if (file === null || title.trim() === '') {
      setError('A title and a file are both required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Digest FIRST, over the exact bytes about to be sent.
      const contentSha256 = await sha256Hex(file);
      const uploaded = await uploadTenantFile({
        bucket: 'evidence',
        tenantId,
        segments: [auditId],
        file,
      });
      await insertEvidence(tenantId, uploaded, {
        auditId,
        type,
        title: title.trim(),
        capturedByAuditorId: user?.id ?? '',
        contentSha256,
      });
      setTitle('');
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['evidence', tenantId, auditId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(evidenceId: string) {
    setError(null);
    try {
      const ref = await getEvidenceObjectRef(tenantId, evidenceId);
      if (ref === null) {
        setError('That evidence has no stored file.');
        return;
      }
      const url = await createSignedDownloadUrl(ref.bucket, ref.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        <div className="grid grid-cols-1 items-end gap-sm md:grid-cols-[2fr_1fr_2fr_auto]">
          <Input
            label="Title"
            placeholder="Hazard register, rev 9"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Select
            label="Type"
            value={type}
            onChange={(event) => setType(event.target.value as EvidenceType)}
          >
            {EVIDENCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Input
            label="File"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button loading={busy} onClick={onUpload}>
            <Upload className="mr-1 h-4 w-4" />
            Capture
          </Button>
        </div>

        {error !== null ? <ErrorState message={error} /> : null}

        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading evidence…</p>
        ) : (evidence ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">
            No evidence captured for this audit yet.
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            {(evidence ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border-soft p-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-muted">
                    {item.type} · {item.fileName} ·{' '}
                    {new Date(item.capturedAt.toMillis()).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-sm">
                  {/*
                    An honest integrity signal. A row captured before digests
                    were recorded says so rather than implying verification it
                    cannot support.
                  */}
                  {item.contentSha256 !== undefined && item.contentSha256 !== null ? (
                    <Badge tone="conforming" title={item.contentSha256}>
                      SHA-256 {item.contentSha256.slice(0, 8)}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">No digest</Badge>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => onDownload(item.id)}>
                    <Download className="mr-1 h-3 w-3" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
