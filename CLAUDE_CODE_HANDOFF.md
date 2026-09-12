# Soteria Assurance — Claude Code Handoff

## Mission

Continue the Firebase-to-Supabase migration and finish the Soteria Assurance ISO 45001 audit-management platform. Work locally first with Docker Supabase, validate thoroughly, and only push to hosted Supabase after the schema, RLS policies, authentication, storage, and end-to-end workflows are reviewed.

Do not commit secrets. Do not expose passwords, service-role keys, or access tokens in source code, logs, screenshots, or this document.

## Repository

- Repository: `DevJ1975/soteria_assurance-`
- Local path: `/Users/jamiljones/Soteria Assurance/soteria_assurance-`
- Package manager: pnpm `10.33.0`
- Local Supabase project ID: `soteria-local`
- Hosted Supabase project ref: `wimedmduiwxlcglbpoae`

## Local services

- Web app: `http://localhost:3000`
- Supabase API: `http://127.0.0.1:54321`
- Supabase database: `127.0.0.1:54322`
- Supabase Studio: `http://127.0.0.1:54323`
- Supabase Mailpit: `http://127.0.0.1:54324`

The local frontend environment is in the ignored file `apps/web/.env.local`. Never commit it.

## Work already completed

### Firebase removal

Firebase infrastructure and web dependencies were removed, including:

- `functions/`
- `packages/firebase/`
- Firebase configuration and rules
- Firebase Data Connect files
- Firebase deployment workflow/scripts
- Firebase dependencies from the web workspace

The mobile application still contains Firebase references and is not fully migrated.

### Supabase setup

Created:

- `supabase/config.toml`
- `supabase/seed.sql`
- Initial relational migration:
  `supabase/migrations/20260912031500_initial_soteria_schema.sql`
- Superadmin migration:
  `supabase/migrations/20260912040000_superadmin_management.sql`
- Browser/server/middleware Supabase helpers under `apps/web/utils/supabase/`
- Web Supabase data access:
  `apps/web/lib/supabase-data.ts`
- Web Supabase function/storage wrapper:
  `apps/web/lib/supabase-functions.ts`
- Supabase Auth context:
  `apps/web/lib/auth-context.tsx`
- Next middleware:
  `apps/web/middleware.ts`

The schema includes:

- Tenants
- Profiles
- Clients
- Audits
- Findings
- Corrective actions
- Clause assessments
- Evidence
- Auditor invitations

RLS is enabled on the application tables and on `auditor_invitations`. Tenant access is derived through `public.current_tenant_id()`. Superadmin access is checked through `public.is_super_admin()`.

### Superadmin console

Implemented routes:

- `/superadmin/login`
- `/superadmin`

Implemented functionality:

- Separate superadmin login
- Superadmin route guard
- Company/tenant creation
- Tenant type selection
- Auditor invitation record creation
- Auditor role selection
- Company list
- Invitation list

Relevant files:

- `apps/web/app/superadmin/login/page.tsx`
- `apps/web/app/superadmin/page.tsx`
- `apps/web/components/SuperadminGuard.tsx`
- `apps/web/lib/supabase-admin-data.ts`

Important: invitations are currently database records only. Email delivery and automatic Auth-user/profile provisioning still need a server-side Edge Function.

### Authentication and runtime changes

- Web auth uses Supabase email/password, Google OAuth, and phone OTP.
- Auth profile lookup resolves tenant type from the `tenants` table.
- Users without a profile no longer remain on an indefinite loading screen; they see an organization-access-pending state.
- Registration no longer sends a user directly into the dashboard before organization assignment.
- Static export was removed from `apps/web/next.config.mjs` so Supabase session middleware can run on a runtime-capable host.

## Current validation

These commands have passed for the web app:

```bash
pnpm --filter @soteria/web typecheck
pnpm --filter @soteria/web lint
pnpm --filter @soteria/web build
supabase db reset --local --yes
```

The build uses Next.js middleware and therefore requires a runtime-capable deployment. Do not restore `output: 'export'` unless middleware/session refresh is removed and the deployment architecture is intentionally static.

## Immediate blockers and incomplete work

Prioritize these in order:

1. **Recreate local admin access after database resets**
   - The prior local Auth user/profile was removed by a database reset.
   - Create a local superadmin using a safe local-only script or documented CLI procedure.
   - Do not place the password in a migration or seed file.

2. **Finish backend hardening**
   - Add append-only audit/event logging for changes to audits, findings, corrective actions, clause assessments, evidence, profiles, tenants, and invitations.
   - Include actor ID, tenant ID, event type, entity ID, before/after JSON where appropriate, and timestamp.
   - Prevent ordinary clients from updating/deleting audit-log rows.

