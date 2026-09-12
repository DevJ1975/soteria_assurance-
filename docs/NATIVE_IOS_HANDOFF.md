# Soteria Assurance — Native iOS (Swift/SwiftUI) Build Handoff

> **Use this as the master prompt for building the native iOS app.** Hand the whole
> file to your coding agent in Xcode (or read it top-to-bottom as a developer). It
> is self-contained: it describes the product, the existing Firebase backend you must
> talk to (and must **not** rebuild), the exact data/API contract, the design system,
> and a screen-by-screen, offline-first build plan. Field names, Firestore paths, and
> callable signatures are authoritative — they were extracted from the live monorepo.

---

## 0. How to use this prompt

Paste the following into your AI coding assistant once the repo is cloned in Xcode:

> You are building **Soteria Assurance for iOS**, a native SwiftUI app for ISO 45001:2018
> occupational-health-&-safety auditors. A complete TypeScript monorepo already exists in
> this repository with the **production Firebase backend, domain model, design system, and a
> React Native reference app**. You are NOT rebuilding the backend — you are building a new
> native client against it. Read `docs/NATIVE_IOS_HANDOFF.md` in full, then `docs/DESIGN_DOC.md`
> for product depth. Treat `packages/core` (domain types + ISO clause data), `packages/firebase`
> (the backend contract), `firestore.rules`, `storage.rules`, and `functions/src` (the callable
> API) as the **source of truth**. Mirror their field names exactly so both clients interoperate
> on the same Firestore documents. Build offline-first: a local store is the source of truth and
> a background sync engine reconciles with Firestore. Honor every rule in §3. Start with Phase 0
> (project + Firebase wiring) and proceed phase by phase, asking me to confirm at each milestone.

The rest of this document is the reference the agent will work from.

---

## 1. Mission & product context

**Soteria Assurance** is a mobile-first, **offline-capable** platform that guides a lead auditor
**clause-by-clause** through the full ISO 45001:2018 standard, captures **photo/audio evidence**
in the field, records **findings** (Major NC / Minor NC / OFI / Strong Point / Observation),
tracks **corrective actions**, and uses an **AI Co-Pilot** (Anthropic Claude, server-side only) to
draft nonconformity reports, suggest interview questions, and analyze evidence photos. It is
**multi-tenant**: every record lives under a tenant, and a user may only ever touch their own
tenant's data.

The native iOS app is the **field tool** for auditors (iPhone + iPad). It must work with **no
network** in a factory/site and sync when connectivity returns. The existing Expo app in
`apps/mobile/` is the **reference implementation** — match its feature set and offline guarantees;
you do not need to match its code.

**Personas / tenant types:** Certification Body (`cb`), Audit Consultancy (`consultancy`),
Enterprise internal audit (`enterprise`).

---

## 2. What already exists (do NOT rebuild)

| Layer | Where | You consume it as… |
| --- | --- | --- |
| **Firebase project** | `.firebaserc` → project id **`soteria-assurance`** | Add an iOS app to this project; drop in `GoogleService-Info.plist` |
| **Firestore data model + security rules** | `firestore.rules`, `firestore.indexes.json`, `packages/firebase/src/firestore.ts` | Read/write the exact tenant-scoped paths in §6 |
| **Cloud Storage layout + rules** | `storage.rules`, `packages/firebase/src/storage.ts` | Upload evidence/recordings/signatures to the paths in §6.5 |
| **Cloud Functions (the API)** | `functions/src/**` | Call as `httpsCallable` (§6.4) — AI, claims, report, reminders |
| **Domain model (types, enums, RBAC)** | `packages/core/src/types`, `.../constants` | Re-declare as Swift `Codable` structs (§7) |
| **Canonical ISO 45001 clause dataset (53 clauses)** | `packages/core/src/iso45001/` | Export to JSON, bundle in the app (§8) |
| **Design tokens + finding colors** | `packages/ui/src/tokens/` | Translate to a Swift design system (§9) |
| **Reference RN app (feature parity target)** | `apps/mobile/` | Blueprint for screens + offline sync (§10–§11) |
| **Product design doc** | `docs/DESIGN_DOC.md` | Deep product/UX context |

> **Golden rule:** both clients write the **same Firestore documents**. If you rename a field,
> sync breaks. Keep field names byte-for-byte identical to `packages/core/src/types`.

---

## 3. Non-negotiable rules

These come from `docs/multi-agent-guide.md`, `docs/DESIGN_DOC.md` §7/§13, and the security rules.
They are enforced server-side; if you violate them, writes will be **rejected** by Firestore/Storage.

1. **Tenant isolation (RULE 2).** Every document lives under `tenants/{tenantId}/…`. There are
   **no root collections** for audit data. The user's `tenantId` comes from their JWT **custom
   claims** and must equal the `{tenantId}` in every path. Persist `tenantId` locally so it's
   available offline on cold start. Never query across tenants.
2. **No API keys on the client (RULE 3).** All AI/LLM and email calls happen **only** in Cloud
   Functions (secrets via `defineSecret()`). The app calls `httpsCallable`; it never holds the
   Anthropic or SendGrid key.
