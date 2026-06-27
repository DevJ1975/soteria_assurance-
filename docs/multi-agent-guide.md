# Soteria Assurance — Multi-Agent Development Guide
### Claude Code Orchestration Playbook for ISO 45001 Audit Platform
**Version:** 1.0.0 | **Stack:** React Native + Next.js + Firebase + TypeScript  
**For use with:** Claude Code (claude-sonnet-4-6)  

---

## Overview

This guide directs AI coding agents working on the Soteria Assurance monorepo. Read this document **in full before writing any code**. Every agent session must begin by reviewing this guide and the current task context.

---

## 1. Non-Negotiable Rules

These rules apply to **every agent, every session, every file**. No exceptions.

```
RULE 1: TypeScript strict mode is mandatory everywhere.
         Never use `any`, `as any`, or ts-ignore without an inline comment explaining why.

RULE 2: All Firestore operations must be tenant-scoped.
         Every query must filter by tenantId. Never query a collection without tenant isolation.
         Pattern: firestore().collection(`tenants/${tenantId}/audits`)

RULE 3: API keys (Claude API, etc.) live in Firebase Secret Manager only.
         Never put secrets in client code, .env files committed to git, or Firebase client config.
         Access via: defineSecret() in Firebase Functions v2.

RULE 4: All user-facing strings must be in /packages/core/src/constants/strings.ts
         No hardcoded strings in components. This enables future i18n.

RULE 5: All ISO 45001 clause data lives in /packages/core/src/iso45001/
         Never hardcode clause numbers, titles, or requirement text in components.
         Always import from the canonical data source.

RULE 6: Follow the established design tokens from /packages/ui/src/tokens/
         Never use raw hex colors, font sizes, or spacing values in component files.
         Always reference SoteriaTokens.[category].[key]

RULE 7: Write tests for every function in /packages/core/ and /functions/
         Coverage target: 80%+. Jest is the test runner.

RULE 8: Error boundaries must wrap every major screen.
         An unhandled crash must never white-screen the audit in progress.

RULE 9: Offline-first — assume no network connection.
         All data mutations go to WatermelonDB first, then sync to Firestore.
         Never make a Firestore call directly from a UI action without offline fallback.

RULE 10: Commit messages follow Conventional Commits:
          feat:, fix:, docs:, chore:, refactor:, test:
          Example: feat(audit): add offline clause assessment with WatermelonDB sync
```

---

## 2. Repository Structure Map

```
soteria-assurance/
├── packages/
│   ├── core/           ← Business logic, types, ISO data [AGENT: shared-logic-agent]
│   ├── ui/             ← Design system, shared components [AGENT: ui-agent]
│   └── firebase/       ← Firebase helpers [AGENT: backend-agent]
├── apps/
│   ├── mobile/         ← React Native (Expo) [AGENT: mobile-agent]
│   └── web/            ← Next.js [AGENT: web-agent]
├── functions/          ← Firebase Cloud Functions [AGENT: backend-agent]
├── firestore.rules     ← Security rules [AGENT: backend-agent]
└── docs/               ← Documentation [AGENT: any]
```

---

## 3. Agent Roles & Responsibilities

### 3.1 Agent Catalog

| Agent Name | Primary Domain | Key Files | Never Touch |
|---|---|---|---|
| `shared-logic-agent` | Types, ISO data, core logic | `/packages/core/` | App-specific UI, Firebase Functions |
| `ui-agent` | Design system, shared components | `/packages/ui/` | Business logic, API calls |
| `mobile-agent` | React Native screens & mobile features | `/apps/mobile/` | Web app, Firebase Functions |
| `web-agent` | Next.js pages & web features | `/apps/web/` | Mobile app, Firebase Functions |
| `backend-agent` | Firebase Functions, Firestore rules, DB schema | `/functions/`, `firestore.rules` | Client-side UI code |
| `ai-agent` | Claude API integration, AI features | `/functions/src/ai/` | Frontend UI, non-AI functions |
| `test-agent` | Test suite maintenance | `**/*.test.ts`, `**/*.spec.ts` | Production source code |
| `docs-agent` | Documentation, wiki content | `/docs/`, wiki articles | All source code |

### 3.2 Agent Handoff Protocol

When Agent A completes work that Agent B depends on:

