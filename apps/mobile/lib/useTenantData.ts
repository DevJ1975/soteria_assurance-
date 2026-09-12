/**
 * Reads that are not part of the offline audit record.
 *
 * Clients and corrective actions are back-office reference data: an auditor
 * browses them between site visits, they are not captured in the field, and
 * they are not in the local WatermelonDB schema. So unlike `useLocalData`
 * these go straight to Supabase through React Query — which also means they
 * surface a real error state when offline instead of silently showing nothing.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Client, CorrectiveAction } from '@soteria/core';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

/** The tenant of the signed-in auditor, or `''` before claims resolve. */
function useTenantId(): string {
  return useAuthStore((state) => state.claims?.tenantId ?? '');
}

/**
 * Client organizations for the current tenant.
 *
 * RLS scopes this to the caller's tenant regardless, but the query stays
 * disabled until the tenant is known so no unscoped read is ever issued.
 */
export function useClients(): UseQueryResult<Client[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['clients', tenantId],
    enabled: tenantId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, tenant_id, organization_name, industry, certification_status, contact_name, contact_email')
        .eq('tenant_id', tenantId)
        .order('organization_name');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        organizationName: row.organization_name,
        industry: row.industry,
        certificationStatus: row.certification_status,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
      })) as unknown as Client[];
    },
  });
}

/** Corrective actions for the current tenant, soonest due first. */
export function useCorrectiveActions(): UseQueryResult<CorrectiveAction[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['corrective-actions', tenantId],
    enabled: tenantId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corrective_actions')
        .select('id, tenant_id, audit_id, finding_id, ca_number, title, status, target_date, responsible_person_name')
        .eq('tenant_id', tenantId)
        .order('target_date');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        auditId: row.audit_id,
        findingId: row.finding_id,
        caNumber: row.ca_number,
        title: row.title,
        status: row.status,
        targetDate: row.target_date,
        responsiblePersonName: row.responsible_person_name,
      })) as unknown as CorrectiveAction[];
    },
  });
}