3. **AI output is advisory.** Every AI result carries a mandatory **disclaimer** ("AI-generated —
   auditor must review and approve"). Always show it; the auditor must review/edit before the text
   is committed to a finding/report. AI-only fields (`aiDraftStatement`, `aiAnalysis`,
   `aiHazardsDetected`) are **server-written only** — the client can read but never write them.
4. **Reported-audit immutability (RULE / §13).** Once an audit's `status == 'report_issued'`, its
   **findings and evidence become read-only** to clients, and evidence files can **never** be
   deleted by a client. Design the UI to lock these records.
5. **Offline-first, local-first writes (RULE 9).** Every mutation writes to the **local store
   first**, then a background sync pushes to Firestore. The UI must **never block** on the network.
6. **Canonical strings & clause data (RULE 4).** All user-facing copy and all ISO clause
   numbers/titles/requirements come from the shared source (`@soteria/core`). Don't hardcode clause
   text in views — bundle the exported dataset (§8) and a strings catalog (§9.4).
7. **Design tokens (RULE 5).** All colors/spacing/typography come from the token set (§9). No magic
   hex values or pixel literals in views.
8. **Tests.** Mirror the repo's discipline: unit-test the domain logic you port (numbering,
   deadlines, scoring, validators) and the sync engine.

---

## 4. iOS project setup (Phase 0)

1. **Create the app target.** Xcode → new **App**, SwiftUI lifecycle, min iOS **16.0** (17+
   preferred for SwiftData/Observation), name e.g. `SoteriaAssurance`. Universal (iPhone + iPad).
2. **Add Firebase via Swift Package Manager:** `https://github.com/firebase/firebase-ios-sdk`.
   Add products: **FirebaseAuth, FirebaseFirestore, FirebaseFirestoreSwift (Codable),
   FirebaseStorage, FirebaseFunctions** (and optionally FirebaseAppCheck, FirebaseAnalytics).
3. **Register the iOS app** in the Firebase console under project **`soteria-assurance`**, download
   **`GoogleService-Info.plist`**, add it to the target. Call `FirebaseApp.configure()` in the
   `App` init / `AppDelegate`.
4. **Auth providers to enable** in console: **Email/Password** and **Google** (the app's primary
   flows). Phone auth is web-only in the reference app — skip on iOS unless you add the native flow.
   For Google on iOS, add **GoogleSignIn-iOS**, set the reversed-client-id URL scheme, exchange the
   Google `idToken` for a Firebase credential.
5. **Emulator support (recommended for dev).** The repo ships emulators (`firebase.json`): Auth
   `9099`, Firestore `8080`, Functions `5001`, Storage `9199`. Add a debug flag that points the SDK
   at `localhost` so you can develop without touching prod. Run `pnpm emulators` (or
   `firebase emulators:start`) from the repo root.
6. **Public config** (safe to ship) mirrors the env keys in `.env.example`:
   `FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID(soteria-assurance) / STORAGE_BUCKET /
   MESSAGING_SENDER_ID / APP_ID / MEASUREMENT_ID` — but with `GoogleService-Info.plist` you get
   these automatically; you do **not** hand-roll the config.
7. **Secrets:** none in the app. `ANTHROPIC_API_KEY` and `SENDGRID_API_KEY` live in Firebase Secret
   Manager and are used only by functions.

---

## 5. Recommended architecture & tech stack

| Concern | Recommendation | Mirrors RN app's… |
| --- | --- | --- |
| UI | **SwiftUI**, SF Symbols for iconography | React Native Paper screens |
| Local store (source of truth) | **SwiftData** (iOS 17+) or **Realm**/GRDB | WatermelonDB (SQLite) |
| Remote | Firestore + Storage + Functions (native SDKs) | `firebase` JS SDK |
| Server-state cache | SwiftData + async/await; optional Combine | TanStack Query |
| App state | `@Observable` view-models / a light store | Zustand stores |
| Connectivity | `NWPathMonitor` (Network framework) | `@react-native-community/netinfo` |
| Camera / audio / location | **AVFoundation** (capture), **PhotosUI**, **CoreLocation** | expo-camera / expo-av / expo-location |
| Image compression | `ImageIO` / `UIGraphicsImageRenderer` (resize ≤1600px, JPEG ~0.7) | expo-image-manipulator |
| Background sync | `async` sync engine + **BGTaskScheduler** for opportunistic syncs | `syncManager` |
| Crash safety | error boundary equivalent: catch + persist diagnostics to `UserDefaults`, show recovery UI | `AuditErrorBoundary` |

**Suggested module layout:**
```
SoteriaAssurance/
├── App/                     // App entry, Firebase config, root nav, error recovery
├── DesignSystem/            // Tokens.swift, Typography, Colors, components (Badge, Card, Button…)
├── Domain/                  // Codable models + enums (§7), numbering/deadline/scoring helpers (§12)
├── ISO45001/                // bundled clauses.json + loader + helpers (§8)
├── Data/
│   ├── Local/               // SwiftData models (mirror sync schema §11) + repositories
│   ├── Remote/              // Firestore paths, Storage, Functions wrappers (§6)
│   └── Sync/                // SyncEngine: push/pull, evidence two-phase upload, status (§11)
├── Features/                // One folder per screen group (Auth, Dashboard, Audits, Clauses,
│                            //   Findings, Evidence, Meetings, CorrectiveActions, Clients,
│                            //   Reports, Wiki, Settings) — see §10
└── Common/                  // Auth/session, RBAC gate, sync indicator, state views
```

---

## 6. Backend contract (authoritative)

### 6.1 Firestore collection paths

Everything is rooted at `tenants/{tenantId}`. Subcollections hang off an audit.

