'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { getDownloadUrlForPath } from '@soteria/firebase';
import { Button } from '@/components/ui/Button';
import { callGenerateReportPdf } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface Props {
  auditId: string;
}

/**
 * Generates the audit report PDF server-side (`generateReportPdf`), resolves a
 * download URL for the stored object, and opens it. AI/secret access stays on
 * the server (RULE 3); this only triggers the callable and follows the link.
 */
export function DownloadReportButton({ auditId }: Props) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (): Promise<void> => {
    if (tenantId === '' || auditId === '' || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await callGenerateReportPdf({ tenantId, auditId });
      const url = await getDownloadUrlForPath(result.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(SoteriaStrings.audit.reportFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="navy"
        loading={busy}
        disabled={tenantId === '' || auditId === ''}
        onClick={handleDownload}
      >
        {!busy ? <Download className="mr-2 h-4 w-4" aria-hidden /> : null}
        {busy ? SoteriaStrings.audit.generatingPdf : SoteriaStrings.audit.downloadPdf}
      </Button>
      {error !== null ? <span className="text-sm text-major-nc">{error}</span> : null}
    </div>
  );
}
