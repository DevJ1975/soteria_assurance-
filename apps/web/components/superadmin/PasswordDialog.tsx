'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
} from '@/components/shadcn';
import { useSendPasswordReset, useSetUserPassword } from '@/lib/admin-hooks';
import type { PlatformUser } from '@/lib/supabase-admin-data';

/** Matches the floor the `admin-user-action` Edge Function enforces. */
const MIN_LENGTH = 12;

/**
 * The two ways to get someone back into their account.
 *
 * Sending a reset link is offered first and framed as the normal path: the user
 * picks their own password and it never passes through anyone else's hands.
 * Setting one directly is for when that cannot work — a wrong address on the
 * invitation, or a user who cannot receive mail — and is deliberately the
 * second, heavier option.
 */
export function PasswordDialog({
  user,
  onClose,
}: {
  user: PlatformUser | null;
  onClose: () => void;
}) {
  const setPassword = useSetUserPassword();
  const sendReset = useSendPasswordReset();
  const [password, setPassword_] = useState('');
  const [done, setDone] = useState<string | null>(null);

  // Every open starts clean — a password left in state from the previous user
  // would be both confusing and a real hazard.
  useEffect(() => {
    if (user) {
      setPassword_('');
      setDone(null);
      setPassword.reset();
      sendReset.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  const error = setPassword.error ?? sendReset.error;
  const busy = setPassword.isPending || sendReset.isPending;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  return (
    <Dialog open={user !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password for {user.displayName || user.email}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle aria-hidden />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Unexpected error.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {done !== null ? (
          <p className="flex items-center gap-1.5 text-sm text-conforming" role="status">
            <CheckCircle2 className="size-4" aria-hidden />
            {done}
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">Send a reset link</p>
            <p className="text-sm text-muted-foreground">
              Emails a recovery link so they choose their own password. Nobody else ever sees it.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              sendReset.mutate(user.id, {
                onSuccess: () => setDone(`Reset link sent to ${user.email}.`),
              })
            }
          >
            {sendReset.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
            Email a reset link
          </Button>
        </div>

        <Separator />

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (password.length < MIN_LENGTH) return;
            setPassword.mutate(
              { userId: user.id, password },
              {
                onSuccess: () => {
                  setPassword_('');
                  setDone('Password set. Share it with them over a trusted channel.');
                },
              },
            );
          }}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">Or set one directly</p>
            <p className="text-sm text-muted-foreground">
              For someone who cannot receive the email. You will need to tell them what it is, so
              send it over something safer than email and have them change it. This signs them out
              of every device — Supabase revokes their existing tokens.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(event) => setPassword_(event.target.value)}
              placeholder={`At least ${MIN_LENGTH} characters`}
              aria-invalid={tooShort}
            />
            {tooShort ? (
              <p className="text-sm text-destructive">
                Must be at least {MIN_LENGTH} characters.
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="destructive" disabled={busy || password.length < MIN_LENGTH}>
            {setPassword.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <KeyRound aria-hidden />
            )}
            Set password
          </Button>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