```
tenants/{tenantId}                                  → Tenant
  users/{userId}                                    → User
  clients/{clientId}                                → Client
  audits/{auditId}                                  → Audit
    clauses/{clauseId}                              → ClauseAssessment   (clauseId often = clause number)
    findings/{findingId}                            → Finding
    evidence/{evidenceId}                           → Evidence
    meetings/{meetingId}                            → Meeting
    witnessStatements/{statementId}                 → WitnessStatement
  correctiveActions/{caId}                          → CorrectiveAction   (tenant-level, references a finding)
  templates/{templateId}                            → AuditTemplate
  reports/{reportId}                                → Report             (server-written)
  aiLogs/{logId}                                    → AILogEntry         (server-written; read = admins/lead)
/wiki/{articleId}                                   → WikiArticle        (cross-tenant, read by any authed user)
/system/{document=**}                               → SystemConfig       (read any authed; write super_admin)
```

Use a single path helper, e.g. `tenantRef(tenantId).collection("audits").document(auditId).collection("findings")`.
**Never** hardcode a root-level audit/finding collection. The reference helpers
(`packages/firebase/src/firestore.ts`) throw if `tenantId` is empty — do the same.

### 6.2 Auth & custom claims

After sign-in, read the ID token result; the JWT carries **custom claims** that drive everything:

```swift
// Auth.auth().currentUser?.getIDTokenResult(forcingRefresh:) → result.claims
struct FirebaseCustomClaims {            // keys in the JWT
  let tenantId: String                   // MUST equal the {tenantId} in every path
  let tenantType: String                 // "cb" | "consultancy" | "enterprise"
  let role: UserRole                     // see §7 enum
  let permissions: [String]              // granular RBAC (§7.3)
  let clientIds: [String]?               // optional: which clients this user may access
}
```

- Claims are **set server-side** by the `setTenantClaims` callable (§6.4) — the app does not set
  them itself (only super/tenant admins can, typically from the web console).
- After claims change, call `getIDTokenResult(forcingRefresh: true)` to pick them up immediately.
- Persist `tenantId`, `role`, `permissions` locally so the app can scope queries and gate UI while
  offline. Gate every screen/action by `permissions` per the RBAC matrix (§7.3).

### 6.3 Security model — what the client may write

The rules (`firestore.rules`) enforce, per tenant + role:

- **Baseline:** read = any tenant member with a valid role; write = `super_admin | tenant_admin |
  lead_auditor | auditor` (auditee/viewer are read-only by default).
- **Users:** write only by `super_admin | tenant_admin`.
- **Findings:** create only while audit ≠ `report_issued`; **cannot** set AI fields
  (`aiDraftStatement`); `nonconformityStatement` (auditor-confirmed) is **lead_auditor-only**;
  **no client deletes**; **no edits once `report_issued`**.
- **Evidence:** create only while audit ≠ `report_issued`; cannot set `aiAnalysis` /
  `aiHazardsDetected`; **no client deletes ever**; locked once `report_issued`.
- **Corrective actions:** create/update by `super_admin | tenant_admin | lead_auditor | auditor |
  auditee` (auditees submit closure evidence); no client deletes.
- **Reports / aiLogs:** server-written only (clients read; aiLogs readable by admins + lead only).
- **Wiki / system:** cross-tenant read for authed users; write super_admin only.

Design the UI so disabled/locked states match these rules — don't offer actions the server will
reject.

### 6.4 Cloud Functions — callable API (exact signatures)

All are **`httpsCallable`** (Firebase Functions SDK). Every AI call requires the `ai_copilot`
permission, validates `tenantId` against the caller's claim, is rate-limited to **100
requests/tenant/hour**, logs to `aiLogs`, and returns a **disclaimer + model id**. They throw
`permission-denied`, `resource-exhausted` (rate limit), or `unavailable` (AI failure).

**`draftNCR`** — draft a nonconformity report from field notes.
```
in:  { tenantId, clauseNumber, clauseTitle, requirementText, auditorRawNotes,
       organizationContext, evidenceDescription? }
out: { aiDraft: { ncrTitle, requirementStatement, findingStatement, objectiveEvidenceStatement,
                  suggestedSeverity: "major"|"minor", severityJustification, relatedClauses: [String] },
       disclaimer, model }
```

**`suggestQuestions`** — interview questions for a clause/role/industry.
```
in:  { tenantId, clauseNumber, clauseTitle, intervieweeRole, industry, questionCount?, previousResponses? }
out: { questions: [String], raw, disclaimer, model }
```

**`analyzeEvidence`** — multimodal photo analysis.
```
in:  { tenantId, imageBase64 (no data: prefix), mediaType: "image/jpeg"|"image/png"|"image/webp"|"image/gif",
       contextDescription? }
out: { aiAnalysis: { description, hazardsDetected: [String], potentialClauseViolations: [String],
                     suggestedFinding, raw }, disclaimer, model }
```

**`generateReportSection`** — narrative section for a report.
```
in:  { tenantId, sectionType: "executive_summary"|"audit_conclusion"|"clause_commentary"|"certification_recommendation",
       auditSummary }
out: { aiDraftSection, sectionType, disclaimer, model }
```

**`generateReport`** — assemble report data + HTML (needs `export_reports`).
```
in:  { tenantId, auditId }
out: { data: { audit, client|null, findings: [Finding], generatedAt }, html }
```

