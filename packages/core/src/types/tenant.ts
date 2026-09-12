import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

/**
 * A Soteria Assurance tenant (certification body, consultancy or enterprise).
 */
export interface Tenant {
  id: string;
  name: string;
  type: 'certification_body' | 'consultancy' | 'enterprise';
  /** Storage object path or signed URL. */
  logo?: string;
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  maxAuditors: number;
  maxAuditsPerMonth: number;
  /**
   * Standards this tenant may run audits against. A standard listed here is
   * still only selectable if it is `isAvailable` in the standards registry —
   * entitlement and readiness are separate gates.
   */
  enabledStandards: StandardId[];
  settings: TenantSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TenantSettings {
  timezone: string;
  defaultLanguage: string;
  requireEvidencePerFinding: boolean;
  requireWitnessStatement: boolean;
  autoGenerateNCRNumbers: boolean;
  /** e.g. "NCR-2026-". */
  ncrPrefix: string;
  reportTemplate: 'standard' | 'minimal' | 'comprehensive';
  brandingColor?: string;
  brandingLogo?: string;
}

export type TenantType = Tenant['type'];
export type SubscriptionTier = Tenant['subscriptionTier'];
export type SubscriptionStatus = Tenant['subscriptionStatus'];
