import type { Timestamp } from './common';

/**
 * A Soteria Assurance tenant (certification body, consultancy or enterprise).
 */
export interface Tenant {
  id: string;
  name: string;
  type: 'certification_body' | 'consultancy' | 'enterprise';
  /** Firebase Storage URL. */
  logo?: string;
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  maxAuditors: number;
  maxAuditsPerMonth: number;
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