**`setTenantClaims`** — provision a user's claims (super/tenant admin only; tenant admin confined to
own tenant, can't grant super_admin). Usually driven from the web console, but documented for
completeness.
```
in:  { targetUid, tenantId, tenantType, role, clientIds? }
out: { targetUid, claims: FirebaseCustomClaims }
```

**Triggers/schedulers (no client call needed, but be aware):**
- `onAuditComplete` (Firestore trigger) recomputes the audit's `findings` summary when status moves
  to `findings_review/report_pending/report_issued/closed`. So after you change audit status, the
  summary updates server-side — re-read it rather than computing locally for the canonical value.
- `caReminders` (daily 08:00 UTC) emails corrective-action reminders at 30/14/7 days before due.

### 6.5 Cloud Storage paths

All under `tenants/{tenantId}/…`; client deletes are **never** allowed. Sanitize file names (replace
`/` with `_`).

```
tenants/{tenantId}/audits/{auditId}/evidence/{fileName}      images ≤25MB, image/* (auditors)
tenants/{tenantId}/audits/{auditId}/recordings/{fileName}    media ≤500MB (meeting/witness audio)
tenants/{tenantId}/audits/{auditId}/signatures/{fileName}    images ≤25MB (auditors + auditee)
tenants/{tenantId}/correctiveActions/{caId}/{fileName}       media ≤500MB (incl. auditee closure)
tenants/{tenantId}/reports/{fileName}                        server-written PDFs
tenants/{tenantId}/branding/{fileName}                       images ≤25MB (admins)
```

Flow: upload bytes → get download URL → store the URL on the corresponding Firestore document's
`fileUrl`.

---

## 7. Domain model → Swift `Codable` structs

Re-declare these to match `packages/core/src/types` **exactly**. Firestore timestamps decode to
`Date` via `@DocumentID`/`Timestamp` (FirebaseFirestoreSwift). Optional TS fields → Swift optionals.

### 7.1 Enums (use exact string raw values)

```swift
enum TenantType: String, Codable { case cb, consultancy, enterprise }        // in claims
// NOTE: Tenant.type uses long form:
enum TenantKind: String, Codable { case certification_body, consultancy, enterprise }

enum UserRole: String, Codable { case super_admin, tenant_admin, lead_auditor, auditor, auditee, viewer }

enum AuditType: String, Codable { case initial_certification, surveillance, recertification, internal, special }
enum AuditStage: String, Codable { case stage_1, stage_2, not_applicable }
enum AuditStatus: String, Codable { case planned, in_progress, findings_review, report_pending, report_issued, closed, canceled }

enum FindingType: String, Codable { case major_nc, minor_nc, ofi, strong_point, observation }
enum FindingSeverity: String, Codable { case major, minor }
enum FindingStatus: String, Codable { case open, acknowledged, ca_submitted, ca_review, closed, overdue }
enum CAStatus: String, Codable { case pending, in_progress, submitted, accepted, rejected, closed }

enum ConformityStatus: String, Codable { case conforming, major_nc, minor_nc, not_audited, not_applicable }
enum ConformityVerdict: String, Codable { case yes, no, partial, na }

enum EvidenceType: String, Codable { case photo, video, document, screenshot, audio, signature }
enum RootCauseMethod: String, Codable { case five_why, eightD = "8d", fishbone, free_form }
enum WikiCategory: String, Codable { case clause_guide, audit_technique, finding_guidance, legal_reference, best_practice, template_guide, platform_help, glossary }
```

**Finding-type metadata** (port `FINDING_TYPE_META`): code, label, CA window, color.

| type | code | label | CA window | color |
| --- | --- | --- | --- | --- |
| `major_nc` | MNC | Major Nonconformity | 60 days | `#C0392B` |
| `minor_nc` | NC | Minor Nonconformity | 90 days | `#E67E22` |
| `ofi` | OFI | Opportunity for Improvement | — | `#2980B9` |
| `strong_point` | SP | Strong Point | — | `#8E44AD` |
| `observation` | OBS | Observation | — | `#6B7280` |

### 7.2 Entities (fields — `?` = optional)

**Tenant**: `id, name, type(TenantKind), logo?, subscriptionTier(starter|professional|enterprise),
subscriptionStatus(active|trialing|past_due|canceled), maxAuditors, maxAuditsPerMonth, settings,
createdAt, updatedAt`.
`TenantSettings`: `timezone, defaultLanguage, requireEvidencePerFinding, requireWitnessStatement,
autoGenerateNCRNumbers, ncrPrefix, reportTemplate(standard|minimal|comprehensive), brandingColor?,
brandingLogo?`.

**User**: `id, tenantId, email, displayName, avatarUrl?, role(UserRole), qualifications[],
clientIds[], isActive, lastLoginAt?, createdAt`.
`AuditorQualification`: `standard, level(lead_auditor|auditor|trainee), certBody, certNumber,
issuedDate, expiryDate, documentUrl?`.

**Client**: `id, tenantId, organizationName, industry, address, contactName, contactEmail,
contactPhone, numberOfEmployees, numberOfSites, sites[],
certificationStatus(not_certified|certified|expired|suspended), certificationBody?,
certificationExpiry?, auditHistory[], createdAt, updatedAt`.
`ClientAddress`: `street, city, state, country, postalCode, coordinates?{lat,lng}`.
`ClientSite`: `siteId, siteName, address, siteContactName, siteContactEmail, numberOfWorkers,
hazardCategory(low|medium|high|very_high)`.

