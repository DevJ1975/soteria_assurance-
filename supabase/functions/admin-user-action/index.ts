/**
 * Administrative actions on a user's credentials.
 *
 * All of these need the service-role key (or the ability to send auth mail on
 * someone else's behalf), so none of them can happen in the browser. The
 * caller's own profile — never the request body — decides what they may do and
 * to whom.
 *
 *   set_password         set a new password directly, for a locked-out user
 *   send_password_reset  email a recovery link so the user picks their own
 *   resend_invitation    re-send an invitation email and extend its expiry
 */
import {
  HttpError,
  anonClient,
  handleRequest,
  jsonResponse,
  requireCaller,
  serviceClient,
} from '../_shared/auth.ts';

/**
 * Longer than the project's own minimum (6). A password someone else chooses
 * for you is typed once and often reused, so it gets the stricter floor.
 */
const MIN_ADMIN_SET_PASSWORD = 12;

interface ActionRequest {
  action?: unknown;
  userId?: unknown;
  invitationId?: unknown;
  password?: unknown;
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
    if (caller.role !== 'super_admin' && caller.role !== 'tenant_admin') {
      throw new HttpError(403, 'Only an administrator can manage user credentials.');
    }
    const isSuperAdmin = caller.role === 'super_admin';

    const body = (await request.json().catch(() => ({}))) as ActionRequest;
    const action = requireString(body.action, 'action');
    const admin = serviceClient();

    if (action === 'resend_invitation') {
      const invitationId = requireString(body.invitationId, 'invitationId');
      const { data: invitation, error } = await admin
        .from('auditor_invitations')
        .select('id, tenant_id, email, display_name, role, status')
        .eq('id', invitationId)
        .maybeSingle();
      if (error) throw new HttpError(500, 'Could not load the invitation.');
      if (!invitation) throw new HttpError(404, 'That invitation does not exist.');
      if (!isSuperAdmin && invitation.tenant_id !== caller.tenantId) {
        throw new HttpError(403, 'That invitation belongs to another organization.');
      }
      if (invitation.status !== 'pending') {
        throw new HttpError(409, `That invitation is already ${invitation.status}.`);
      }

      const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
      const { error: sendError } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
        data: {
          display_name: invitation.display_name,
          invited_tenant_id: invitation.tenant_id,
          invited_role: invitation.role,
        },
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (sendError) {
        console.error(sendError);
        throw new HttpError(502, 'The invitation email could not be sent.');
      }

      // Only extended once the send succeeded, so a failed resend never makes a
      // dead invitation look alive.
      await admin
        .from('auditor_invitations')
        .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', invitationId);

      return jsonResponse({ ok: true, emailSent: true });
    }

    // The remaining actions all target a user, so resolve and authorise once.
    const userId = requireString(body.userId, 'userId');
    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, email, tenant_id, role')
      .eq('id', userId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, 'Could not load that user.');
    if (!target) throw new HttpError(404, 'That user does not exist.');

    if (!isSuperAdmin) {
      if (target.tenant_id !== caller.tenantId) {
        throw new HttpError(403, 'That user belongs to another organization.');
      }
      // A tenant admin must not be able to seize a platform account that
      // happens to sit in their tenant.
      if (target.role === 'super_admin') {
        throw new HttpError(403, 'You cannot manage a platform administrator.');
      }
    }

    if (action === 'set_password') {
      const password = requireString(body.password, 'password');
      if (password.length < MIN_ADMIN_SET_PASSWORD) {
        throw new HttpError(400, `Password must be at least ${MIN_ADMIN_SET_PASSWORD} characters.`);
      }
      const { error } = await admin.auth.admin.updateUserById(target.id, { password });
      if (error) {
        console.error(error);
        throw new HttpError(502, 'The password could not be set.');
      }
      return jsonResponse({ ok: true, email: target.email });
    }

    if (action === 'send_password_reset') {
      // Sent through the anon client because that is the endpoint that actually
      // delivers a recovery email; the admin API's generateLink only mints a
      // link. Gating it behind this function keeps it an administrative act
      // rather than something anyone can trigger for any address.
      const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
      const { error } = await anonClient().auth.resetPasswordForEmail(
        target.email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (error) {
        console.error(error);
        throw new HttpError(502, 'The reset email could not be sent.');
      }
      return jsonResponse({ ok: true, emailSent: true, email: target.email });
    }

    throw new HttpError(400, `Unknown action "${action}".`);
  }),
);
