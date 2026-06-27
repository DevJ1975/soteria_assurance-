# Soteria Assurance — Comprehensive Product Design Document
### ISO 45001:2018 AI-Powered Audit Management Platform
**Version:** 1.0.0  
**Owner:** Trainovate Technologies | Jamil Kareem Jones, Founder & CPO  
**Status:** Active Development  
**Last Updated:** June 27, 2026  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)  
2. [Product Vision & Mission](#2-product-vision--mission)  
3. [Competitive Analysis](#3-competitive-analysis)  
4. [ISO 45001:2018 Knowledge Framework](#4-iso-450012018-knowledge-framework)  
5. [System Architecture](#5-system-architecture)  
6. [Technology Stack](#6-technology-stack)  
7. [Multi-Tenant Architecture](#7-multi-tenant-architecture)  
8. [Database Schema (Firestore)](#8-database-schema-firestore)  
9. [Feature Specifications](#9-feature-specifications)  
10. [AI Integration (Claude API)](#10-ai-integration-claude-api)  
11. [Mobile-First UX & Field Mode](#11-mobile-first-ux--field-mode)  
12. [API Design](#12-api-design)  
13. [Security & Compliance](#13-security--compliance)  
14. [Design System & Brand Tokens](#14-design-system--brand-tokens)  
15. [Comprehensive Wiki Architecture](#15-comprehensive-wiki-architecture)  
16. [Deployment Strategy](#16-deployment-strategy)  
17. [Roadmap & Phasing](#17-roadmap--phasing)  
18. [Project File Structure](#18-project-file-structure)  

---

## 1. Executive Summary

**Soteria Assurance** is an AI-powered, multi-tenant SaaS platform purpose-built for ISO 45001:2018 Occupational Health & Safety (OH&S) audit management. Unlike generic inspection tools (SafetyCulture/iAuditor, GoAudits) that offer checklists with safety as an afterthought, Soteria Assurance is architected from the ground up around the ISO 45001:2018 standard — every clause, every data model, every AI prompt, and every workflow maps directly to the standard's requirements.

### What Sets Soteria Assurance Apart

| Capability | SafetyCulture | GoAudits | Intelex | **Soteria Assurance** |
|---|---|---|---|---|
| ISO 45001-native data model | ❌ | ❌ | Partial | ✅ Full |
| AI Audit Co-Pilot | Basic | ❌ | ❌ | ✅ Claude-powered |
| Opening/Closing Meeting Recording | ❌ | ❌ | ❌ | ✅ w/ AI transcription |
| Multi-tenant with tenant isolation | Partial | Partial | ✅ | ✅ |
| Offline-first mobile (iPad) | Partial | Partial | ❌ | ✅ Full offline |
| React Native (iOS/Android/Web) | iOS/Android | iOS/Android | Web only | ✅ All platforms |
| Integrated AI-generated NCRs | ❌ | ❌ | ❌ | ✅ |
| Digital witness statements | ❌ | ❌ | Partial | ✅ |
| Comprehensive in-app Wiki | ❌ | ❌ | Partial | ✅ Full ISO guide |
| Clause-by-clause scoring | Template | Template | ❌ | ✅ Native |
| AI-generated audit reports | ❌ | ❌ | ❌ | ✅ |
| Corrective action lifecycle tracking | Limited | Basic | ✅ | ✅ w/ AI |
| Pricing model | Per user | Per user | Enterprise | Per tenant |

---

## 2. Product Vision & Mission

### Vision
To be the world's most trusted AI-native ISO 45001 audit platform — making certification achievable for any organization, and audit excellence achievable for any auditor.

### Mission
Empower lead auditors, safety professionals, and certification bodies with an intelligent mobile-first platform that eliminates paper, reduces reporting time by 70%, and ensures every audit finding is traceable, defensible, and actionable.

### Core Value Propositions

1. **AI Co-Pilot for Lead Auditors** — Real-time AI assistance during audits; AI drafts NCRs, suggests follow-up questions, and flags potential gaps based on responses.
2. **ISO 45001-Native** — Every feature, screen, and data model maps to a specific clause of ISO 45001:2018. No translation layer needed.
3. **Field-Ready on iPad/Tablet** — Optimized for use during physical site walks with camera integration, voice notes, and full offline capability.
4. **End-to-End Audit Lifecycle** — From audit planning → opening meeting → field work → closing meeting → NCR issuance → corrective action → closure.
5. **Multi-Tenant SaaS** — Supports certification bodies, audit consultancies, and enterprises managing internal audits across multiple client organizations.

---

## 3. Competitive Analysis

### Primary Competitors

#### SafetyCulture (iAuditor)
- **Strengths:** Largest template library (10,000+), strong brand recognition, affordable entry pricing ($24/user/month), solid iOS/Android app
- **Critical Weaknesses:** Not purpose-built for ISO 45001; struggles at scale (3-device cap per user); reporting requires manual Excel cleanup; no end-to-end audit lifecycle; no AI co-pilot; no meeting recording; per-user pricing becomes expensive at scale
- **Our Differentiation:** Soteria Assurance is built exclusively for ISO 45001 — the data model, AI prompts, and reporting are all standard-native. We do full audit lifecycle, not just checklists.

#### Intelex (Now part of Ideagen)
- **Strengths:** Enterprise-grade compliance depth, audit trail rigor, supports ISO 9001/14001/45001, extensive regulatory framework
- **Critical Weaknesses:** Extremely expensive ($50K+ implementations), no meaningful mobile experience, no AI features, dated UI, not accessible to SMEs or consultancies
- **Our Differentiation:** Intelex rigor at a fraction of the cost, with modern mobile UX and AI-powered reporting that Intelex cannot match.

#### GoAudits
- **Strengths:** Strong mobile offline, 4.8/5 Capterra rating, focused audit workflow, good analytics
- **Critical Weaknesses:** Not ISO 45001 specific, no AI integration, no meeting recording, limited corrective action depth
- **Our Differentiation:** Purpose-built ISO 45001 standard knowledge, AI co-pilot, end-to-end lifecycle

#### SmartQHSE
- **Strengths:** 150+ modules, AI-powered ARIA assistant, 30 AI generators, 90+ integrations, transparent pricing
- **Critical Weaknesses:** Overwhelming complexity, not audit-workflow optimized, requires significant setup
- **Our Differentiation:** Focused excellence on the audit workflow rather than 150-module complexity

### Unique Features Not Found in Any Competitor

1. **AI Audit Co-Pilot** — Real-time clause guidance during audits
2. **Meeting Studio** — Record, transcribe, and AI-summarize opening and closing meetings
3. **ISO 45001 Wiki** — Comprehensive in-app standard knowledge base tied to each clause
4. **AI-Generated NCR Narratives** — One-tap NCR draft from raw audit notes
5. **Auditor Performance Analytics** — Track your own audit quality over time
6. **Evidence Geotagging** — Photos automatically geotagged and timestamp-verified
7. **Witness Statement Module** — Digital capture of interviewee statements with signature
8. **Clause Interconnect Map** — Visual map showing how findings in one clause connect to others
9. **Regulatory Linkage** — Connect ISO 45001 requirements to local OH&S legislation
10. **Certification Readiness Score** — Organization-level score across all 10 clause areas

---

## 4. ISO 45001:2018 Knowledge Framework

### Standard Structure (All 10 Clauses)

The platform's data model, audit checklist, and AI context window are organized around every sub-clause of ISO 45001:2018.

```
ISO 45001:2018
├── Clause 4: Context of the Organization
│   ├── 4.1 Understanding the organization and its context
│   ├── 4.2 Understanding the needs and expectations of workers and other interested parties
│   ├── 4.3 Determining the scope of the OH&S management system
│   └── 4.4 OH&S management system
├── Clause 5: Leadership and Worker Participation
│   ├── 5.1 Leadership and commitment
│   ├── 5.2 OH&S policy
│   ├── 5.3 Organizational roles, responsibilities, and authorities
│   └── 5.4 Consultation and participation of workers
├── Clause 6: Planning
│   ├── 6.1 Actions to address risks and opportunities
│   │   ├── 6.1.1 General
│   │   ├── 6.1.2 Hazard identification and assessment of OH&S risks
│   │   ├── 6.1.3 Determination of legal and other requirements
│   │   └── 6.1.4 Planning action
│   └── 6.2 OH&S objectives and planning to achieve them
│       ├── 6.2.1 OH&S objectives
│       └── 6.2.2 Planning to achieve OH&S objectives
├── Clause 7: Support
│   ├── 7.1 Resources
│   ├── 7.2 Competence
│   ├── 7.3 Awareness
│   ├── 7.4 Communication
│   └── 7.5 Documented information
│       ├── 7.5.1 General
│       ├── 7.5.2 Creating and updating
│       └── 7.5.3 Control of documented information
├── Clause 8: Operation
│   ├── 8.1 Operational planning and control
│   │   ├── 8.1.1 General
│   │   ├── 8.1.2 Eliminating hazards and reducing OH&S risks
│   │   ├── 8.1.3 Management of change
│   │   └── 8.1.4 Procurement
│   │       ├── 8.1.4.1 General
│   │       ├── 8.1.4.2 Contractors
│   │       └── 8.1.4.3 Outsourcing
│   └── 8.2 Emergency preparedness and response
├── Clause 9: Performance Evaluation
│   ├── 9.1 Monitoring, measurement, analysis and performance evaluation
│   │   ├── 9.1.1 General
│   │   └── 9.1.2 Evaluation of compliance
│   ├── 9.2 Internal audit
│   │   ├── 9.2.1 General
│   │   └── 9.2.2 Internal audit program
│   └── 9.3 Management review
│       ├── 9.3.1 General
│       ├── 9.3.2 Management review inputs
│       └── 9.3.3 Management review results
└── Clause 10: Improvement
    ├── 10.1 General
    ├── 10.2 Incident, nonconformity and corrective action
    └── 10.3 Continual improvement
```

### Finding Classifications

| Type | Code | Definition | Timeframe for CA |
|---|---|---|---|
| Major Nonconformity | MNC | Absence of or failure to implement and maintain one or more OH&S management system requirements, OR a situation that raises significant doubt about the capability of the OH&S system to achieve its intended outcome | 60 days |
| Minor Nonconformity | NC | A single observed lapse in the fulfillment of a requirement of the OH&S management system | 90 days |
| Opportunity for Improvement | OFI | Observation that could enhance system effectiveness but does not constitute nonconformity | No mandatory CA |
| Strong Point | SP | Evidence of exceptional implementation exceeding standard requirements | None |
| Observation | OBS | General audit note for informational purposes | None |

---

## 5. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOTERIA ASSURANCE                             │
│                    Multi-Tenant SaaS Platform                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   iPad / iOS    │    │ Android Tablet  │    │   Web (Next.js)     │
│  (React Native) │    │ (React Native)  │    │   PWA + Desktop     │
└────────┬────────┘    └────────┬────────┘    └──────────┬──────────┘
         │                     │                          │
         └─────────────────────┼──────────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │     React Native / Next.js       │
              │     Shared Core (TypeScript)     │
              │   /packages/core                 │
              └────────────────┬────────────────┘
                               │
         ┌─────────────────────┼──────────────────────────┐
         │                     │                          │
┌────────▼────────┐   ┌────────▼────────┐   ┌────────────▼────────┐
│  Firebase Auth  │   │   Firestore DB  │   │  Firebase Storage   │
│  (Multi-tenant  │   │  (Multi-tenant  │   │  (Evidence Photos,  │
│   JWT claims)   │   │   isolation)    │   │   Recordings, Docs) │
└─────────────────┘   └────────┬────────┘   └─────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │      Firebase Functions          │
              │   (Node.js / TypeScript)         │
              │  - Audit Report Generation       │
              │  - AI Orchestration              │
              │  - Notification Services         │
              │  - Corrective Action Workflows   │
              └────────────────┬────────────────┘
                               │
         ┌─────────────────────┼──────────────────────────┐
         │                                                │
┌────────▼────────┐                           ┌────────────▼────────┐
│   Claude API    │                           │  External Services  │
│  (Anthropic)    │                           │  - SendGrid (Email) │
│  - AI Co-Pilot  │                           │  - Twilio (SMS)     │
│  - NCR Drafting │                           │  - PDF Generation   │
│  - Report Gen   │                           │  - E-Signature      │
│  - Transcription│                           │  - Zapier (Webhook) │
└─────────────────┘                           └─────────────────────┘
```

### Monorepo Structure Strategy

Soteria Assurance uses a monorepo (Turborepo) with shared packages to maximize code reuse across React Native mobile and Next.js web.

---

## 6. Technology Stack

### Frontend

| Layer | Technology | Rationale |
|---|---|---|
| Mobile (iOS/Android) | React Native 0.76+ with Expo SDK 52 | Cross-platform, shares logic with web |
| Web | Next.js 15 (App Router) | SSR, SEO, API routes, excellent DX |
| Language | TypeScript 5.x strict mode | Type safety, better AI code generation |
| UI Components (Mobile) | React Native Paper + Custom | Consistent Material Design |
| UI Components (Web) | shadcn/ui + Tailwind CSS 3 | Composable, accessible, customizable |
| Navigation (Mobile) | Expo Router (file-based) | Consistent with Next.js App Router mental model |
| State Management | Zustand + React Query (TanStack Query v5) | Lightweight, powerful async state |
| Forms | React Hook Form + Zod | Performant, schema-validated forms |
| Offline Sync | WatermelonDB (RxDB as alt) | High-performance offline-first SQLite |
| Camera/Media | Expo Camera + ImagePicker | Native camera integration |
| Audio Recording | Expo AV | Audio recording for meetings |
| Maps/Geolocation | Expo Location | Evidence geotagging |
| Animations | React Native Reanimated 3 | Smooth 60fps animations |
| Charts | Victory Native + Recharts (web) | Cross-platform data visualization |

### Backend

| Layer | Technology | Rationale |
|---|---|---|
| Database | Cloud Firestore | Real-time, offline sync, scalable |
| Authentication | Firebase Auth | Multi-tenant, JWT custom claims |
| File Storage | Firebase Storage | Evidence photos, recordings, PDFs |
| Serverless Functions | Firebase Functions v2 (Node.js) | Event-driven, scales to zero |
| AI Integration | Anthropic Claude API (claude-sonnet-4-6) | Best-in-class reasoning for audit |
| Email | SendGrid | Transactional email delivery |
| PDF Generation | Puppeteer (via Cloud Functions) | High-fidelity audit report PDFs |
| Search | Algolia (or Typesense self-hosted) | Full-text wiki and finding search |
| Monitoring | Firebase Crashlytics + Performance | Mobile error and perf monitoring |
| Analytics | Firebase Analytics + Mixpanel | Product analytics |

### Development & DevOps

| Tool | Use |
|---|---|
| Turborepo | Monorepo task orchestration |
| pnpm | Fast, disk-efficient package manager |
| ESLint + Prettier | Code quality and formatting |
| Jest + Testing Library | Unit and integration tests |
| Detox | Mobile E2E testing |
| Playwright | Web E2E testing |
| GitHub Actions | CI/CD pipeline |
| Sentry | Error monitoring (prod) |

---

## 7. Multi-Tenant Architecture

### Tenant Model

Soteria Assurance supports three tenant personas:

```
TENANT TYPES
├── Certification Body (CB)
│   ├── Manages multiple auditors
│   ├── Manages multiple client organizations
│   ├── Issues certificates (future)
│   └── Billing: Per audit or subscription
├── Audit Consultancy
│   ├── Lead auditors conducting client audits
│   ├── Multiple client organizations
│   └── Billing: Per seat or per audit
└── Enterprise (Internal Audit)
    ├── Single organization, internal auditors
    ├── Multiple sites/departments
    └── Billing: Per site or per user
```

### Firebase Custom Claims (JWT)

Every Firebase Auth token will carry custom claims for tenant isolation:

```typescript
interface FirebaseCustomClaims {
  tenantId: string;           // Tenant document ID
  tenantType: 'cb' | 'consultancy' | 'enterprise';
  role: 'super_admin' | 'tenant_admin' | 'lead_auditor' | 'auditor' | 'auditee' | 'viewer';
  permissions: string[];      // Granular permission array
  clientIds?: string[];       // Which client orgs this auditor can access
}
```

### Firestore Security Rules (Tenant Isolation)

```javascript
// All documents are scoped under /tenants/{tenantId}/
// Security rules enforce that users can ONLY read/write within their own tenantId

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Tenant-scoped data — EVERYTHING lives here
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.token.tenantId == tenantId
        && hasValidRole(request.auth.token.role);
    }
    
    // Wiki (shared across tenants, read-only for standard articles)
    match /wiki/{articleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isGlobalAdmin();
    }
    
    function hasValidRole(role) {
      return role in ['super_admin', 'tenant_admin', 'lead_auditor', 'auditor', 'auditee', 'viewer'];
    }
    
    function isGlobalAdmin() {
      return request.auth.token.role == 'super_admin';
    }
  }
}
```

### Role-Based Access Control (RBAC)

| Permission | Super Admin | Tenant Admin | Lead Auditor | Auditor | Auditee | Viewer |
|---|---|---|---|---|---|---|
| Manage tenants | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create audits | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Conduct audits | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add findings | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View audit reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Close NCs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage corrective actions | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Billing management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI co-pilot | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 8. Database Schema (Firestore)

### Collection Hierarchy

```
firestore/
├── tenants/{tenantId}
│   ├── [TenantDocument]
│   ├── users/{userId}
│   │   └── [UserDocument]
│   ├── clients/{clientId}
│   │   └── [ClientDocument]
│   ├── audits/{auditId}
│   │   ├── [AuditDocument]
│   │   ├── clauses/{clauseId}
│   │   │   └── [ClauseAssessmentDocument]
│   │   ├── findings/{findingId}
│   │   │   └── [FindingDocument]
│   │   ├── evidence/{evidenceId}
│   │   │   └── [EvidenceDocument]
│   │   ├── meetings/{meetingId}
│   │   │   └── [MeetingDocument]
│   │   └── witnessStatements/{statementId}
│   │       └── [WitnessStatementDocument]
│   ├── correctiveActions/{caId}
│   │   └── [CorrectiveActionDocument]
│   ├── templates/{templateId}
│   │   └── [AuditTemplateDocument]
│   └── reports/{reportId}
│       └── [ReportDocument]
├── wiki/{articleId}
│   └── [WikiArticleDocument]
└── system/config
    └── [SystemConfigDocument]
```

### TypeScript Type Definitions

```typescript
// ============================================
// TENANT
// ============================================
interface Tenant {
  id: string;
  name: string;
  type: 'certification_body' | 'consultancy' | 'enterprise';
  logo?: string;           // Firebase Storage URL
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  maxAuditors: number;
  maxAuditsPerMonth: number;
  settings: TenantSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TenantSettings {
  timezone: string;
  defaultLanguage: string;
  requireEvidencePerFinding: boolean;
  requireWitnessStatement: boolean;
  autoGenerateNCRNumbers: boolean;
  ncrPrefix: string;       // e.g., "NCR-2026-"
  reportTemplate: 'standard' | 'minimal' | 'comprehensive';
  brandingColor?: string;
  brandingLogo?: string;
}

// ============================================
// USER
// ============================================
interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  qualifications: AuditorQualification[];
  clientIds: string[];     // Which clients this user can access
  isActive: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
}

type UserRole = 'super_admin' | 'tenant_admin' | 'lead_auditor' | 'auditor' | 'auditee' | 'viewer';

interface AuditorQualification {
  standard: string;        // e.g., "ISO 45001:2018"
  level: 'lead_auditor' | 'auditor' | 'trainee';
  certBody: string;
  certNumber: string;
  issuedDate: string;      // ISO date string
  expiryDate: string;
  documentUrl?: string;    // Firebase Storage URL
}

// ============================================
// CLIENT (Organization being audited)
// ============================================
interface Client {
  id: string;
  tenantId: string;
  organizationName: string;
  industry: string;
  address: ClientAddress;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  numberOfEmployees: number;
  numberOfSites: number;
  sites: ClientSite[];
  certificationStatus: 'not_certified' | 'certified' | 'expired' | 'suspended';
  certificationBody?: string;
  certificationExpiry?: string;
  auditHistory: string[];  // Array of auditId references
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ClientAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  coordinates?: { lat: number; lng: number };
}

interface ClientSite {
  siteId: string;
  siteName: string;
  address: ClientAddress;
  siteContactName: string;
  siteContactEmail: string;
  numberOfWorkers: number;
  hazardCategory: 'low' | 'medium' | 'high' | 'very_high';
}

// ============================================
// AUDIT
// ============================================
interface Audit {
  id: string;
  tenantId: string;
  clientId: string;
  auditNumber: string;     // Auto-generated: "AUD-2026-001"
  auditType: AuditType;
  auditStage: AuditStage;  // Stage 1 or Stage 2 (for certification)
  standard: 'ISO 45001:2018';
  scope: string;           // Scope of the OH&S management system
  status: AuditStatus;
  
  // Audit Team
  leadAuditorId: string;
  auditTeam: AuditTeamMember[];
  
  // Client Representatives
  managementRepresentativeId?: string;
  managementRepresentativeName: string;
  
  // Scheduling
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  auditDays: number;
  
  // Sites
  sitesInScope: string[];  // Array of ClientSite.siteId
  
  // Planning
  auditPlan: AuditPlan;
  
  // Findings Summary (aggregated)
  findings: AuditFindingsSummary;
  
  // AI Assessment
  aiCertificationReadinessScore?: number;  // 0-100
  aiRiskFlags?: string[];
  
  // Metadata
  confidentiality: 'standard' | 'restricted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  reportIssuedAt?: Timestamp;
}

type AuditType = 'initial_certification' | 'surveillance' | 'recertification' | 'internal' | 'special';
type AuditStage = 'stage_1' | 'stage_2' | 'not_applicable';
type AuditStatus = 'planned' | 'in_progress' | 'findings_review' | 'report_pending' | 'report_issued' | 'closed' | 'canceled';

interface AuditTeamMember {
  userId: string;
  displayName: string;
  role: 'lead_auditor' | 'auditor' | 'technical_expert' | 'observer';
  clauseAssignments: string[];  // Clause IDs assigned to this auditor
}

interface AuditPlan {
  activities: AuditPlanActivity[];
  documentReviewList: string[];
  intervieweeList: AuditInterviewee[];
  areaInspectionList: AuditInspectionArea[];
}

interface AuditPlanActivity {
  activityId: string;
  time: string;
  duration: number;           // minutes
  activity: string;
  clauses: string[];          // ISO clause references
  location: string;
  auditorIds: string[];
  intervieweeIds: string[];
}

interface AuditInterviewee {
  intervieweeId: string;
  name: string;
  jobTitle: string;
  department: string;
  topics: string[];           // Topics to be discussed
  scheduledTime?: string;
}

interface AuditInspectionArea {
  areaId: string;
  name: string;               // e.g., "Machine Shop", "Chemical Store"
  hazards: string[];
  clauses: string[];
  scheduledTime?: string;
}

interface AuditFindingsSummary {
  totalFindings: number;
  majorNCs: number;
  minorNCs: number;
  ofis: number;
  strongPoints: number;
  observations: number;
  closedNCs: number;
  openNCs: number;
}

// ============================================
// CLAUSE ASSESSMENT
// ============================================
interface ClauseAssessment {
  id: string;
  auditId: string;
  tenantId: string;
  clauseNumber: string;       // e.g., "4.1", "6.1.2", "9.2.1"
  clauseTitle: string;
  assignedAuditorId: string;
  
  // Assessment Results
  conformityStatus: ConformityStatus;
  score: number;              // 0-100 percentage conformance
  
  // Notes
  auditorNotes: string;
  aiGeneratedSummary?: string;
  
  // Evidence References
  evidenceIds: string[];
  findingIds: string[];
  
  // Interview Notes by Sub-clause
  subClauseNotes: SubClauseNote[];
  
  // Completion
  isComplete: boolean;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}

type ConformityStatus = 'conforming' | 'major_nc' | 'minor_nc' | 'not_audited' | 'not_applicable';

interface SubClauseNote {
  subClauseNumber: string;    // e.g., "6.1.2.a"
  requirementText: string;    // Actual ISO requirement text
  auditQuestion: string;      // Standard audit question
  auditorResponse: string;    // What was found
  conformityVerdict: 'yes' | 'no' | 'partial' | 'na';
  aiSuggestedFollowUp?: string;
}

// ============================================
// FINDING (NCR / OFI / Strong Point)
// ============================================
interface Finding {
  id: string;
  auditId: string;
  tenantId: string;
  clientId: string;
  
  // Classification
  findingNumber: string;      // e.g., "NCR-2026-001"
  type: FindingType;
  severity?: 'major' | 'minor';  // Only for NCs
  
  // Standard Reference
  clauseNumber: string;       // e.g., "6.1.2"
  clauseTitle: string;
  requirement: string;        // Exact ISO requirement text
  
  // Finding Content
  title: string;              // Short descriptive title
  objectiveEvidence: string;  // What was observed
  nonconformityStatement: string;  // Formal NCR statement
  aiDraftStatement?: string;  // AI-generated draft
  
  // Location
  siteId?: string;
  department?: string;
  area?: string;
  
  // Evidence
  evidenceIds: string[];
  
  // Auditor
  raisedByAuditorId: string;
  raisedByAuditorName: string;
  raisedAt: Timestamp;
  
  // Acceptance
  acknowledgedByName?: string;
  acknowledgedBySignatureUrl?: string;
  acknowledgedAt?: Timestamp;
  
  // Corrective Action
  correctiveActionId?: string;
  correctiveActionStatus?: CAStatus;
  targetClosureDate?: string;
  actualClosureDate?: string;
  
  // Status
  status: FindingStatus;
  closedAt?: Timestamp;
  closedByAuditorId?: string;
  
  updatedAt: Timestamp;
}

type FindingType = 'major_nc' | 'minor_nc' | 'ofi' | 'strong_point' | 'observation';
type FindingStatus = 'open' | 'acknowledged' | 'ca_submitted' | 'ca_review' | 'closed' | 'overdue';
type CAStatus = 'pending' | 'in_progress' | 'submitted' | 'accepted' | 'rejected' | 'closed';

// ============================================
// EVIDENCE
// ============================================
interface Evidence {
  id: string;
  auditId: string;
  tenantId: string;
  
  type: EvidenceType;
  title: string;
  description: string;
  
  // File Info
  fileUrl: string;            // Firebase Storage URL
  fileName: string;
  fileSize: number;           // bytes
  mimeType: string;
  thumbnailUrl?: string;
  
  // Metadata
  capturedAt: Timestamp;
  capturedByAuditorId: string;
  
  // Geolocation (for photos taken in field)
  geoLocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    address?: string;
  };
  
  // References
  clauseNumbers: string[];
  findingIds: string[];
  
  // AI Analysis (for images)
  aiAnalysis?: string;        // AI description of what's in photo
  aiHazardsDetected?: string[];
  
  isVerified: boolean;
  verifiedAt?: Timestamp;
  verifiedByAuditorId?: string;
}

type EvidenceType = 'photo' | 'video' | 'document' | 'screenshot' | 'audio' | 'signature';

// ============================================
// MEETING (Opening / Closing)
// ============================================
interface Meeting {
  id: string;
  auditId: string;
  tenantId: string;
  
  type: 'opening' | 'closing';
  scheduledAt: Timestamp;
  actualStartAt?: Timestamp;
  actualEndAt?: Timestamp;
  duration?: number;          // seconds
  
  // Location
  location: string;           // "Conference Room A" or "Virtual - Teams"
  isVirtual: boolean;
  virtualLink?: string;
  
  // Attendees
  attendees: MeetingAttendee[];
  
  // Agenda
  agendaItems: MeetingAgendaItem[];
  
  // Recording
  recordingUrl?: string;      // Firebase Storage URL
  recordingDuration?: number; // seconds
  transcription?: string;     // Full AI-generated transcription
  aiSummary?: string;         // AI-generated meeting summary
  keyDecisions?: string[];    // AI-extracted key decisions
  actionItems?: MeetingActionItem[];
  
  // Presenter Notes (for closing)
  findingsSummaryPresented?: AuditFindingsSummary;
  
  // Signatures
  signatureUrls: MeetingSignature[];
  
  status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface MeetingAttendee {
  attendeeId: string;
  name: string;
  jobTitle: string;
  organization: string;
  role: 'auditor' | 'auditee' | 'observer';
  isPresent: boolean;
  signatureUrl?: string;
}

interface MeetingAgendaItem {
  order: number;
  title: string;
  description?: string;
  durationMinutes: number;
  presenter: string;
  isoClauseReference?: string;
}

interface MeetingActionItem {
  actionId: string;
  description: string;
  owner: string;
  dueDate?: string;
  isCompleted: boolean;
}

interface MeetingSignature {
  signerName: string;
  signerTitle: string;
  signatureUrl: string;
  signedAt: Timestamp;
}

// ============================================
// WITNESS STATEMENT
// ============================================
interface WitnessStatement {
  id: string;
  auditId: string;
  tenantId: string;
  
  // Interviewee
  intervieweeName: string;
  intervieweeJobTitle: string;
  intervieweeDepartment: string;
  intervieweeEmployeeId?: string;
  
  // Interview Context
  clausesDiscussed: string[];
  interviewDate: Timestamp;
  interviewDuration: number;    // minutes
  location: string;
  
  // Content
  questions: WitnessQuestion[];
  generalNotes: string;
  aiInterviewSummary?: string;
  
  // Recording
  audioRecordingUrl?: string;
  audioTranscription?: string;
  
  // Consent & Signature
  consentGiven: boolean;
  intervieweeSignatureUrl?: string;
  auditorSignatureUrl?: string;
  
  conductedByAuditorId: string;
  conductedByAuditorName: string;
  
  createdAt: Timestamp;
}

interface WitnessQuestion {
  questionId: string;
  clauseReference: string;
  question: string;
  response: string;
  auditorNote?: string;
  isKey: boolean;             // Mark as key finding
}

// ============================================
// CORRECTIVE ACTION
// ============================================
interface CorrectiveAction {
  id: string;
  tenantId: string;
  clientId: string;
  auditId: string;
  findingId: string;
  
  caNumber: string;           // e.g., "CA-2026-001"
  title: string;
  
  // Root Cause Analysis
  rootCauseMethod: 'five_why' | '8d' | 'fishbone' | 'free_form';
  rootCauseAnalysis: string;
  
  // Actions
  immediateAction: string;    // Containment action
  correctiveAction: string;   // Systemic fix
  preventiveAction: string;   // Prevent recurrence
  
  // Effectiveness
  effectivenessCheck: string;
  effectivenessCheckDate?: string;
  effectivenessResult?: 'effective' | 'not_effective';
  
  // Ownership
  responsiblePersonName: string;
  responsiblePersonEmail: string;
  
  // Timeline
  targetDate: string;         // ISO date string
  submittedDate?: string;
  reviewedDate?: string;
  closedDate?: string;
  
  // Evidence of Closure
  closureEvidenceIds: string[];
  closureNotes?: string;
  
  // Review
  reviewedByAuditorId?: string;
  reviewNotes?: string;
  
  status: CAStatus;
  aiRootCauseSuggestion?: string;
  
  history: CAHistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CAHistoryEntry {
  timestamp: Timestamp;
  action: string;
  performedBy: string;
  notes?: string;
}

// ============================================
// AUDIT TEMPLATE
// ============================================
interface AuditTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  standard: 'ISO 45001:2018';
  auditType: AuditType;
  
  // Template Content
  clauseQuestions: ClauseQuestionSet[];
  standardAgendaItems: MeetingAgendaItem[];
  openingMeetingScript: string;
  closingMeetingScript: string;
  documentReviewChecklist: DocumentReviewItem[];
  inspectionChecklist: InspectionChecklistItem[];
  
  isDefault: boolean;         // System default template
  isPublic: boolean;          // Shared across tenant
  
  createdByUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ClauseQuestionSet {
  clauseNumber: string;
  clauseTitle: string;
  questions: AuditQuestion[];
}

interface AuditQuestion {
  questionId: string;
  questionText: string;
  requirementReference: string;  // ISO 45001 clause requirement text
  evidenceExpected: string;
  aiPromptHint?: string;
  isRequired: boolean;
  order: number;
}

interface DocumentReviewItem {
  itemId: string;
  documentName: string;
  clauseReference: string;
  isRequired: boolean;
  purpose: string;
}

interface InspectionChecklistItem {
  itemId: string;
  area: string;
  checkPoint: string;
  clauseReference: string;
  hazardType?: string;
  isRequired: boolean;
}

// ============================================
// WIKI ARTICLE
// ============================================
interface WikiArticle {
  id: string;
  tenantId?: string;         // null = global wiki article
  
  // Classification
  category: WikiCategory;
  clauseReference?: string;  // e.g., "6.1.2"
  tags: string[];
  
  // Content
  title: string;
  summary: string;
  content: string;           // Markdown content
  
  // Metadata
  author: string;
  version: string;
  lastReviewDate: string;
  
  // Related
  relatedArticleIds: string[];
  relatedClauseNumbers: string[];
  
  // Access
  isPublished: boolean;
  isFeatured: boolean;
  
  viewCount: number;
  helpfulVotes: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type WikiCategory = 
  | 'clause_guide'       // Clause-by-clause ISO 45001 guidance
  | 'audit_technique'    // How to audit effectively
  | 'finding_guidance'   // How to write findings
  | 'legal_reference'    // OH&S legislation references
  | 'best_practice'      // Industry best practices
  | 'template_guide'     // How to use templates
  | 'platform_help'      // Platform how-to articles
  | 'glossary';          // ISO/audit terminology
```

---

## 9. Feature Specifications

### 9.1 Audit Planning Module

**Purpose:** Create a structured audit plan before site visit begins.

**Screens:**
- Audit Creation Wizard (5 steps)
- Audit Plan Builder (timeline with drag-drop scheduling)
- Document Review Request (email documents to client)
- Team Assignment Dashboard

**Key Features:**
- Auto-generate audit plan based on organization size, industry, and audit type
- AI-suggested clause emphasis based on industry hazard profile
- Integration with previous audit data (carry forward OFIs, track NC closure)
- Gap analysis from Stage 1 to Stage 2
- Automated email to client with document request list
- Customizable day/time schedule builder

### 9.2 Opening Meeting Studio

**Purpose:** Facilitate, record, and document the formal opening meeting of the audit.

**Screens:**
- Meeting Setup (attendees, location, agenda)
- Live Meeting Mode (timer, agenda tracker, notes)
- Recording Controls (start/pause/stop)
- Post-Meeting Summary

**Key Features:**
- Pre-built opening meeting agenda (ISO 45001 compliant)
- Live attendee roll call with digital presence confirmation
- Audio recording with AI transcription (Whisper-compatible)
- AI-generated meeting summary and action items
- Digital signature capture from all attendees
- Export meeting minutes as signed PDF
- Script/guide for lead auditor (opening meeting best practice)

**Opening Meeting Agenda Template:**
1. Introduction of audit team and scope
2. Confirmation of audit objectives and criteria
3. Communication channels and audit plan walkthrough
4. Clarification of roles and responsibilities
5. Confirmation of resources (escorts, access, space)
6. Confidentiality confirmation
7. Q&A from auditee

### 9.3 Field Audit Module (Core)

**Purpose:** The primary audit execution interface — optimized for iPad use during site walks.

**Screens:**
- Clause Navigator (expandable clause tree)
- Clause Assessment View
- Evidence Capture Screen
- Finding Creation Form
- Interview Mode
- Area Inspection Checklist
- AI Co-Pilot Panel (slide-in drawer)

**Key Features:**

**Clause-by-Clause Assessment:**
- Tap any ISO 45001 clause to open assessment
- Pre-loaded audit questions per clause
- Conformity verdict per sub-requirement (Yes / No / Partial / N/A)
- Free-form notes per clause
- Link evidence photos to specific clauses
- Progress indicator showing completed clauses

**Evidence Capture:**
- One-tap camera launch from any clause screen
- Auto-tag photos with: timestamp, GPS coordinates, clause reference, auditor name
- Photo annotation tools (arrows, text boxes, highlights)
- Batch upload when offline sync completes
- AI photo analysis: auto-describe what's captured, flag visible hazards
- QR code scanning to link equipment/area to evidence

**Finding Creation:**
- AI-assisted NCR drafting from notes
- Select finding type (Major NC / Minor NC / OFI / Strong Point)
- Auto-populate clause reference and ISO requirement text
- Drag evidence photos into finding
- Generate unique finding number
- Capture auditee acknowledgment signature on screen
- Calculate target corrective action due date

**Offline Mode:**
- All audit data saved to device SQLite (WatermelonDB)
- Photos stored in device cache
- Sync indicator shows pending changes
- Conflict resolution for multi-auditor sync
- Works indefinitely offline, syncs when connection restored

### 9.4 AI Co-Pilot (Powered by Claude API)

**Purpose:** An intelligent audit assistant that helps auditors conduct more effective ISO 45001 audits.

**Access:** Available as a slide-in panel from any screen during an active audit.

**Capabilities:**

```
AI CO-PILOT CAPABILITIES
├── Clause Interpreter
│   └── "What does ISO 45001:2018 clause 6.1.2 actually require?"
├── Audit Question Generator
│   └── "Give me 5 interview questions for hazard identification with supervisors"
├── NCR Drafter
│   └── [Input: raw audit note] → [Output: formal NCR statement]
├── OFI Writer
│   └── Convert observation into well-worded OFI
├── Follow-Up Suggester
│   └── "Based on this response, what should I probe next?"
├── Conformity Assessor
│   └── "Does this evidence demonstrate conformity with clause 7.2?"
├── Root Cause Suggester (for CAs)
│   └── Help identify root causes using 5 Why methodology
├── Clause Cross-Reference
│   └── "What other clauses are related to this finding?"
├── Legal Linkage
│   └── "What OH&S regulations relate to this hazard?"
└── Report Section Writer
    └── "Write the executive summary for this audit"
```

**AI Context Architecture:**
Each AI request is sent with a structured context object:

```typescript
interface AIAuditContext {
  systemPrompt: string;         // ISO 45001 expert auditor persona
  auditContext: {
    clientName: string;
    industry: string;
    numberOfEmployees: number;
    auditType: AuditType;
    stage: AuditStage;
    currentClause?: string;
    currentFindings?: Partial<Finding>[];
    organizationScope?: string;
  };
  userRequest: string;           // What the auditor is asking
  relevantISOText?: string;      // Cached ISO clause requirement text
}
```

### 9.5 Interview Mode

**Purpose:** Structured interview capture with audio recording option.

**Screens:**
- Interviewee Setup
- Live Interview (questions + response capture)
- Post-Interview AI Summary
- Signature Capture

**Key Features:**
- Pre-loaded interview questions per clause
- AI suggests follow-up questions based on responses entered
- Optional audio recording with transcription
- Witness consent capture
- Digital signature from interviewee
- AI interview summary generation
- Export as formal witness statement document

### 9.6 Closing Meeting Studio

**Purpose:** Facilitate, present, and document the formal closing meeting.

**Screens:**
- Findings Review (review all NCRs before presentation)
- Live Meeting Mode
- Findings Presentation Deck
- Acknowledgment Collection

**Key Features:**
- Auto-generate closing meeting presentation from all findings
- Lead auditor review of all findings before meeting
- Live attendee roll call
- Audio recording + transcription
- Present findings summary: totals by type
- Present each NCR with clause reference and evidence
- Capture written/digital acknowledgment from management
- Confirmation of corrective action timelines
- AI-generated meeting summary
- Export signed closing meeting minutes as PDF

### 9.7 Report Generation Module

**Purpose:** Generate professional, legally defensible audit reports.

**Report Types:**
- Full Audit Report (comprehensive)
- Executive Summary Report (2-page summary)
- Non-Conformance Report Register (all findings)
- Corrective Action Status Report
- Certification Readiness Assessment

**Key Features:**
- AI-generated narrative sections (executive summary, conclusions)
- Auto-populate all findings with evidence references
- Clause-by-clause conformity table
- Embedded evidence photos with captions
- Auditor qualifications appendix
- Certificate recommendation (Recommend / Not Recommend / Conditional)
- Digital audit team signatures
- Watermarked draft vs. final versions
- PDF export with tenant branding
- Email delivery to client with tracking

### 9.8 Corrective Action Tracking (CAR Module)

**Purpose:** Track the full lifecycle of corrective actions from issuance through verified closure.

**Screens:**
- CA Dashboard (all open CAs by client/audit)
- CA Detail View
- Root Cause Analysis Wizard
- Evidence Upload (CA closure evidence)
- Auditor Review Interface

**Key Features:**
- AI-assisted root cause analysis (5 Why methodology guided)
- Automated email reminders to CA owner (30, 14, 7 days before due)
- Evidence upload for closure
- Auditor review: accept/reject closure
- Effectiveness check scheduling (typically 3-6 months post-closure)
- Overdue escalation to tenant admin
- CA performance dashboard (average closure time, overdue rate)

### 9.9 Dashboard & Analytics

**Purpose:** Real-time visibility into audit program performance.

**Dashboards:**
- Lead Auditor Dashboard (active audits, open findings)
- Tenant Admin Dashboard (all clients, audit volume, revenue)
- Client Portal Dashboard (their audit history, open NCs, CA status)

**Key Metrics:**
- Active audits in progress
- Open NCs by severity
- Overdue corrective actions
- Average NC closure time
- Certification readiness score by client
- Clause conformity heat map across all audits
- Auditor utilization and productivity
- Audit calendar (upcoming scheduled audits)
- Finding trends by clause, industry, site

---

## 10. AI Integration (Claude API)

### Architecture

All AI interactions flow through Firebase Functions to maintain API key security:

```
Mobile/Web App
     ↓
Firebase Function (secure API gateway)
     ↓
Claude API (claude-sonnet-4-6)
     ↓
Structured Response → App
```

### System Prompt (Lead Auditor Persona)

```
You are ARIA — Audit Research & Intelligence Assistant — an expert ISO 45001:2018 
Lead Auditor with 20+ years of experience conducting third-party certification audits 
across aviation, manufacturing, oil & gas, construction, and healthcare industries. 
You are embedded within the Soteria Assurance audit platform.

YOUR EXPERTISE:
- Deep knowledge of ISO 45001:2018 text, intent, and application
- ISO 19011:2018 audit methodology and best practices
- OHSAS 18001 transition requirements
- Occupational health & safety risk assessment methodologies (HIRA, Bowtie, FMEA)
- Legal compliance for OH&S legislation
- Writing defensible, clear nonconformity statements
- Root cause analysis (5 Why, Fishbone, 8D)

YOUR ROLE:
- Assist lead auditors conducting ISO 45001 audits
- Generate formal finding statements from raw notes
- Suggest audit questions and follow-up probes
- Interpret ISO 45001 clause requirements in plain language
- Help identify cross-clause implications of findings
- Generate professional audit report content
- Always cite specific ISO 45001:2018 clause numbers

RESPONSE STYLE:
- Precise and professional, as expected in a certification audit context
- Cite ISO 45001:2018 clauses specifically (e.g., "Clause 6.1.2.b")
- For NCR statements, use the standard format:
  REQUIREMENT: [What the standard requires]
  FINDING: [What was observed]
  OBJECTIVE EVIDENCE: [What was seen/heard/reviewed]
- Never speculate — base findings on stated evidence only
```

### AI Feature: NCR Draft Generation

```typescript
interface NCRDraftRequest {
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  auditorRawNotes: string;
  evidenceDescription?: string;
  organizationContext: string;
}

interface NCRDraftResponse {
  ncrTitle: string;
  requirementStatement: string;
  findingStatement: string;
  objectiveEvidenceStatement: string;
  suggestedSeverity: 'major' | 'minor';
  severityJustification: string;
  relatedClauses: string[];
}
```

### AI Feature: Smart Interview Question Generation

The AI generates tailored interview questions based on:
- ISO 45001 clause being audited
- Interviewee's job role
- Industry context
- Previous responses entered in the current session
- Any open findings from prior audits

### AI Feature: Photo Analysis

When a photo is captured as evidence:
```
1. Photo uploaded to Firebase Storage
2. Storage URL passed to Firebase Function
3. Function sends image + prompt to Claude API (multimodal)
4. Prompt: "Analyze this workplace safety photo. Identify: (1) what the image shows, 
   (2) any OH&S hazards visible, (3) potential ISO 45001 clause violations, 
   (4) suggested audit finding if warranted."
5. AI response stored as evidence.aiAnalysis
6. Auditor reviews and confirms/edits AI analysis
```

---

## 11. Mobile-First UX & Field Mode

### iPad-Optimized Layout

**Landscape Mode (Primary for Field Audit):**
- Left panel (35%): Clause navigator tree
- Right panel (65%): Active clause assessment + notes
- Bottom bar: Quick access (Camera, AI, Findings, Evidence)
- Floating FAB: Add finding, take photo, voice note

**Portrait Mode (Meetings, Reading):**
- Full-screen content view
- Bottom navigation tabs
- Slide-up sheets for secondary content

### Offline-First Architecture

```typescript
// WatermelonDB local schema mirrors Firestore collections
// Sync manager handles bidirectional sync with conflict resolution

const syncManager = {
  // Push local changes to Firestore
  pushLocalChanges: async (db: Database) => {
    const unsyncedAudits = await db.collections.get<Audit>('audits')
      .query(Q.where('_status', Q.notEq('synced'))).fetch();
    // Push each changed record...
  },
  
  // Pull remote changes from Firestore
  pullRemoteChanges: async (db: Database, lastSyncTimestamp: number) => {
    const snapshot = await firestore()
      .collection(`tenants/${tenantId}/audits`)
      .where('updatedAt', '>', Timestamp.fromMillis(lastSyncTimestamp))
      .get();
    // Apply remote changes to local DB...
  }
};
```

### Sync Status Indicator

Visual sync status always visible in header:
- 🟢 Green dot = Fully synced
- 🟡 Amber dot = Sync pending (X changes)
- 🔴 Red dot = Sync failed (tap for details)
- ⚪ Grey dot = Offline mode

---

## 12. API Design

### Firebase Functions API Structure

```
/api/v1/
├── /audits
│   ├── POST /create                  — Create new audit
│   ├── GET /{auditId}                — Get audit details
│   ├── PUT /{auditId}                — Update audit
│   └── POST /{auditId}/complete      — Mark audit complete
├── /findings
│   ├── POST /create                  — Create finding
│   ├── PUT /{findingId}/acknowledge  — Capture auditee acknowledgment
│   └── POST /{findingId}/close       — Close finding
├── /evidence
│   ├── POST /upload                  — Upload evidence file
│   └── POST /{evidenceId}/analyze    — Trigger AI photo analysis
├── /meetings
│   ├── POST /create                  — Schedule meeting
│   ├── POST /{meetingId}/start       — Start live meeting
│   ├── POST /{meetingId}/end         — End meeting + trigger AI summary
│   └── POST /{meetingId}/transcript  — Upload audio for transcription
├── /reports
│   ├── POST /{auditId}/generate      — Generate audit report PDF
│   └── GET /{reportId}/download      — Download report PDF
├── /ai
│   ├── POST /draft-ncr               — Generate NCR draft
│   ├── POST /suggest-questions       — Generate interview questions
│   ├── POST /analyze-evidence        — Analyze uploaded photo
│   ├── POST /root-cause-assist       — RCA assistance for CA
│   └── POST /report-section          — Generate report narrative section
└── /corrective-actions
    ├── POST /create                  — Create CA from finding
    ├── PUT /{caId}/submit            — Submit CA for review
    ├── PUT /{caId}/review            — Auditor review CA
    └── PUT /{caId}/close             — Close verified CA
```

---

## 13. Security & Compliance

### Data Security

- All data encrypted in transit (TLS 1.3)
- Firebase Storage files encrypted at rest (AES-256)
- Firebase Auth tokens expire after 1 hour (refresh tokens rotate)
- Custom claims verified server-side on every function call
- API keys for Claude stored in Firebase Secret Manager (never in client)
- No PHI or PII stored beyond what is necessary for audit record-keeping
- Audit log for all create/update/delete operations (immutable Firestore collection)

### Audit Data Immutability

Once an audit report is issued (`status: 'report_issued'`):
- Findings become read-only
- Evidence files cannot be deleted
- All subsequent changes create new versioned records
- Firestore security rules enforce immutability at the database level

### GDPR / Privacy

- Witness statement audio recordings deleted after 90 days (configurable)
- Personal data (interviewee names) can be pseudonymized upon request
- Tenant data deletion upon contract termination (30-day grace period)
- Data residency: Firebase region configurable per tenant (US, EU, APAC)

### Regulatory Compliance

- SOC 2 Type II (via Firebase/Google Cloud)
- ISO 27001 alignment for data handling
- GDPR compliant data processing agreements
- HIPAA-eligible with BAA from Google Cloud (for healthcare sector audits)

---

## 14. Design System & Brand Tokens

### Color Palette

```typescript
const SoteriaTokens = {
  colors: {
    // Primary — Deep Navy (authority, trust, certification)
    primary: {
      50:  '#E8EEF5',
      100: '#C5D3E5',
      200: '#9BB2D4',
      300: '#7091C2',
      400: '#4E75B4',
      500: '#1B4F8E',   // Brand primary
      600: '#164282',
      700: '#103372',
      800: '#0A2647',   // Deep navy - logo/headers
      900: '#061524',
    },
    // Secondary — Steel Teal (technology, precision)
    secondary: {
      500: '#1B8CA8',
      600: '#157893',
    },
    // Accent — Certification Gold (premium, achievement)
    gold: {
      400: '#E2BA5E',
      500: '#C9A84C',   // Brand gold
      600: '#A88D3D',
    },
    // Semantic — Findings
    conforming: '#2D9E2D',   // Green — Conforming
    minorNC:    '#E67E22',   // Orange — Minor NC
    majorNC:    '#C0392B',   // Red — Major NC
    ofi:        '#2980B9',   // Blue — Opportunity for Improvement
    strongPoint:'#8E44AD',   // Purple — Strong Point
    warning:    '#E6A817',   // Amber — Warnings
    // Neutrals
    background: '#F4F7FB',
    surface:    '#FFFFFF',
    border:     '#D1D9E6',
    textPrimary:'#1A1D23',
    textSecondary:'#6B7280',
    textMuted:  '#9CA3AF',
  },
  
  typography: {
    fontFamily: {
      display: 'Montserrat',     // Headers, clause numbers, audit numbers
      body:    'Inter',          // Body text, labels, notes
      mono:    'JetBrains Mono', // Clause codes, NCR numbers, data
    },
    sizes: {
      xs:  '11px',
      sm:  '13px',
      md:  '15px',
      lg:  '17px',
      xl:  '20px',
      '2xl':'24px',
      '3xl':'30px',
      '4xl':'36px',
    },
    weights: {
      regular: '400',
      medium:  '500',
      semibold:'600',
      bold:    '700',
    }
  },
  
  spacing: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    '2xl':48,
    '3xl':64,
  },
  
  borderRadius: {
    sm:  4,
    md:  8,
    lg:  12,
    xl:  16,
    full: 9999,
  },
  
  shadows: {
    sm:   '0 1px 2px rgba(10, 38, 71, 0.06)',
    md:   '0 4px 6px rgba(10, 38, 71, 0.08)',
    lg:   '0 10px 15px rgba(10, 38, 71, 0.10)',
    card: '0 2px 8px rgba(10, 38, 71, 0.12)',
  }
};
```

---

## 15. Comprehensive Wiki Architecture

### Wiki Structure

```
Wiki/
├── 🏠 Getting Started
│   ├── Welcome to Soteria Assurance
│   ├── Your First Audit — Quick Start
│   ├── Understanding Audit Types
│   └── Platform Navigation Guide
│
├── 📘 ISO 45001:2018 Guide
│   ├── Overview & Intent of ISO 45001
│   ├── Clause 4: Context of the Organization
│   │   ├── 4.1 Understanding Context
│   │   ├── 4.2 Interested Parties
│   │   ├── 4.3 Scope Determination
│   │   └── 4.4 OH&S Management System
│   ├── Clause 5: Leadership
│   │   ├── 5.1 Leadership & Commitment
│   │   ├── 5.2 OH&S Policy
│   │   ├── 5.3 Roles & Responsibilities
│   │   └── 5.4 Worker Consultation
│   ├── Clause 6: Planning
│   │   ├── 6.1 Hazard Identification & Risk Assessment
│   │   ├── 6.1.2 HIRA Methodology Guide
│   │   ├── 6.1.3 Legal & Other Requirements
│   │   └── 6.2 OH&S Objectives
│   ├── Clause 7: Support
│   │   ├── 7.2 Competence Requirements
│   │   ├── 7.3 Awareness
│   │   ├── 7.4 Communication
│   │   └── 7.5 Documented Information Control
│   ├── Clause 8: Operation
│   │   ├── 8.1 Operational Planning & Control
│   │   ├── 8.1.2 Hierarchy of Controls
│   │   ├── 8.1.3 Management of Change
│   │   ├── 8.1.4.2 Contractor Management
│   │   └── 8.2 Emergency Preparedness
│   ├── Clause 9: Performance Evaluation
│   │   ├── 9.1 Monitoring & Measurement
│   │   ├── 9.2 Internal Audit Program
│   │   └── 9.3 Management Review
│   └── Clause 10: Improvement
│       ├── 10.2 Incident, NC & Corrective Action
│       └── 10.3 Continual Improvement
│
├── 🔍 Audit Methodology
│   ├── ISO 19011 Audit Principles
│   ├── Planning an ISO 45001 Audit
│   ├── Conducting Opening Meetings
│   ├── Document Review Techniques
│   ├── Interview Techniques for Auditors
│   ├── Physical Inspection Best Practices
│   ├── Evidence Collection Standards
│   ├── Conducting Closing Meetings
│   └── Remote/Virtual Audit Guidance
│
├── 📋 Finding Writing Guide
│   ├── Writing Major Nonconformities
│   ├── Writing Minor Nonconformities
│   ├── Writing OFIs vs Observations
│   ├── Writing Strong Points
│   ├── Objective Evidence Standards
│   ├── Avoiding Common Finding Errors
│   └── NCR Examples by Clause
│
├── ⚙️ Corrective Actions
│   ├── Root Cause Analysis Methods
│   ├── 5 Why Methodology
│   ├── Fishbone (Ishikawa) Diagram
│   ├── Writing Effective CAs
│   ├── Verifying Corrective Action Effectiveness
│   └── Managing CA Timelines
│
├── ⚖️ Legal References
│   ├── US OSHA 29 CFR 1910 & 1926 (Overview)
│   ├── International OH&S Legislation Guide
│   ├── ISO 45001 vs OSHA Alignment Map
│   └── Industry-Specific Regulations
│
├── 📊 Templates & Tools
│   ├── Audit Plan Templates
│   ├── Opening Meeting Agenda Template
│   ├── Closing Meeting Agenda Template
│   ├── Interview Question Banks by Clause
│   ├── Document Review Checklists
│   └── Site Inspection Checklists
│
└── 🛟 Platform Help
    ├── Conducting an Audit (Step-by-Step)
    ├── Using AI Co-Pilot
    ├── Evidence Photo Best Practices
    ├── Offline Mode Guide
    ├── Generating Audit Reports
    ├── Managing Corrective Actions
    └── Multi-Tenant Administration
```

---

## 16. Deployment Strategy

### Environments

| Environment | Firebase Project | Branch | URL |
|---|---|---|---|
| Development | soteria-assurance-dev | `develop` | dev.soteria-assurance.com |
| Staging | soteria-assurance-staging | `staging` | staging.soteria-assurance.com |
| Production | soteria-assurance-prod | `main` | app.soteria-assurance.com |

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (overview)
# Triggers:
#   - PR to develop → run tests + lint
#   - Merge to develop → deploy to dev
#   - Merge to staging → deploy to staging + E2E tests
#   - Merge to main → deploy to production (manual approval required)

# Jobs:
#   1. lint-and-type-check (TypeScript strict)
#   2. unit-tests (Jest)
#   3. build-web (Next.js)
#   4. build-mobile (Expo EAS Build)
#   5. deploy-firebase-functions
#   6. deploy-firestore-rules
#   7. e2e-tests (Playwright for web, Detox for mobile)
#   8. notify-slack
```

### Mobile App Distribution

- **iOS:** TestFlight (staging), App Store (production) via Expo EAS Submit
- **Android:** Internal Testing Track (staging), Google Play (production) via Expo EAS Submit
- **Web:** Vercel (Next.js) or Firebase Hosting

---

## 17. Roadmap & Phasing

### Phase 1 — MVP (Months 1-4): Core Audit Workflow
- [ ] Authentication + Multi-tenant setup
- [ ] Client/Organization management
- [ ] Audit creation and planning
- [ ] Clause-by-clause assessment (all 10 clauses, all sub-clauses)
- [ ] Finding creation (MNC, NC, OFI, SP)
- [ ] Photo evidence capture and upload
- [ ] Opening and closing meeting recording
- [ ] Basic audit report generation (PDF)
- [ ] Offline mode (WatermelonDB sync)
- [ ] AI Co-Pilot (NCR drafting, clause questions)

### Phase 2 — Enhanced Intelligence (Months 5-7)
- [ ] AI photo analysis for evidence
- [ ] Witness statement module
- [ ] Corrective action lifecycle tracking
- [ ] Advanced dashboard and analytics
- [ ] Comprehensive wiki (all ISO 45001 clauses)
- [ ] Audit template library
- [ ] Client portal (auditee access)
- [ ] Email notifications and reminders
- [ ] E-signature integration

### Phase 3 — Enterprise & Scale (Months 8-12)
- [ ] Multi-site audit management
- [ ] Auditor performance analytics
- [ ] Regulatory linkage database (US OSHA, EU, AU)
- [ ] API for third-party integrations (Zapier, REST)
- [ ] Multi-standard support (ISO 9001, ISO 14001)
- [ ] Certificate tracking and management
- [ ] Advanced AI features (predictive nonconformity detection)
- [ ] IoT sensor data integration (for monitoring evidence)
- [ ] SSO (SAML/OIDC) for enterprise tenants
- [ ] Dedicated iOS/Android App Store releases

### Phase 4 — Market Expansion (Year 2)
- [ ] ISO 14001:2015 (Environmental) audit support
- [ ] ISO 9001:2015 (Quality) audit support  
- [ ] Integrated OH&S training module (with Soteriq LMS)
- [ ] Certification body accreditation features
- [ ] Audit scheduling marketplace
- [ ] AI-powered gap analysis (pre-audit readiness scan)

---

## 18. Project File Structure

```
soteria-assurance/                  ← Root of monorepo
├── turbo.json                      ← Turborepo config
├── package.json                    ← Root workspace config
├── pnpm-workspace.yaml
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  ← CI pipeline
│   │   ├── deploy-dev.yml
│   │   ├── deploy-staging.yml
│   │   └── deploy-prod.yml
│   └── CODEOWNERS
│
├── packages/
│   ├── core/                       ← Shared business logic (TypeScript)
│   │   ├── src/
│   │   │   ├── types/              ← All TypeScript interfaces (from §8)
│   │   │   ├── constants/          ← ISO 45001 clause data, finding types
│   │   │   ├── utils/              ← Date helpers, validators
│   │   │   ├── hooks/              ← Shared React hooks
│   │   │   └── iso45001/           ← Standard clause definitions, requirements
│   │   └── package.json
│   │
│   ├── ui/                         ← Shared component library
│   │   ├── src/
│   │   │   ├── components/         ← Shared UI components
│   │   │   ├── tokens/             ← Design tokens (from §14)
│   │   │   └── icons/              ← Custom icon set
│   │   └── package.json
│   │
│   └── firebase/                   ← Shared Firebase config
│       ├── src/
│       │   ├── config.ts           ← Firebase initialization
│       │   ├── auth.ts             ← Auth helpers
│       │   └── firestore.ts        ← Firestore helpers
│       └── package.json
│
├── apps/
│   ├── mobile/                     ← React Native (Expo) app
│   │   ├── app/                    ← Expo Router (file-based routing)
│   │   │   ├── (auth)/             ← Login, register, forgot password
│   │   │   ├── (app)/              ← Main app (tab layout)
│   │   │   │   ├── dashboard/
│   │   │   │   ├── audits/
│   │   │   │   │   ├── index.tsx   ← Audit list
│   │   │   │   │   ├── [auditId]/
│   │   │   │   │   │   ├── index.tsx     ← Audit overview
│   │   │   │   │   │   ├── plan.tsx      ← Audit plan
│   │   │   │   │   │   ├── clauses/
│   │   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   │   └── [clauseId].tsx
│   │   │   │   │   │   ├── findings/
│   │   │   │   │   │   ├── evidence/
│   │   │   │   │   │   ├── meetings/
│   │   │   │   │   │   └── report.tsx
│   │   │   │   ├── clients/
│   │   │   │   ├── corrective-actions/
│   │   │   │   ├── wiki/
│   │   │   │   └── settings/
│   │   ├── components/             ← Mobile-specific components
│   │   │   ├── audit/
│   │   │   ├── evidence/
│   │   │   ├── findings/
│   │   │   ├── meetings/
│   │   │   └── ai/                 ← AI Co-Pilot components
│   │   ├── stores/                 ← Zustand stores
│   │   ├── db/                     ← WatermelonDB schema + models
│   │   ├── services/               ← API call services
│   │   ├── app.json                ← Expo app config
│   │   └── package.json
│   │
│   └── web/                        ← Next.js web app
│       ├── app/                    ← Next.js App Router
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   │   ├── audits/
│       │   │   ├── clients/
│       │   │   ├── corrective-actions/
│       │   │   ├── reports/
│       │   │   ├── wiki/
│       │   │   └── settings/
│       │   └── api/                ← Next.js API routes (proxy to Firebase)
│       ├── components/             ← Web-specific components
│       ├── lib/                    ← Utility libraries
│       ├── tailwind.config.ts
│       └── package.json
│
├── functions/                      ← Firebase Cloud Functions
│   ├── src/
│   │   ├── audit/
│   │   │   ├── onAuditCreate.ts
│   │   │   ├── onAuditComplete.ts
│   │   │   └── generateReport.ts
│   │   ├── ai/
│   │   │   ├── draftNCR.ts
│   │   │   ├── suggestQuestions.ts
│   │   │   ├── analyzeEvidence.ts
│   │   │   └── generateReportSection.ts
│   │   ├── notifications/
│   │   │   ├── emailService.ts
│   │   │   └── caReminders.ts
│   │   └── index.ts               ← Functions entry point
│   ├── .env.local                  ← ANTHROPIC_API_KEY (never commit)
│   └── package.json
│
├── firestore.rules                 ← Firestore security rules
├── firestore.indexes.json          ← Firestore composite indexes
├── storage.rules                   ← Firebase Storage rules
├── firebase.json                   ← Firebase project config
│
├── docs/                           ← Project documentation
│   ├── DESIGN_DOC.md               ← This document
│   ├── multi-agent-guide.md        ← Claude Code multi-agent guide
│   └── architecture/
│       ├── system-diagram.png
│       └── db-schema.png
│
└── README.md
```

---

*Document authored by Trainovate Technologies | Soteria Assurance v1.0.0 | ISO 45001:2018 Compliant Design*