**Audit**: `id, tenantId, clientId, auditNumber, auditType, auditStage, standard("ISO 45001:2018"),
scope, status, leadAuditorId, auditTeam[], managementRepresentativeId?,
managementRepresentativeName, plannedStartDate, plannedEndDate, actualStartDate?, actualEndDate?,
auditDays, sitesInScope[], auditPlan, findings(summary), aiCertificationReadinessScore?,
aiRiskFlags?[], confidentiality(standard|restricted), createdAt, updatedAt, completedAt?,
reportIssuedAt?`.
`AuditTeamMember`: `userId, displayName, role(lead_auditor|auditor|technical_expert|observer),
clauseAssignments[]`.
`AuditPlan`: `activities[], documentReviewList[], intervieweeList[], areaInspectionList[]`
(`AuditPlanActivity`: `activityId, time, duration, activity, clauses[], location, auditorIds[],
intervieweeIds[]`; `AuditInterviewee`: `intervieweeId, name, jobTitle, department, topics[],
scheduledTime?`; `AuditInspectionArea`: `areaId, name, hazards[], clauses[], scheduledTime?`).
`AuditFindingsSummary`: `totalFindings, majorNCs, minorNCs, ofis, strongPoints, observations,
closedNCs, openNCs`.

**Finding**: `id, auditId, tenantId, clientId, findingNumber, type(FindingType),
severity?(FindingSeverity), clauseNumber, clauseTitle, requirement, title, objectiveEvidence,
nonconformityStatement, aiDraftStatement?(server-only), siteId?, department?, area?, evidenceIds[],
raisedByAuditorId, raisedByAuditorName, raisedAt, acknowledgedByName?, acknowledgedBySignatureUrl?,
acknowledgedAt?, correctiveActionId?, correctiveActionStatus?(CAStatus), targetClosureDate?,
actualClosureDate?, status(FindingStatus), closedAt?, closedByAuditorId?, updatedAt`.

**CorrectiveAction**: `id, tenantId, clientId, auditId, findingId, caNumber, title,
rootCauseMethod(RootCauseMethod), rootCauseAnalysis, immediateAction, correctiveAction,
preventiveAction, effectivenessCheck, effectivenessCheckDate?,
effectivenessResult?(effective|not_effective), responsiblePersonName, responsiblePersonEmail,
targetDate, submittedDate?, reviewedDate?, closedDate?, closureEvidenceIds[], closureNotes?,
reviewedByAuditorId?, reviewNotes?, status(CAStatus), aiRootCauseSuggestion?, history[], createdAt,
updatedAt`. `CAHistoryEntry`: `timestamp, action, performedBy, notes?`.

**Evidence**: `id, auditId, tenantId, type(EvidenceType), title, description, fileUrl, fileName,
fileSize, mimeType, thumbnailUrl?, capturedAt, capturedByAuditorId, geoLocation?{lat,lng,accuracy,
address?}, clauseNumbers[], findingIds[], aiAnalysis?(server-only), aiHazardsDetected?[](server-only),
isVerified, verifiedAt?, verifiedByAuditorId?`.

**Meeting**: `id, auditId, tenantId, type(opening|closing), scheduledAt, actualStartAt?,
actualEndAt?, duration?, location, isVirtual, virtualLink?, attendees[], agendaItems[],
recordingUrl?, recordingDuration?, transcription?, aiSummary?, keyDecisions?[], actionItems?[],
findingsSummaryPresented?, signatureUrls[], status(scheduled|in_progress|completed|canceled), notes,
createdAt, updatedAt`. (`MeetingAttendee`, `MeetingAgendaItem`, `MeetingActionItem`,
`MeetingSignature` substructs per §7 of the core types.)

**WitnessStatement**: `id, auditId, tenantId, intervieweeName, intervieweeJobTitle,
intervieweeDepartment, intervieweeEmployeeId?, clausesDiscussed[], interviewDate, interviewDuration,
location, questions[], generalNotes, aiInterviewSummary?, audioRecordingUrl?, audioTranscription?,
consentGiven, intervieweeSignatureUrl?, auditorSignatureUrl?, conductedByAuditorId,
conductedByAuditorName, createdAt`. `WitnessQuestion`: `questionId, clauseReference, question,
response, auditorNote?, isKey`.

**ClauseAssessment**: `id, auditId, tenantId, clauseNumber, clauseTitle, assignedAuditorId,
conformityStatus(ConformityStatus), score(0–100), auditorNotes, aiGeneratedSummary?, evidenceIds[],
findingIds[], subClauseNotes[], isComplete, completedAt?, updatedAt`. `SubClauseNote`:
`subClauseNumber, requirementText, auditQuestion, auditorResponse, conformityVerdict(ConformityVerdict),
aiSuggestedFollowUp?`.

**WikiArticle**: `id, tenantId?(absent = global), category(WikiCategory), clauseReference?, tags[],
title, summary, content(markdown), author, version, lastReviewDate, relatedArticleIds[],
relatedClauseNumbers[], isPublished, isFeatured, viewCount, helpfulVotes, createdAt, updatedAt`.

**AuditTemplate**: `id, tenantId, name, description, standard, auditType, clauseQuestions[],
standardAgendaItems[], openingMeetingScript, closingMeetingScript, documentReviewChecklist[],
inspectionChecklist[], isDefault, isPublic, createdByUserId, createdAt, updatedAt`.