3. **Implement clause-assessment reads and writes**
   - `apps/web/lib/hooks.ts` currently has a placeholder `useClauseAssessments` query returning `[]`.
   - Add typed Supabase helpers and wire the clause assessment UI to persistence.

4. **Configure Supabase Storage**
   - Add private buckets for:
     - evidence
     - signatures
     - reports
     - corrective-action evidence
     - recordings, if required by the product
   - Add object-path conventions containing tenant/audit/entity IDs.
   - Add storage RLS policies enforcing tenant isolation.
   - Use signed URLs; do not expose private objects publicly.

5. **Complete auditor invitation onboarding**
   - Implement a server-side Edge Function using the service-role key only on the server.
   - Send an Auth invitation email.
   - Link the accepting Auth user to the pending invitation.
   - Create/update the `profiles` row with the selected tenant and role.
   - Validate invitation expiry, revocation, duplicate email, and tenant isolation.

6. **Implement missing Edge Functions**
   - NCR drafting
   - Suggested audit questions
   - Evidence analysis
   - Meeting summarization
   - Report generation/PDF creation
   - Corrective-action reminders and escalation
   - Invitation email/onboarding

7. **Finish mobile migration**
   - Mobile still references Firebase in:
     - `apps/mobile/services/aiService.ts`
     - `apps/mobile/services/reportService.ts`
     - `apps/mobile/services/syncManager.ts`
     - `apps/mobile/services/evidenceService.ts`
     - `apps/mobile/app/(auth)/login.tsx`
     - `apps/mobile/app/(auth)/register.tsx`
     - `apps/mobile/app/(app)/audits/[auditId]/report.tsx`
     - `apps/mobile/stores/authStore.ts`
   - Replace Firebase Auth, Storage, callable Functions, and data synchronization with Supabase equivalents.
   - Preserve offline-first behavior and tenant scoping.

8. **Complete corrective-action controls**
   - Add due-date reminders.
   - Add overdue escalation.
   - Add effectiveness-review workflow.
   - Record review decisions and evidence.

9. **Add authenticated end-to-end tests**
   Test at minimum:

   - Standard login
   - Superadmin login
   - Company creation
   - Auditor invitation
   - Invitation acceptance
   - Tenant isolation
   - Client creation
   - Audit creation
   - Clause assessment save/read
   - Finding creation
   - Corrective-action creation/review
   - Evidence upload/download authorization
   - Report generation
   - Sign-out/session refresh

## ISO 45001 mock-audit findings

The product is currently **partially implemented and not production-ready**.

### Critical

- Invitation records previously lacked RLS; this has been corrected.
- Invitation email/Auth provisioning is not implemented.
- Storage buckets and private object policies are not fully implemented.
- Complete audit trail/event history is not implemented.
- AI/report/reminder backend functions are not implemented.

### High

- Evidence chain of custody and verification history need stronger controls.
- Corrective-action reminders and effectiveness verification are incomplete.
- Mobile still depends on Firebase.
- Production deployment must support Next.js middleware.

### Medium

- Clause-assessment persistence is incomplete.
- Registration/onboarding needs invitation-controlled tenant assignment.
- Tenant type should remain database-derived, not hardcoded.

## Security requirements

- Never use the Supabase service-role key in browser/mobile code.
- Never trust a tenant ID supplied by a client without validating it against the authenticated profile.
- Every tenant-owned table must have RLS.
- Keep invitation, audit-log, and storage policies deny-by-default.
- Use signed URLs for private files.
- Add explicit authorization checks to every Edge Function.
- Do not silently catch database or authentication errors.
- Do not expose internal database errors directly to end users in production.

## Recommended workflow

1. Inspect the current working tree before editing; preserve unrelated user changes.
2. Run `supabase db reset --local --yes`.
3. Recreate a local superadmin safely.
4. Implement backend schema/storage/audit-log changes.
5. Implement invitation onboarding Edge Function.
6. Complete clause-assessment data access.
7. Migrate mobile Firebase usage.
8. Run web and mobile typechecks/lint.
9. Run authenticated end-to-end tests against local Docker Supabase.
10. Run Supabase security advisors and review every warning.
11. Review migration and RLS changes manually.
12. Only then consider `supabase db push` to hosted project `wimedmduiwxlcglbpoae`.

## Do not do yet

- Do not push migrations to hosted Supabase without explicit review.
- Do not commit `.env.local` files.
- Do not commit service-role keys, personal access tokens, or passwords.
- Do not delete unrelated working-tree changes.
- Do not restore Firebase as a shortcut.

