'use client';

/**
 * React Query hooks for the superadmin console.
 *
 * Kept apart from `lib/hooks.ts` because those are tenant-scoped — every query
 * there is gated on `useTenantId()` and reads only the caller's own tenant.
 * These deliberately span tenants, and RLS (`is_super_admin()`) is what makes
 * that safe, so mixing them would blur a boundary worth keeping obvious.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createCompany,
  inviteAuditor,
  listAdminTenants,
  listAuditorInvitations,
  revokeInvitation,
  type AdminTenant,
  type AuditorInvitation,
} from './supabase-admin-data';

const TENANTS_KEY = ['admin', 'tenants'] as const;
const INVITATIONS_KEY = ['admin', 'invitations'] as const;

/** Every company on the platform. Superadmin-only by RLS. */
export function useAdminTenants(): UseQueryResult<AdminTenant[]> {
  return useQuery({ queryKey: TENANTS_KEY, queryFn: listAdminTenants });
}

/** Every invitation the caller is allowed to see. */
export function useAuditorInvitations(): UseQueryResult<AuditorInvitation[]> {
  return useQuery({ queryKey: INVITATIONS_KEY, queryFn: listAuditorInvitations });
}

export function useCreateCompany(): UseMutationResult<
  void,
  Error,
  { name: string; type: AdminTenant['type'] }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TENANTS_KEY }),
  });
}

export function useInviteAuditor(): UseMutationResult<
  void,
  Error,
  { tenantId: string; email: string; displayName: string; role: AuditorInvitation['role'] }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteAuditor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useRevokeInvitation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export type InvitationState = 'pending' | 'expired' | 'accepted' | 'revoked';

/**
 * An invitation's effective state.
 *
 * `status` alone is misleading: `handle_invited_user` only matches rows that
 * are still pending AND unexpired, so a pending row past `expires_at` is dead
 * in the database while still reading as "pending" in the UI. Expiry is
 * derived here rather than stored so it never goes stale.
 */
export function invitationState(invitation: AuditorInvitation): InvitationState {
  if (invitation.status !== 'pending') return invitation.status;
  return Date.parse(invitation.expiresAt) < Date.now() ? 'expired' : 'pending';
}
