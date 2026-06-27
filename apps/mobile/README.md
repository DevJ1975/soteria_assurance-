# @soteria/mobile

Soteria Assurance field-audit app — React Native (Expo SDK 52) + Expo Router, **offline-first**.

## Run

```bash
pnpm --filter @soteria/mobile start   # expo start
pnpm --filter @soteria/mobile ios|android|web
pnpm --filter @soteria/mobile typecheck
pnpm --filter @soteria/mobile lint
```

Copy `.env.example` → `.env.local` and fill the public `EXPO_PUBLIC_FIREBASE_*` values
(these are **not** secrets — RULE 3). Server-only secrets live exclusively in Firebase Functions.

## Architecture

- **Routing** — Expo Router file-based routes under `app/`. Two groups: `(auth)` (login/register)
  and `(app)` (tab navigator: Dashboard, Audits, Clients, CAs, Wiki, Settings). The Audits tab nests
  the full audit-detail stack (`audits/[auditId]/…`).
- **Offline-first (RULE 9)** — every mutation writes to **WatermelonDB** (`db/`) first; the
  `services/syncManager.ts` later pushes unsynced rows to **tenant-scoped Firestore**
  (`@soteria/firebase`, RULE 2) and never blocks the UI. The §11 sync indicator
  (`components/common/SyncStatusDot`) is driven from the audit store.
- **State** — Zustand stores (`stores/`, persisted via AsyncStorage per §5.6) for the auth + audit
  session; TanStack Query for tenant-scoped back-office reads (clients, CAs).
- **Shared packages** — types/strings/ISO 45001 data from `@soteria/core` (RULE 4), design tokens
  from `@soteria/ui` adapted to RN in `theme/` (RULE 5), all Firebase access via `@soteria/firebase`.
- **Error boundaries (RULE 8)** — every screen renders inside `AuditErrorBoundary`, which checkpoints
  to AsyncStorage and shows a recovery UI instead of a white screen.
- **AI co-pilot (§9.4)** — `services/aiService.ts` calls the server-side `draftNCR` / `suggestQuestions`
  callables (`httpsCallable`); results always carry the mandatory disclaimer.

## Notes / follow-ups

- **Phone auth** — `signInWithPhoneNumber` needs a reCAPTCHA `ApplicationVerifier`, which has no DOM
  in bare RN. `lib/phoneAuth.ts` defines the `PhoneAuthFlow` contract; wire a
  `<FirebaseRecaptchaVerifierModal>` ref (`expo-firebase-recaptcha`) into `makePhoneAuthFlow` at runtime.
- **Google sign-in** — obtain the Google `idToken` natively (`expo-auth-session` /
  `@react-native-google-signin`) then call `signInWithGoogleCredential`. `login.tsx` has the seam.
- Native/EAS builds are out of scope here; `node_modules` are not installed in this environment.
  The codebase is fully typed and verified to type-check against the shared package types.
