/**
 * Creates an auditor invitation and sends the Supabase Auth invitation email.
 *
 * This runs server-side because it needs the service-role key twice: to send
 * the email through the Auth admin API, and to write an invitation row on
 * behalf of a superadmin. The matching profile is NOT created here — it is
 * provisioned by the `on_auth_user_created_apply_invitation` trigger when the
 * invited person actually signs up, so an unaccepted invitation never leaves a
 * usable account behind.
 */
import {
  HttpError,
  findAuthUserByEmail,
  handleRequest,
  jsonResponse,
  requireCaller,
  serviceClient,
} from '../_shared/auth.ts';

const ASSIGNABLE_ROLES = new Set(['tenant_admin', 'lead_auditor', 'auditor', 'viewer']);

interface InviteRequest {
  tenantId?: unknown;
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  redirectTo?: unknown;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `"${field}" is required.`);
  }
  return value.trim();
}

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const caller = await requireCaller(request);
    const body = (await request.json().catch(() => ({}))) as InviteRequest;

    const email = requireString(body.email, 'email').toLowerCase();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const role = requireString(body.role, 'role');
    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new HttpError(400, 'That role cannot be assigned through an invitation.');
    }

    // A superadmin may invite into any tenant; a tenant admin only into their
    // own. The tenant id in the body is never trusted for anyone else — it is
    // read from the caller's own profile.
    const isSuperAdmin = caller.role === 'super_admin';
    if (!isSuperAdmin && caller.role !== 'tenant_admin') {
      throw new HttpError(403, 'Only an administrator can invite auditors.');
    }
    const tenantId = isSuperAdmin ? requireString(body.tenantId, 'tenantId') : caller.tenantId;

    const admin = serviceClient();

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw new HttpError(500, 'Could not verify the tenant.');
    if (!tenant) throw new HttpError(404, 'That organization does not exist.');

    // An address that already belongs to a profile cannot be re-invited:
    // accepting would move an existing user between tenants.
    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id, tenant_id')
      .eq('email', email)
      .maybeSingle();
    if (existingProfileError) throw new HttpError(500, 'Could not check existing users.');
    if (existingProfile) {
      throw new HttpError(409, 'That email address already belongs to an account.');
    }

    // Captured before the upsert so a failed send can restore exactly what was
    // there, rather than deleting an invitation that predates this request.
    const { data: priorInvitation } = await admin
      .from('auditor_invitations')
      .select('id, display_name, role, status, expires_at, accepted_at, accepted_by, revoked_at')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    // `(tenant_id, email)` is unique, so a repeat invitation reopens the
    // existing row and extends its expiry rather than failing on the
    // constraint. A revoked invitation is deliberately reopened only by an
    // explicit re-invite like this one.
    const { data: invitation, error: invitationError } = await admin
      .from('auditor_invitations')
      .upsert(
        {
          tenant_id: tenantId,
          email,
          display_name: displayName,
          role,
          status: 'pending',
          invited_by: caller.userId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          accepted_at: null,
          accepted_by: null,
          revoked_at: null,
        },
        { onConflict: 'tenant_id,email' },
      )
      .select('id, tenant_id, email, display_name, role, status, expires_at')
      .single();
    if (invitationError || !invitation) {
      throw new HttpError(500, 'Could not record the invitation.');
    }
    const invitationId: string = invitation.id;

    /** Puts the invitation row back the way it was before this request. */
    async function revertInvitation() {
      if (priorInvitation) {
        await admin
          .from('auditor_invitations')
          .update({
            display_name: priorInvitation.display_name,
            role: priorInvitation.role,
            status: priorInvitation.status,
            expires_at: priorInvitation.expires_at,
            accepted_at: priorInvitation.accepted_at,
            accepted_by: priorInvitation.accepted_by,
            revoked_at: priorInvitation.revoked_at,
          })
          .eq('id', invitationId);
      } else {
        await admin.from('auditor_invitations').delete().eq('id', invitationId);
      }
    }

    // Someone may already hold an account without belonging to any tenant —
    // they registered before anyone invited them. `inviteUserByEmail` refuses
    // an address that already exists, so those two cases are handled here
    // rather than left to fail with a misleading "could not send" error.
    const existingUser = await findAuthUserByEmail(admin, email);
    if (existingUser) {
      if (!existingUser.confirmed) {
        // The confirmation trigger will pick the invitation up when they
        // finish verifying their address. Nothing more to send.
        return jsonResponse({ invitation, emailSent: false, awaitingConfirmation: true });
      }

      // A confirmed address has already passed the point where the trigger
      // fires, so the invitation is applied directly.
      const { error: profileError } = await admin.from('profiles').insert({
        id: existingUser.id,
        tenant_id: tenantId,
        email: existingUser.email,
        display_name: displayName || existingUser.email.split('@')[0],
        role,
      });
      if (profileError) {
        await revertInvitation();
        console.error(profileError);
        throw new HttpError(500, 'Could not add that account to the organization.');
      }
      await admin
        .from('auditor_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: existingUser.id })
        .eq('id', invitationId);
      return jsonResponse({ invitation, emailSent: false, provisioned: true });
    }

    // The row exists before the email goes out. If sending fails the
    // invitation is rolled back, so an admin never sees a pending invitation
    // that nobody was told about.
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName, invited_tenant_id: tenantId, invited_role: role },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (inviteError) {
      await revertInvitation();
      console.error(inviteError);
      throw new HttpError(502, 'The invitation email could not be sent.');
    }

    return jsonResponse({ invitation, emailSent: true });
  }),
);