```
HANDOFF FORMAT (place at end of Agent A session):
---HANDOFF TO [agent-name]---
COMPLETED: Brief description of what was built
EXPORTS: List of new types, functions, or components created
DEPENDENCIES ADDED: Any new npm packages installed
BREAKING CHANGES: Any interfaces that were modified
TESTS WRITTEN: Files with test coverage
NEXT TASK: What [agent-name] should do next
BLOCKERS: Any unresolved issues
---END HANDOFF---
```

---

## 4. Development Workflow by Feature

### Feature Development Sequence

For any new feature, agents execute in this order:

```
Step 1: shared-logic-agent
   → Define TypeScript interfaces in /packages/core/src/types/
   → Add ISO 45001 clause data if needed in /packages/core/src/iso45001/
   → Write pure utility functions
   → Write unit tests

Step 2: backend-agent
   → Create Firebase Function(s) in /functions/src/
   → Update Firestore security rules if new collections
   → Add Firestore composite indexes if needed
   → Write function integration tests

Step 3: ui-agent (if new UI components needed)
   → Create shared components in /packages/ui/src/components/
   → Use only SoteriaTokens — no raw values
   → Export from package index

Step 4a: mobile-agent (parallel with 4b)
   → Create screens in /apps/mobile/app/
   → Wire up WatermelonDB model
   → Implement offline sync logic
   → Connect to Firebase Function

Step 4b: web-agent (parallel with 4a)
   → Create pages in /apps/web/app/
   → Implement same feature with web-appropriate UX
   → Connect to same Firebase Function

Step 5: test-agent
   → Review coverage gaps
   → Write E2E tests (Detox for mobile, Playwright for web)

Step 6: docs-agent
   → Update relevant wiki article
   → Update DESIGN_DOC.md if architecture changed
```

---

## 5. Critical Implementation Patterns

### 5.1 Tenant-Safe Firestore Pattern

```typescript
// ✅ CORRECT — Always scope by tenant
import { getFirestore } from 'firebase/firestore';
import { collection, query, where } from 'firebase/firestore';

const getAuditsForTenant = (tenantId: string, userId: string) => {
  const db = getFirestore();
  return query(
    collection(db, `tenants/${tenantId}/audits`),
    where('leadAuditorId', '==', userId)
  );
};

// ❌ WRONG — Never query without tenantId
const getAllAudits = () => {
  return collection(db, 'audits'); // FORBIDDEN — breaks multi-tenancy
};
```

### 5.2 Offline-First Data Mutation Pattern

```typescript
// ✅ CORRECT — Write to local DB first, sync in background
import { database } from '@soteria/firebase';
import { Audit } from '@soteria/core/types';

const updateClauseAssessment = async (
  db: Database,
  clauseId: string,
  updates: Partial<ClauseAssessment>
) => {
  // 1. Write to WatermeloonDB immediately (no network needed)
  await db.write(async () => {
    const clause = await db.collections.get<ClauseAssessment>('clause_assessments')
      .find(clauseId);
    await clause.update(record => {
      Object.assign(record, updates);
      record.syncStatus = 'pending';
    });
  });
  
  // 2. Sync manager will push to Firestore when online
  // (SyncManager runs as background service — never await sync in UI actions)
};

// ❌ WRONG — Never call Firestore directly from UI interactions
const updateClauseAssessmentBad = async (clauseId: string, updates: Partial<ClauseAssessment>) => {
  await setDoc(doc(db, `.../${clauseId}`), updates); // Will fail offline!
};
```

### 5.3 AI Request Pattern (Firebase Function)

```typescript
// /functions/src/ai/draftNCR.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

export const draftNCR = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    // 1. Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    
    // 2. Verify tenant matches
    const { tenantId, clauseNumber, auditorNotes, requirementText } = request.data;
    if (request.auth.token['tenantId'] !== tenantId) {
      throw new HttpsError('permission-denied', 'Tenant mismatch');
    }
    
    // 3. Build ISO 45001 aware prompt
    const prompt = buildNCRPrompt(clauseNumber, requirementText, auditorNotes);
    
    // 4. Call Claude API
    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: ISO_AUDITOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });
    
    // 5. Parse and return structured response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseNCRResponse(responseText);
  }
);

const buildNCRPrompt = (clauseNumber: string, requirement: string, notes: string): string => `
You are drafting a formal nonconformity statement for an ISO 45001:2018 audit.

CLAUSE: ${clauseNumber}
ISO REQUIREMENT: ${requirement}

AUDITOR'S RAW NOTES:
${notes}

