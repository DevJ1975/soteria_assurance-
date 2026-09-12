'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardTitle } from '@/components/shadcn';
import { useAuth } from '@/lib/auth-context';

/**
 * Gates the superadmin console.
 *
 * This is a UX gate, not the security boundary — RLS (`is_super_admin()`) is.
 * A non-superadmin who reaches the console anyway simply sees empty lists and
 * failing writes; the redirect is there so they get an explanation instead.
 *
 * `loading` from the auth context already folds in claims loading, so once it
 * clears, `claims === null` means the account genuinely has no profile rather
 * than one still in flight. That case gets its own panel: it is the expected
 * outcome of signing up without an invitation, and previously fell through to
 * the spinner branch and hung there forever.
 */
export function SuperadminGuard({ children }: { children: ReactNode }) {
  const { user, claims, loading, signOut } = useAuth();
  const router = useRouter();

  const isSuperAdmin = claims?.role === 'super_admin';
  const wrongRole = claims !== null && !isSuperAdmin;

  useEffect(() => {
    if (loading) return;
    if (user === null) router.replace('/superadmin/login');
    else if (wrongRole) router.replace('/dashboard');
  }, [loading, router, user, wrongRole]);

  if (loading || user === null || wrongRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading administration…
        </span>
      </div>
    );
  }

  if (claims === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted">
              <ShieldAlert className="size-5 text-text-secondary" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <CardTitle>Organization access pending</CardTitle>
              <CardDescription>
                {user.email} is signed in but has not been assigned to an organization, so it has
                no administrator role. An invitation assigns one on first sign-in.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