### 7.3 RBAC matrix (gate UI + actions by `permissions`)

Permission strings: `manage_tenants, manage_users, create_audits, conduct_audits, add_findings,
view_audit_reports, close_ncs, manage_corrective_actions, billing_management, ai_copilot,
export_reports`.

| Permission | super_admin | tenant_admin | lead_auditor | auditor | auditee | viewer |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| manage_users | ✅ | ✅ | — | — | — | — |
| create_audits | ✅ | ✅ | ✅ | — | — | — |
| conduct_audits / add_findings | ✅ | ✅ | ✅ | ✅ | — | — |
| view_audit_reports / export_reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| close_ncs | ✅ | ✅ | ✅ | — | — | — |
| manage_corrective_actions | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| ai_copilot | ✅ | ✅ | ✅ | ✅ | — | — |

---

## 8. ISO 45001 clause dataset

The canonical dataset (53 clauses across groups 4–10 with sub-clause hierarchy) lives in
`packages/core/src/iso45001/clauses.ts`. **Do not retype it.** Export it to JSON once and bundle it:

- Add a tiny script (or `ts-node` one-off) that imports `flattenClauses()` and writes
  `iso45001.clauses.json`. Add it to the app bundle and decode at launch.
- Clause shape (`ISO45001Clause`): `number, title, parentNumber?, level(1–4), requirementText,
  auditFocus[], typicalAuditQuestions[], commonNonconformities[], expectedDocuments[],
  crossReferences[]`.
- Port these helpers (pure functions): `getClauseByNumber`, `getChildClauses`, `getTopLevelClauses`
  (4–10), `flattenClauses`, `getClauseTree` (nested), `getAncestors`, `getRelatedClauses`.
- The clause **navigator** (per audit) shows the tree with each clause's `ConformityStatus` from the
  matching `ClauseAssessment`; the **wiki** browses the same dataset standalone.

---

## 9. Design system → Swift

Source: `packages/ui/src/tokens/` and `docs/DESIGN_DOC.md` §14. Build a `DesignSystem` with a
color asset catalog + `Font` extensions + spacing/radii constants. **Exact values:**

### 9.1 Colors

Primary (Deep Navy): `50 #E8EEF5 · 100 #C5D3E5 · 200 #9BB2D4 · 300 #7091C2 · 400 #4E75B4 ·
500 #1B4F8E (brand) · 600 #164282 · 700 #103372 · 800 #0A2647 (sidebar/headers) · 900 #061524`.
Secondary (Steel Teal): `500 #1B8CA8 · 600 #157893`. Gold (Certification): `400 #E2BA5E ·
500 #C9A84C (brand gold) · 600 #A88D3D`.

Semantic / findings: conforming `#2D9E2D` · minor NC `#E67E22` · major NC `#C0392B` · OFI
`#2980B9` · strong point `#8E44AD` · warning `#E6A817`.
Neutrals: background `#F4F7FB` · surface `#FFFFFF` · border `#D1D9E6` · textPrimary `#1A1D23` ·
textSecondary `#6B7280` · textMuted `#9CA3AF`. Focus ring `rgba(27,79,142,0.45)`.

### 9.2 Color helpers (port these)

- `findingColor(_ type: FindingType) -> Color`: major_nc `#C0392B`, minor_nc `#E67E22`, ofi
  `#2980B9`, strong_point `#8E44AD`, observation `#6B7280`.
- `conformityColor(_ s: ConformityStatus) -> Color`: conforming `#2D9E2D`, major_nc `#C0392B`,
  minor_nc `#E67E22`, not_audited `#9CA3AF`, not_applicable `#6B7280`.
- **Badge recipe:** text = token color; background = color @ 10% alpha; border = color @ 30% alpha;
  fully rounded; 11px semibold body font.

### 9.3 Typography, spacing, radius, shadow

- Fonts: **Montserrat** (display: headers, clause/audit numbers), **Inter** (body), **JetBrains
  Mono** (clause codes, NCR/CA numbers, stat numbers). Register the .ttf files in the bundle +
  Info.plist. Sizes: `xs 11 · sm 13 · md 15 · lg 17 · xl 20 · 2xl 24 · 3xl 30 · 4xl 36`. Weights
  400/500/600/700.
- Spacing: `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64`.
- Radius: `sm 4 · md 8 (buttons/inputs) · lg 12 (cards) · xl 16 · full 9999 (pills/badges)`.
- Shadows (navy base `rgba(10,38,71,α)`): card `0 2 8 @0.12`; also card-soft `@0.06`, overlay
  `0 24 60 @0.26` for modals.

### 9.4 Strings

Port `packages/core/src/constants/strings.ts` (`SoteriaStrings`) into a Swift `Strings` enum
(groups: common, auth, audit, clauses, findings, evidence, meetings, correctiveActions, ai,
errors). Keep it the single source for UI copy (i18n-ready). The AI disclaimer string is mandatory
on every AI result.

### 9.5 Brand & named frames

Logo: deep-navy certification **shield** (`#0A2647`) + gold check (`#C9A84C`). The reference
design library (`docs/design-system/soteria-assurance-screens.html`) defines 8 canonical frames to
match: **01** iPad Field Audit Workspace (clause navigator + workspace), **02** Create Finding modal
(left color strip = finding type), **03** Web Dashboard (navy sidebar, stat cards, readiness gauge),
**04** Opening Meeting Studio, **05** Wiki clause browser, **06** Corrective Action Tracker, **07**
iPhone Sync/Offline states (green=synced, amber=syncing, gray=offline), **08** Evidence asset sheet.

