/**
 * Creates a company and, optionally, onboards its first administrator.
 *
 * Runs server-side because the onboarding email needs the Auth admin API. It
 * also makes the two writes one operation: a company created without anyone
 * able to sign into it is not a useful outcome, and doing it in two round trips
 * from the browser is how you end up with half of it.
 *
 * The administrator is invited, never created directly — the
 * `handle_invited_user` trigger writes their profile when they first sign in,
 * so an unaccepted invitation never leaves a usable account behind.
 */
import {
  HttpError,
  handleRequest,
  jsonResponse,
  requireCaller,
  serviceClient,
} from '../_shared/auth.ts';

const TENANT_TYPES = new Set(['certification_body', 'consultancy', 'enterprise']);

interface CreateCompanyRequest {
  name?: unknown;
  type?: unknown;
  adminEmail?: unknown;
  adminName?: unknown;
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
    if (caller.role !== 'super_admin') {
      throw new HttpError(403, 'Only a platform administrator can create a company.');
    }

    const body = (await request.json().catch(() => ({}))) as CreateCompanyRequest;
    const name = requireString(body.name, 'name');
    const type = requireString(body.type, 'type');
    if (!TENANT_TYPES.has(type)) throw new HttpError(400, 'Unknown tenant type.');

    const adminEmail =
      typeof body.adminEmail === 'string' && body.adminEmail.trim() !== ''
        ? body.adminEmail.trim().toLowerCase()
        : null;
    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : '';
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;

    const admin = serviceClient();

    // Checked before the tenant is created, so a duplicate address fails
    // without leaving an orphaned company behind.
    if (adminEmail) {
      const { data: existing, error } = await admin
        .from('profiles')
        .select('id')
        .eq('email', adminEmail)
        .maybeSingle();
      if (error) throw new HttpError(500, 'Could not check existing users.');
      if (existing) {
        throw new HttpError(409, 'That email address already belongs to an account.');
      }
    }

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name, type })
      .select('id, name, type')
      .single();
    if (tenantError || !tenant) {
      console.error(tenantError);
      throw new HttpError(500, 'Could not create the company.');
    }

    if (!adminEmail) {
      return jsonResponse({ tenant, invited: false, emailSent: false });
    }

    const { data: invitation, error: invitationError } = await admin
      .from('auditor_invitations')
      .insert({
        tenant_id: tenant.id,
        email: adminEmail,
        display_name: adminName,
        role: 'tenant_admin',
        status: 'pending',
        invited_by: caller.userId,
      })
      .select('id, email, role, expires_at')
      .single();
    if (invitationError || !invitation) {
      console.error(invitationError);
      // The company is real and usable; only the invitation failed. Reported
      // rather than rolled back, so the operator can retry from the console.
      return jsonResponse(
        { tenant, invited: false, emailSent: false, warning: 'The administrator invitation could not be recorded.' },
        207,
      );
    }

    const { error: sendError } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
      data: {
        display_name: adminName,
        invited_tenant_id: tenant.id,
        invited_role: 'tenant_admin',
        company_name: tenant.name,
      },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (sendError) {
      console.error(sendError);
      return jsonResponse(
        {
          tenant,
          invitation,
          invited: true,
          emailSent: false,
          warning: 'The company and invitation were created, but the email could not be sent. Resend it from the Invitations tab.',
        },
        207,
      );
    }

    await admin
      .from('tenants')
      .update({ onboarding_email_sent_at: new Date().toISOString() })
      .eq('id', tenant.id);

    return jsonResponse({ tenant, invitation, invited: true, emailSent: true });
  }),
);
