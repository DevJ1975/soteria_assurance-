# Firebase Data Connect — Soteria Assurance

Firebase **Data Connect** provisions a managed **Cloud SQL for PostgreSQL**
instance and exposes a typed **GraphQL** API over it. This directory defines that
service: a relational projection of the core domain (DESIGN_DOC §8).

## Where it fits in the architecture

This is an **optional, additive** layer — it does **not** replace Cloud
Firestore:

| Concern | Store |
| --- | --- |
| Offline-first mobile sync (WatermelonDB ⇄ Firestore), live audit capture, security rules | **Firestore** (unchanged) |
| Relational reporting, cross-tenant aggregates, joins (audits → findings → corrective actions), analytics | **Data Connect / Cloud SQL** (this directory) |

Keep table/enum names in lock-step with `@soteria/core` types so the two layers
stay reconcilable. Tenant isolation (multi-agent-guide RULE 2) is enforced in the
connector operations: `tenantId` is bound server-side from the
`auth.token.tenantId` custom claim (set by the `setTenantClaims` Cloud Function)
and is never accepted from the client.

## Layout

```
dataconnect/
├── dataconnect.yaml          ← service id, location, Cloud SQL datasource
├── schema/
│   └── schema.gql            ← PostgreSQL tables (@table) mirroring §8
└── connector/
    ├── connector.yaml        ← generated SDK config (@soteria/dataconnect)
    ├── queries.gql           ← tenant-scoped reads
    └── mutations.gql         ← tenant-scoped writes
```

## Provisioning (requires GCP billing on `soteria-assurance`)

Cloud SQL is a billed resource, so this cannot be provisioned from CI without
privileged access. From a machine logged in with `firebase login`:

```bash
# 1. Install the CLI if needed
npm i -g firebase-tools

# 2. Link/create the Cloud SQL instance + Postgres database for this service.
#    Update dataconnect.yaml `instanceId`/`database` to match what it creates.
firebase init dataconnect

# 3. Generate the typed client SDK (output is git-ignored).
firebase dataconnect:sdk:generate

# 4. Deploy schema + connectors (creates tables, applies the GraphQL API).
firebase deploy --only dataconnect
```

## Local development

```bash
# Start the Data Connect emulator (port 9399, see firebase.json) with the others.
firebase emulators:start
```

The emulator runs a local Postgres via the Data Connect toolkit so queries can be
exercised without touching the billed Cloud SQL instance.
