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
  listAuditLogs,
  listAuditorInvitations,
  listPlatformUsers,
  listTenantUsage,
  resendInvitation,
  revokeInvitation,
  sendPasswordReset,
  setUserPassword,
  setUserActive,
  setUserRole,
  type ActivityQuery,
  type AdminTenant,
  type CreateCompanyResult,
  type AuditLogEntry,
  type AuditorInvitation,
  type Page,
  type PlatformUser,
  type TenantUsage,
  type UserQuery,
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
  CreateCompanyResult,
  Error,
  { name: string; type: AdminTenant['type']; adminEmail?: string; adminName?: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TENANTS_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
    },
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

/* ------------------------------------------------------------------ users */

const USERS_KEY = ['admin', 'users'] as const;
const ACTIVITY_KEY = ['admin', 'activity'] as const;
const USAGE_KEY = ['admin', 'usage'] as const;

/**
 * A page of platform users. The query object is part of the key, so paging or
 * searching caches each page separately instead of thrashing one entry.
 * `placeholderData` keeps the previous page on screen while the next loads,
 * which stops the table collapsing to a skeleton on every keystroke.
 */
export function usePlatformUsers(query: UserQuery): UseQueryResult<Page<PlatformUser>> {
  return useQuery({
    queryKey: [...USERS_KEY, query],
    queryFn: () => listPlatformUsers(query),
    placeholderData: (previous) => previous,
  });
}

export function useSetUserActive(): UseMutationResult<
  void,
  Error,
  { userId: string; isActive: boolean }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }) => setUserActive(userId, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
    },
  });
}

export function useSetUserRole(): UseMutationResult<
  void,
  Error,
  { userId: string; role: PlatformUser['role'] }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }) => setUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
    },
  });
}

/* --------------------------------------------------------------- activity */

export function useAuditLogs(query: ActivityQuery): UseQueryResult<Page<AuditLogEntry>> {
  return useQuery({
    queryKey: [...ACTIVITY_KEY, query],
    queryFn: () => listAuditLogs(query),
    placeholderData: (previous) => previous,
  });
}

/* ------------------------------------------------------------------ usage */

export function useTenantUsage(): UseQueryResult<TenantUsage[]> {
  return useQuery({ queryKey: USAGE_KEY, queryFn: listTenantUsage });
}

/* ------------------------------------------------------ credential actions */

export function useSetUserPassword(): UseMutationResult<
  void,
  Error,
  { userId: string; password: string }
> {
  return useMutation({
    mutationFn: ({ userId, password }) => setUserPassword(userId, password),
  });
}

export function useSendPasswordReset(): UseMutationResult<void, Error, string> {
  return useMutation({ mutationFn: sendPasswordReset });
}

export function useResendInvitation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}