Draft a formal NCR statement with these sections:
1. REQUIREMENT (what the standard requires)
2. FINDING (what was observed that doesn't conform)
3. OBJECTIVE EVIDENCE (specific evidence observed)
4. RECOMMENDED SEVERITY (Major or Minor) with justification

Use precise, professional audit language. Be specific and factual.
`;

const ISO_AUDITOR_SYSTEM_PROMPT = `You are ARIA, an expert ISO 45001:2018 Lead Auditor 
with 20+ years experience. You write precise, defensible nonconformity statements that would 
withstand scrutiny from accreditation bodies. Always cite specific clause references.`;
```

### 5.4 WatermelonDB Model Pattern

```typescript
// /apps/mobile/db/models/ClauseAssessment.ts
import { Model, field, text, relation, readonly, date, json } from '@nozbe/watermelondb';
import { Clause } from './Clause';

class ClauseAssessmentModel extends Model {
  static table = 'clause_assessments';
  
  static associations = {
    audits: { type: 'belongs_to' as const, key: 'audit_id' },
  };
  
  @text('audit_id')         auditId!: string;
  @text('tenant_id')        tenantId!: string;
  @text('clause_number')    clauseNumber!: string;
  @text('clause_title')     clauseTitle!: string;
  @text('conformity_status') conformityStatus!: string;
  @field('score')           score!: number;
  @text('auditor_notes')    auditorNotes!: string;
  @json('sub_clause_notes', (json) => json) subClauseNotes!: any[];
  @field('is_complete')     isComplete!: boolean;
  
  // Sync tracking
  @text('sync_status')      syncStatus!: 'synced' | 'pending' | 'conflict';
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at')           updatedAt!: Date;
}
```

### 5.5 Evidence Photo Capture Pattern (Mobile)

```typescript
// /apps/mobile/components/evidence/EvidenceCaptureButton.tsx
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadEvidence } from '@/services/evidenceService';

const captureEvidencePhoto = async (
  auditId: string,
  clauseNumbers: string[],
  tenantId: string
) => {
  // 1. Request permissions
  const [cameraPermission, locationPermission] = await Promise.all([
    Camera.requestCameraPermissionsAsync(),
    Location.requestForegroundPermissionsAsync(),
  ]);
  
  // 2. Capture photo
  const photo = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    exif: true,
  });
  
  if (photo.canceled) return null;
  
  // 3. Get geolocation at capture time
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  
  // 4. Compress for storage efficiency
  const compressed = await ImageManipulator.manipulateAsync(
    photo.assets[0].uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  // 5. Create Evidence record with metadata
  const evidence: Partial<Evidence> = {
    auditId,
    tenantId,
    type: 'photo',
    clauseNumbers,
    geoLocation: {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
    },
    capturedAt: new Date(),
  };
  
  // 6. Save to local DB (offline-safe) + queue upload
  await uploadEvidence(compressed.uri, evidence);
};
```

### 5.6 Zustand Store Pattern

```typescript
// /apps/mobile/stores/auditStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuditStore {
  activeAuditId: string | null;
  activeAudit: Audit | null;
  currentClauseId: string | null;
  aiCopilotOpen: boolean;
  syncStatus: 'synced' | 'pending' | 'error';
  
  // Actions
  setActiveAudit: (audit: Audit | null) => void;
  setCurrentClause: (clauseId: string | null) => void;
  toggleAICopilot: () => void;
  setSyncStatus: (status: 'synced' | 'pending' | 'error') => void;
}

export const useAuditStore = create<AuditStore>()(
  persist(
    (set) => ({
      activeAuditId: null,
      activeAudit: null,
      currentClauseId: null,
      aiCopilotOpen: false,
      syncStatus: 'synced',
      
      setActiveAudit: (audit) => set({
        activeAudit: audit,
        activeAuditId: audit?.id ?? null
      }),
      setCurrentClause: (clauseId) => set({ currentClauseId: clauseId }),
      toggleAICopilot: () => set((state) => ({ aiCopilotOpen: !state.aiCopilotOpen })),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
    }),
    {
      name: 'audit-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeAuditId: state.activeAuditId }), // Only persist ID
    }
  )
);
```

---

## 6. ISO 45001 Data Integrity Rules

**Critical:** The following data must **always** come from `/packages/core/src/iso45001/clauses.ts`. Never hardcode.

```typescript
// /packages/core/src/iso45001/clauses.ts — structure

export interface ISO45001Clause {
  number: string;           // "6.1.2"
  title: string;            // "Hazard identification and assessment of OH&S risks"
  parentNumber?: string;    // "6.1"
  level: number;            // 1=top, 2=sub, 3=sub-sub
  requirementText: string;  // Exact ISO text (paraphrased for IP reasons)
  auditFocus: string[];     // What auditors look for
  typicalAuditQuestions: string[];
  commonNonconformities: string[];
  expectedDocuments: string[];
  crossReferences: string[];// Other clause numbers that interact
}

// All 10 clause groups + all sub-clauses must be defined
// Mobile and web agents import from this single source of truth
```

**Agents must:**
- Import clause data from `@soteria/core/iso45001`
- Never write ISO 45001 requirement text literally in components
- Use `clause.requirementText` dynamically — never hardcode requirements

---

## 7. Firebase Security Rule Patterns

Backend agents must follow these patterns in `firestore.rules`:

```javascript
// Pattern 1: Tenant-scoped read/write
match /tenants/{tenantId}/{document=**} {
  allow read: if isAuthenticated() && belongsToTenant(tenantId);
  allow write: if isAuthenticated() && belongsToTenant(tenantId) && hasRole(['lead_auditor', 'auditor', 'tenant_admin']);
}

// Pattern 2: Immutability — after audit is reported, findings are read-only
match /tenants/{tenantId}/audits/{auditId}/findings/{findingId} {
  allow update: if isAuthenticated() && belongsToTenant(tenantId)
    && !isAuditReported(tenantId, auditId); // Block updates on reported audits
}

// Pattern 3: AI-generated content is flagged, not auto-accepted
// The aiDraftStatement field can be written by functions
// but ncrStatement can only be written by authenticated auditors
match /tenants/{tenantId}/audits/{auditId}/findings/{findingId} {
  allow update: if 
    (onlyUpdating(['aiDraftStatement', 'aiAnalysis']) && isCloudFunction()) ||
    (isAuthenticated() && belongsToTenant(tenantId) && hasRole(['lead_auditor']));
}
```

---

## 8. AI Feature Implementation Checklist

When any agent implements an AI feature:

- [ ] AI calls go through Firebase Functions ONLY (not direct from client)
- [ ] System prompt includes ISO 45001 auditor persona
- [ ] Response includes disclaimer: "AI-generated — auditor must review and approve"
- [ ] AI-generated fields are stored separately from auditor-verified fields
  - ✅ `aiDraftStatement` (AI output)
  - ✅ `nonconformityStatement` (auditor-confirmed)
- [ ] All AI requests are logged to Firestore: `/tenants/{tenantId}/aiLogs/`
- [ ] Rate limiting applied to AI endpoints (max 100 requests per tenant per hour)
- [ ] Error handling for AI unavailability (graceful degradation — app works without AI)
- [ ] Response timeout handling (30-second max for AI calls, show progress to user)

---

## 9. Environment Variables Reference

```bash
# Firebase Functions .env (managed via Firebase Secret Manager)
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key
SENDGRID_API_KEY=SG...                # Email service
FIREBASE_ADMIN_SDK_KEY=...            # Service account (auto-injected in Functions)

# Apps (.env.local — NOT committed to git)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Next.js (.env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

---

## 10. Performance Requirements

| Metric | Target | How Agents Must Implement |
|---|---|---|
| Audit screen load time | < 1.5s | Use WatermelonDB local queries, paginate findings |
| Photo capture → preview | < 300ms | Compression happens async, show immediately |
| AI response display | < 30s | Show streaming skeleton; never block UI |
| Offline → Online sync | < 5s for 100 records | Batch Firestore writes in transactions |
| Evidence photo upload | Background | Never block audit workflow on upload |
| Report PDF generation | < 30s | Cloud Function with progress webhook |

---

## 11. Testing Requirements by Agent

### shared-logic-agent (packages/core)
```
Required coverage: 90%
Test types: Unit tests (Jest)
Test location: packages/core/src/__tests__/
Key tests:
  - All utility functions
  - TypeScript type guards
  - ISO 45001 data structure validation
  - Finding number generation
  - Date/deadline calculation logic
```

### backend-agent (functions)
```
Required coverage: 85%
Test types: Integration tests with Firebase emulator
Test location: functions/src/__tests__/
Key tests:
  - All AI function inputs/outputs
  - Firestore security rule tests (firebase-admin test SDK)
  - Report generation with mock audit data
  - Tenant isolation (verify cross-tenant access fails)
  - Corrective action state machine
```

### mobile-agent (apps/mobile)
```
Required coverage: 70%
Test types: Component tests (Jest + @testing-library/react-native), E2E (Detox)
Key Detox scenarios:
  - Complete audit flow (create → conduct → close)
  - Take photo evidence and link to finding
  - Work offline, then sync
  - Create NCR and capture signature
```

### web-agent (apps/web)
```
Required coverage: 70%
Test types: Component tests, E2E (Playwright)
Key Playwright scenarios:
  - Login and access dashboard
  - Create a new audit
  - View and filter corrective actions
  - Generate and download audit report
  - Navigate wiki
```

---

## 12. Common Error Handling Patterns

```typescript
// Pattern: Audit-safe error boundary
// Errors during an active audit must NOT lose data

class AuditErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 1. Save current audit state to AsyncStorage before anything else
    saveAuditCheckpoint();
    // 2. Log to Sentry
    Sentry.captureException(error, { extra: errorInfo });
    // 3. Show recovery UI — NOT a white screen
  }
  
  render() {
    if (this.state.hasError) {
      return <AuditRecoveryScreen onRestore={this.handleRestore} />;
    }
    return this.props.children;
  }
}