---

## 10. Screen-by-screen blueprint (feature parity target)

Navigation: a **tab bar** (Dashboard, Audits, Clients, Corrective Actions, Wiki, Settings) with a
nested **audit detail stack**. iPad may use `NavigationSplitView` (clause navigator as sidebar).

1. **Auth** — Email/Password + Google sign-in; Register (email/password + display name, server sends
   verification). Gate the app until `onAuthStateChanged` resolves and claims load.
2. **Dashboard** — counts of active/planned audits, total findings, open NCs; top-5 audit list;
   certification-readiness gauge. Reads from local store.
3. **Audits list** — cards: audit number (mono), status pill, scope, type, date range. "New Audit".
4. **Audit overview** — header (number/scope/type/status, "Start audit" for planned), 4-stat summary
   (Major/Minor/OFI/SP), tiles to: Plan, Clauses, Findings, Evidence, Meetings, Report. FAB → AI
   Co-Pilot.
5. **Audit plan** — read-only schedule (activities, interviewees, inspection areas).
6. **Clause navigator** — ISO 45001 tree; each row: clause number, title, conformity badge,
   completion check.
7. **Clause assessment** (core field screen) — canonical clause data (requirement text, audit focus,
   typical questions, common NCs, expected docs) + **conformity picker**
   (conforming/minor_nc/major_nc/not_applicable/not_audited) + auditor notes; Save / Mark Complete.
8. **Findings list + Create Finding modal** — finding cards (number, type badge, title, clause,
   target date); modal form: type, title, objective evidence, **"Draft with AI"** (`draftNCR`) →
   review/edit → accept into `nonconformityStatement`.
9. **Evidence gallery** — 2-col grid; capture button → camera → compress → geotag → local write →
   background upload; per-tile **upload status** (Queued/Uploading/Uploaded/Failed) + geotag pin.
   Optional **"Analyze with AI"** (`analyzeEvidence`).
10. **Meetings** — opening/closing tabs; recorder (start/stop, MM:SS, audio permission); on stop,
    save audio as evidence + queue upload. (Transcription/summary are server follow-ups.)
11. **Report preview** — readiness score + 8-stat grid; optionally call `generateReport` /
    `generateReportSection`.
12. **Clients** — read-only tenant client list (org, industry, sites, employees, contact).
13. **Corrective actions** — tenant CA list with status pills, target dates, overdue indicator;
    create from a finding; auditees can submit closure evidence.
14. **Wiki** — searchable offline ISO clause reference (same dataset as §8).
15. **Settings** — account (name/email/role/tenant), **live sync state + last synced**, manual sync,
    sign out.

---

## 11. Offline-first sync engine (the critical subsystem)

Mirror the reference `syncManager`/repository design. **Local store = source of truth; UI reads
local; a background engine reconciles with Firestore.**

### 11.1 Local schema

Mirror these 4 synced tables (SwiftData models). Every row carries:
`remoteId` (the Firestore doc id; nil until first push), `tenantId`, `syncStatus`
(`pending|syncing|synced|failed`), `localCreatedAt`, `localUpdatedAt`. Store nested objects (team,
plan, summary, geo, id-arrays) as encoded JSON columns.

- **audits** — scalar audit fields + JSON: `auditTeam, sitesInScope, auditPlan, findingsSummary,
  aiRiskFlags`.
- **clauseAssessments** — `(auditId, clauseNumber)` unique; scalar fields + JSON: `evidenceIds,
  findingIds, subClauseNotes`.
- **findings** — scalar fields + JSON: `evidenceIds`.
- **evidence** — scalar fields + JSON: `geoLocation, clauseNumbers, findingIds`; **plus a second
  tracker** `uploadStatus` (`local_only|uploading|uploaded|failed`) for the file (separate from
  `syncStatus` for the metadata doc) and a `localUri` for the on-device file.

(Clients & corrective actions in the reference app are read via Firestore/React-Query; you may cache
them too, but the 4 above are the offline-write core.)

### 11.2 Push (local → Firestore)

For each table, select rows where `syncStatus != synced`; assign a stable `remoteId` if absent
(local-first, collision-resistant — e.g. a UUID); map row → document; `setData(merge:)` at the
tenant-scoped path; on success set `syncStatus = synced` + persist `remoteId`; on failure set
`failed` (retry later). **Fire-and-forget** — never throw into the UI.

### 11.3 Evidence two-phase upload

1. **File phase:** upload the local file to the tenant-scoped Storage path → on success write back
   `fileUrl`, set `uploadStatus = uploaded`; on failure `failed` (retry on reconnect).
2. **Metadata phase:** only once `uploadStatus == uploaded`, push the Evidence document via the
   normal sync. UI shows: Queued → Uploading → Uploaded → Synced (or Failed).

### 11.4 Pull (Firestore → local)

