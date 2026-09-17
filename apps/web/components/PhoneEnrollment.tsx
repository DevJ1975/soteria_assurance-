'use client';

import { useState } from 'react';
import { Check, Smartphone } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth, type PhoneConfirmation } from '@/lib/auth-context';

/**
 * Attaches a phone number to the signed-in account so it can be used to sign in.
 *
 * This is the only way a number gets onto an account: `[auth.sms] enable_signup`
 * is false, so phone sign-in works for numbers already on file and nothing else.
 * Enrolling is therefore an authenticated action — you prove who you are with
 * the credentials you already have, then prove you hold the handset.
 *
 * Supabase sends and checks the code; nothing here sees or stores it.
 */
export function PhoneEnrollment() {
  const { user, startPhoneEnrollment, confirmPhoneEnrollment } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<PhoneConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // GoTrue stores the number digits-only; show it back in a readable form
  // rather than as the raw key.
  const current = user?.phone !== undefined && user.phone !== '' ? `+${user.phone}` : null;

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      setPending(await startPhoneEnrollment(phone));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (pending === null) return;
    setError(null);
    setLoading(true);
    try {
      await confirmPhoneEnrollment(pending, code.trim());
      setDone(true);
      setPending(null);
      setCode('');
      setPhone('');
    } catch {
      setError('That code was not correct, or it has expired. Send a new one.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-sm">
            <Smartphone className="h-4 w-4" aria-hidden />
            Phone sign-in
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        {current !== null ? (
          <p className="inline-flex items-center gap-sm text-sm text-text-secondary">
            <Check className="h-4 w-4 text-conforming" aria-hidden />
            <span>
              <span className="font-medium text-text-primary">{current}</span> is on this account.
              You can sign in with it from the Phone tab.
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Add a number to sign in with a texted code instead of your password. It does not replace
            your email — your organization and role stay tied to that.
          </p>
        )}

        {done ? (
          <p className="rounded-md border border-conforming/30 bg-conforming/10 p-md text-sm text-text-primary">
            Your phone number is verified and attached to this account.
          </p>
        ) : null}

        {pending === null ? (
          <div className="flex flex-col gap-sm">
            <Input
              id="enroll-phone"
              label={current !== null ? 'Replace with a different number' : 'Phone number'}
              type="tel"
              placeholder="+1 415 555 0123"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Button
              onClick={() => void sendCode()}
              loading={loading}
              disabled={phone.replace(/\D/g, '').length < 8}
            >
              Send verification code
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            <Input
              id="enroll-code"
              label={`Code sent to +${pending.phone}`}
              inputMode="numeric"
              placeholder="123456"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <div className="flex gap-sm">
              <Button onClick={() => void confirm()} loading={loading} disabled={code.trim() === ''}>
                Verify and attach
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPending(null);
                  setCode('');
                  setError(null);
                }}
              >
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
