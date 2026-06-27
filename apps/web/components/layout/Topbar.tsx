'use client';

import { LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { SyncIndicator } from '@/components/layout/SyncIndicator';

export interface TopbarProps {
  /** Opens the AI co-pilot slide-in. */
  onOpenCopilot: () => void;
}

/**
 * Top bar with sync/status, AI co-pilot trigger, the signed-in identity and a
 * sign-out action. Strings come from SoteriaStrings (RULE 4).
 */
export function Topbar({ onOpenCopilot }: TopbarProps) {
  const { user, claims, signOut } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between gap-md border-b border-border bg-surface px-lg">
      <div className="flex items-center gap-md">
        <SyncIndicator />
        {claims ? (
          <span className="hidden text-xs text-text-muted sm:inline">
            {claims.role.replace('_', ' ')} · {claims.tenantId}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-sm">
        <Button variant="outline" size="sm" onClick={onOpenCopilot}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {SoteriaStrings.ai.copilotTitle}
        </Button>

        <span className="hidden items-center gap-1 text-sm text-text-secondary sm:inline-flex">
          <UserIcon className="h-4 w-4" aria-hidden />
          {user?.displayName ?? user?.email ?? ''}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOut();
          }}
          aria-label={SoteriaStrings.auth.signOutButton}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{SoteriaStrings.auth.signOutButton}</span>
        </Button>
      </div>
    </header>
  );
}
