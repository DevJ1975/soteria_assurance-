'use client';

import { useState } from 'react';
import type { PhoneConfirmation } from '@/lib/auth-context';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Phone sign-in flow: phone input → invisible reCAPTCHA → OTP input.
 *
 * The reCAPTCHA verifier is created against a stable per-instance div id, then
 * `startPhoneSignIn` sends the SMS and `confirmPhoneCode` verifies it — all via
 * the Supabase Auth helpers (RULE 3). On success, the AuthProvider
 * (in AuthProvider) drives the redirect.
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
      const result = await startPhone(phone.trim(), '');
      setConfirmation(result);
    } catch {
      setError(SoteriaStrings.errors.generic);
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