One-shot on first launch / manual refresh: fetch the tenant's audits + their clauses/findings/
evidence; upsert by `remoteId`. **Never** awaited by the UI (field work isn't blocked by a read).

### 11.5 Connectivity + status

`NWPathMonitor` drives transitions. On reconnect: retry failed uploads, then run push. Maintain a
sync indicator (`synced|pending|failed|offline|syncing`) + `pendingChanges` count + `lastSyncedAt`,
shown in a header dot and the Settings screen. Persist durable pointers (active audit/clause,
lastSyncedAt, pending count, **tenantId/role**) so they survive cold start.

### 11.6 Crash safety

Wrap the app in an error-recovery boundary: catch render/runtime errors, persist a diagnostic
(`screen, message, stack, at`) to `UserDefaults`, show a branded "Try again" recovery screen. Local
audit data survives untouched.

---

## 12. Helpers to port (with unit tests)

From `packages/core/src/utils`:

- **Numbering:** `findingNumber(prefix, year, seq)` → `"NCR-2026-001"` (seq zero-padded to 3);
  `auditNumber(year, seq)` → `"AUD-2026-001"`; `caNumber(year, seq)` → `"CA-2026-001"`.
- **Deadlines:** `targetClosureDate(type, raisedAt)` → major_nc +60d, minor_nc +90d, else nil;
  `reminderDates(due)` → 30/14/7 days before; `isOverdue(due, now)`; `daysBetween` (UTC-midnight).
- **Scoring:** `clauseScoreFromVerdicts` (yes=1, partial=0.5, no=0, na=excluded → 0–100);
  `computeFindingsSummary(findings)` → `AuditFindingsSummary`;
  `computeCertificationReadinessScore(assessments)` (mean of audited clause scores).
- **Validators:** `isValidClauseNumber` (dotted `4` / `6.1` / `8.1.4.2`), `isValidEmail`,
  `validateFindingDraft`.

Note: `onAuditComplete` recomputes the findings summary server-side, so treat your local
`computeFindingsSummary` as an optimistic value and reconcile on pull.

---

## 13. Suggested build phases (milestones)

- **Phase 0 — Foundation:** Xcode project, Firebase SDK + `GoogleService-Info.plist`, emulator
  toggle, DesignSystem (colors/fonts/spacing) + base components (Badge, Card, Button, Input, state
  views), Domain models + enums (§7), ISO clause JSON bundle + helpers (§8).
- **Phase 1 — Auth & session:** Email/Password + Google; claims parsing + persistence; RBAC gate;
  tab shell; Settings (account + sign out).
- **Phase 2 — Local store & sync engine:** SwiftData schema (§11.1), repositories (local-first
  writes), push/pull, connectivity + sync indicator, crash recovery.
- **Phase 3 — Audit core:** Audits list/overview, clause navigator + assessment with conformity
  picker + notes (offline), findings list + Create Finding (offline), numbering/deadline helpers.
- **Phase 4 — Evidence:** camera capture + compress + geotag, two-phase upload, gallery with upload
  status.
- **Phase 5 — AI Co-Pilot:** `draftNCR` in the finding form, `suggestQuestions` drawer,
  `analyzeEvidence` from a photo — each with the mandatory disclaimer + review-before-accept.
- **Phase 6 — Meetings, Reports, Clients, CAs, Wiki:** recorder; report preview +
  `generateReport`/`generateReportSection`; client list; corrective-action tracker; offline wiki.
- **Phase 7 — Hardening:** reported-audit lock states, iPad split layout, BGTaskScheduler syncs,
  accessibility, tests, TestFlight.

---

## 14. Definition of done (acceptance)

- A lead auditor can, **fully offline**, open an audit, assess clauses, raise findings, capture
  geotagged photo evidence, and record a meeting — with **zero network calls blocking the UI**.
- On reconnect, everything syncs to the correct **tenant-scoped** Firestore/Storage paths with the
  **exact field names** in §7, and is visible to the web app (and vice-versa).
- All four AI callables work end-to-end with the **disclaimer shown** and **review-before-commit**;
  AI-only fields are never written by the client.
- RBAC gates match §7.3; reported audits lock findings/evidence; no client deletes of evidence.
- Visual parity with the design tokens (§9) and the named frames (§9.5).
- Domain helpers (numbering/deadlines/scoring/validators) and the sync engine are unit-tested.

---

## 15. Pitfalls & gotchas

- **Field-name drift breaks interop.** Copy names exactly from `packages/core/src/types`. When in
  doubt, open the type file.
- **`tenantId` must be available offline.** Persist it from claims; you can't read tenant-scoped data
  without it, and you can't wait on the network on cold start.
- **`analyzeEvidence` wants raw base64** (no `data:` prefix) + a valid `mediaType`.
- **AI calls are rate-limited** (100/tenant/hour) and permissioned (`ai_copilot`) — handle
  `resource-exhausted`/`permission-denied` gracefully.
- **Don't try to write `aiDraftStatement`/`aiAnalysis`/`aiHazardsDetected`** — the rules reject it;
  these arrive via the callables / server.
- **Phone auth is web-only** in the reference app; on iOS use Email/Password + Google (or add the
  native phone flow deliberately).
- **Storage deletes are blocked for clients** — model evidence as append-only.
- **`reportTemplate`, `tenantType` long vs short forms:** claims use `cb|consultancy|enterprise`;
  `Tenant.type` uses `certification_body|consultancy|enterprise`. Keep them distinct.

---

*Generated as a build handoff for the native iOS client. Source of truth: this repository's
`packages/core`, `packages/firebase`, `functions/`, `firestore.rules`, `storage.rules`, and
`docs/DESIGN_DOC.md`.*