// Pattern: Firebase Operation with offline fallback
const withOfflineFallback = async <T>(
  onlineOperation: () => Promise<T>,
  offlineOperation: () => T,
  isConnected: boolean
): Promise<T> => {
  if (!isConnected) return offlineOperation();
  try {
    return await onlineOperation();
  } catch (error) {
    if (isNetworkError(error)) return offlineOperation();
    throw error;
  }
};
```

---

## 13. Session Startup Checklist

**Every agent session must begin with:**

```
[ ] Read this entire multi-agent-guide.md
[ ] Read DESIGN_DOC.md sections relevant to your task
[ ] Check HANDOFF notes from previous agent session (if any)
[ ] Confirm which agent role you are operating as for this session
[ ] Confirm the specific task/feature to be implemented
[ ] Check existing code in your domain before writing new code
[ ] Verify ISO 45001 data is sourced from packages/core (not hardcoded)
[ ] Confirm TypeScript strict mode is enabled (check tsconfig.json)
[ ] Confirm no API keys are exposed in client code
```

---

## 14. Quick Reference — Key ISO 45001 Audit Concepts

For agents writing AI prompts, test data, or UI copy:

```
FINDING TYPES:
  MNC = Major Nonconformity (absence of/complete failure of a requirement)
  NC  = Minor Nonconformity (single lapse in requirement fulfillment)
  OFI = Opportunity for Improvement (not a failure, just a suggestion)
  SP  = Strong Point (exceptional practice beyond requirements)
  OBS = Observation (general note, no finding)

