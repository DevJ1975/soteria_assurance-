'use client';

import { useState } from 'react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

/** "Continue with Google" button using the popup flow (web only, RULE 3). */
export function GoogleButton({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { signInGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      await signInGoogle();
      onAuthenticated();
    } catch {
      setError(SoteriaStrings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" onClick={() => void handleClick()} loading={loading}>
        Continue with Google
      </Button>
      {error ? <p className="text-sm text-major-nc">{error}</p> : null}
    </div>
  );
}
