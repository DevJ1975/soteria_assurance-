import type { Timestamp, GeoCoordinates } from './common';

/**
 * A client organization being audited by the tenant.
 */
export interface Client {
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
  /** Array of auditId references. */
  auditHistory: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClientAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  coordinates?: GeoCoordinates;
}

export interface ClientSite {
  siteId: string;
  siteName: string;
  address: ClientAddress;
  siteContactName: string;
  siteContactEmail: string;
  numberOfWorkers: number;
  hazardCategory: 'low' | 'medium' | 'high' | 'very_high';
}

export type CertificationStatus = Client['certificationStatus'];
export type HazardCategory = ClientSite['hazardCategory'];
