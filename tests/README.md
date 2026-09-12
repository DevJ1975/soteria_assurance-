# @soteria/e2e

Authenticated end-to-end tests against a **local** Supabase stack.

```bash
supabase start          # the tests need the stack running
pnpm test:e2e           # from the repo root — supplies the keys for you
```

## Why these are integration tests, not unit tests

Almost everything worth asserting here is enforced by Postgres, not by
application code: tenant isolation, who may change their own role, whether an
invitation actually provisions a profile, whether an object in a private bucket
is readable by another tenant. Mocking the Supabase client would assert that
the mock behaves as written — which is precisely the class of thing that has
been wrong in this repository before.

So every test signs a real user in and talks to a real database. The
service-role client is used only to build fixtures and clean up.

## What is covered

| Suite | Covers |
|---|---|
| `auth` | sign-in, wrong password, session refresh, sign-out revoking access, a user with no profile resolving to no tenant |
| `tenant-isolation` | cross-tenant read/write/update/delete across all six business tables, plus the audit log |
| `privilege-escalation` | a user cannot promote its own role or move tenant; can still rename itself; cannot enumerate invitations |
| `superadmin` | cross-tenant visibility, company creation, role changes, invitation acceptance through the real trigger, revoked invitations provisioning nobody |
| `audit-lifecycle` | client and audit creation, clause assessment round-trip, raising a finding, closing one only via an accepted effectiveness review, append-only audit log |
| `storage` | the evidence bucket is private; upload and download are confined to the caller's tenant prefix |

## Running serially is deliberate

`--runInBand`. The suites create and delete tenants; parallel workers would see
each other's rows and make every isolation assertion meaningless.

## These are regression tests, not decoration

`privilege-escalation` exists because the profiles UPDATE policy shipped without
a `WITH CHECK`, leaving `role` writable by its owner — the exact column
`is_super_admin()` reads. Restoring the vulnerable policy makes three of its
four tests fail, which is how it was verified to be worth having.
