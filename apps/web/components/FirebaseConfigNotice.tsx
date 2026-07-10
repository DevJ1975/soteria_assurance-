'use client';

import { AlertTriangle } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Logo } from '@/components/brand/Logo';

/**
 * Full-screen, branded "configuration required" screen shown when the public
 * Firebase config (`NEXT_PUBLIC_FIREBASE_*`) is absent. Rendered in place of the
 * app so a missing env var surfaces an actionable message instead of a blank
 * white page (a single throw at the provider root would otherwise unmount the
 * whole tree). Copy lives in the string catalogue (RULE 4).
 *
 * @param missing env-var suffixes reported by `getFirebaseConfigStatus()`, e.g.
 *   `['API_KEY', 'APP_ID']`. Each is shown as its full `NEXT_PUBLIC_FIREBASE_*`
 *   variable name.
 */
export function FirebaseConfigNotice({ missing }: { missing: string[] }) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-md py-xl"
    >
      <div className="w-full max-w-lg rounded-lg border border-border-soft bg-surface p-xl text-center shadow-sm">
        <div className="mb-lg flex flex-col items-center gap-sm">
          <Logo size={44} aria-hidden />
          <h1 className="font-display text-2xl font-bold text-primary-800">
            {SoteriaStrings.common.appName}
          </h1>
        </div>

        <div className="mx-auto mb-md flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/15">
          <AlertTriangle className="h-6 w-6 text-gold-600" aria-hidden />
        </div>

        <h2 className="font-display text-xl font-semibold text-text-primary">
          {SoteriaStrings.setup.configTitle}
        </h2>
        <p className="mx-auto mt-sm max-w-md text-sm text-text-secondary">
          {SoteriaStrings.setup.firebaseMissing}
        </p>

        {missing.length > 0 ? (
          <div className="mt-lg text-left">
            <p className="mb-sm text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {SoteriaStrings.setup.missingVarsLabel}
            </p>
            <ul className="space-y-1 rounded-md bg-background p-md font-mono text-xs text-text-primary">
              {missing.map((suffix) => (
                <li key={suffix}>{`NEXT_PUBLIC_FIREBASE_${suffix}`}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-lg space-y-1 text-left text-xs text-text-secondary">
          <p>{SoteriaStrings.setup.howToLocal}</p>
          <p>{SoteriaStrings.setup.howToHosting}</p>
          <p className="pt-sm text-text-muted">{SoteriaStrings.setup.publicNote}</p>
        </div>
      </div>
    </div>
  );
}
