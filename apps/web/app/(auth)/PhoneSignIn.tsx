'use client';

import { useState } from 'react';
import type { PhoneConfirmation } from '@/lib/auth-context';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Phone sign-in: number → SMS code → session.
 *
 * Supabase sends and verifies the code server-side, so there is no reCAPTCHA
 * verifier and no native module — the Firebase flow needed both, and this
 * component's previous version still passed an empty container id to prove it.
 *
 * This signs in to an existing account only. A number has to be attached from
 * Settings first, because access here is invitation-gated on an email address
 * and a phone-created account could never be matched to an invitation.
 */
export function PhoneSignIn({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { startPhone, confirmPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<PhoneConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    setError(null);
    setLoading(true);
    try {
      const result = await startPhone(phone.trim());
      setConfirmation(result);
    } catch (caught) {
      // The common failure is a number nobody has attached to an account, and
      // GoTrue reports it as "Signups not allowed for otp" — which describes
      // the setting, not what the person should do about it.
      const message = caught instanceof Error ? caught.message : '';
      setError(
        /signup|not allowed|user not found/i.test(message)
          ? 'No account uses that number. Sign in with your email, then add it under Settings.'
          : SoteriaStrings.errors.generic,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (confirmation === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await confirmPhone(confirmation, code.trim());
      onAuthenticated();
    } catch {
      setError(SoteriaStrings.auth.invalidCredentials);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-md">
      {confirmation === null ? (
        <>
          <Input
            id="phone-number"
            label="Phone number"
            type="tel"
            placeholder="+14155550123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <Button onClick={() => void handleSendCode()} loading={loading} disabled={phone === ''}>
            Send verification code
          </Button>
        </>
      ) : (
        <>
          <Input
            id="phone-otp"
            label="Verification code"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
          />
          <Button onClick={() => void handleConfirm()} loading={loading} disabled={code === ''}>
            {SoteriaStrings.auth.signInButton}
          </Button>
        </>
      )}

      {error ? <p className="text-sm text-major-nc">{error}</p> : null}

    </div>
  );
}