KEY AUDIT PHASES:
  1. Audit Planning
  2. Document Review (Stage 1 for cert audits)
  3. Opening Meeting
  4. On-Site Audit (field work, interviews, inspections)
  5. Closing Meeting
  6. Report Issuance
  7. Corrective Action Follow-up

CORRECTIVE ACTION COMPONENTS:
  1. Containment (immediate action to stop the problem)
  2. Root Cause Analysis (why did it happen?)
  3. Corrective Action (systemic fix)
  4. Preventive Action (ensure it doesn't recur)
  5. Effectiveness Check (verify it worked)

CLAUSE 9.2 INTERNAL AUDIT REQUIREMENTS (most commonly audited):
  - Program established?
  - Competent auditors (independent of area audited)?
  - Results reported to management?
  - Findings addressed?
  - Evidence retained as documented information?
```

---

## 15. Deployment Commands Reference

```bash
# Install dependencies (run from root)
pnpm install

# Development
pnpm dev:web         # Start Next.js dev server
pnpm dev:mobile      # Start Expo dev client
pnpm dev:functions   # Start Firebase Functions emulator

# Testing
pnpm test            # Run all tests across all packages
pnpm test:core       # Test packages/core only
pnpm test:functions  # Test Firebase Functions with emulator
pnpm test:e2e:web    # Playwright E2E tests
pnpm test:e2e:mobile # Detox E2E tests

# Build
pnpm build:web       # Build Next.js for production
pnpm build:mobile    # Expo EAS Build (iOS + Android)

# Deploy
pnpm deploy:functions # Deploy Firebase Functions
pnpm deploy:rules     # Deploy Firestore + Storage rules
pnpm deploy:web       # Deploy web to Vercel/Firebase Hosting

# Database
pnpm emulators        # Start all Firebase emulators locally
```

---

*Multi-Agent Guide v1.0 | Soteria Assurance | Trainovate Technologies*  
*Contact: Jamil Kareem Jones, Founder & CPO*
