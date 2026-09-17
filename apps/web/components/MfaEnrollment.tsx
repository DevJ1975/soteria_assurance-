'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/utils/supabase/client';

interface EnrolledFactor {
  id: string;
  friendlyName: string;
  status: string;
}

interface PendingEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Authenticator-app (TOTP) enrolment.
 *
 * Supabase runs the whole factor lifecycle — it generates the secret, renders
 * the QR, issues the challenge and checks the code. Nothing here ever holds the
 * shared secret beyond showing it once for manual entry, and the verification
 * decision is the auth server's.
 *
 * Enrolment is offered to every role rather than forced on admins. Requiring a
 * second factor before anyone has enrolled one locks out the very accounts that
 * would have to fix it; GoTrue's `aal2` assurance level is how a privileged
 * screen steps up to it once enough staff are enrolled.
 */
export function MfaEnrollment() {
  const [factors, setFactors] = useState<EnrolledFactor[]>([]);
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: listError } = await createClient().auth.mfa.listFactors();
    if (listError) return;
    setFactors(
      (data?.totp ?? []).map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? 'Authenticator',
        status: factor.status,
      })),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function beginEnrollment() {
    setError(null);
    setLoading(true);
    try {
      const { data, error: enrollError } = await createClient().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) throw enrollError;
      setPending({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (pending === null) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      // A challenge is single-use and short-lived, so it is created here rather
      // than alongside the QR — the gap between scanning and typing is however
      // long the person takes to find their phone.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: pending.factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pending.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      setPending(null);
      setCode('');
      await refresh();
    } catch {
      setError('That code was not accepted. Check your authenticator app and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function remove(factorId: string) {
    setError(null);
    const { error: unenrollError } = await createClient().auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    await refresh();
  }

  async function cancel() {
    if (pending !== null) {
      // An unverified factor left behind clutters listFactors() and would show
      // as a permanently "pending" authenticator the user cannot use.
      await createClient().auth.mfa.unenroll({ factorId: pending.factorId });
    }
    setPending(null);
    setCode('');
    setError(null);
    await refresh();
  }

  const verified = factors.filter((factor) => factor.status === 'verified');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Two-factor authentication
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        {verified.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Add an authenticator app so signing in needs a code as well as your password. An audit
            record is only as defensible as the account that signed it.
          </p>
        ) : null}

        {verified.map((factor) => (
          <div
            key={factor.id}
            className="flex items-center justify-between gap-md rounded-md border border-border p-md"
          >
            <span className="inline-flex items-center gap-sm text-sm">
              <KeyRound className="h-4 w-4 text-text-muted" aria-hidden />
              <span className="font-medium text-text-primary">{factor.friendlyName}</span>
              <Badge tone="conforming">Active</Badge>
            </span>
            <Button variant="ghost" onClick={() => void remove(factor.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}

        {pending === null ? (
          <Button onClick={() => void beginEnrollment()} loading={loading} variant="secondary">
            {verified.length === 0 ? 'Set up authenticator app' : 'Add another authenticator'}
          </Button>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="text-sm text-text-secondary">
              Scan this with your authenticator app, then enter the six-digit code it shows.
            </p>
            {/* Supabase returns the QR already rendered as an SVG data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.qrCode}
              alt="Two-factor authentication QR code"
              className="h-44 w-44 self-start rounded-md border border-border bg-white p-2"
            />
            <p className="text-xs text-text-muted">
              Can&apos;t scan? Enter this key manually:{' '}
              <code className="font-mono text-text-secondary">{pending.secret}</code>
            </p>
            <Input
              id="mfa-code"
              label="Six-digit code"
              inputMode="numeric"
              placeholder="123456"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <div className="flex gap-sm">
              <Button onClick={() => void verify()} loading={loading} disabled={code.trim() === ''}>
                Verify and enable
              </Button>
              <Button variant="secondary" onClick={() => void cancel()}>
                {SoteriaStrings.common.cancel}
              </Button>
            </div>
          </div>
        )}

        {error !== null ? <p className="text-sm text-major-nc">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
