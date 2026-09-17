/**
 * Renders an audit report to PDF, stores it in the private `reports` bucket,
 * and records the generation in `public.reports`.
 *
 * Runs server-side for the same reason every write-triggering function in
 * this project does: it needs the service-role client to write the metadata
 * row and storage object on the caller's behalf, after verifying the caller
 * may act on this tenant at all.
 */
import { HttpError, handleRequest, jsonResponse, requireCaller, serviceClient } from '../_shared/auth.ts';
import { renderReportPdf, type AuditReportData } from './pdfRenderer.ts';

// Same set of roles that can read/manage audit data day to day. A `viewer` or
// `auditee` (the organization being audited) can read what they're scoped to,
// but must not be able to mint the official report themselves.
const ALLOWED_ROLES = new Set(['super_admin', 'tenant_admin', 'lead_auditor', 'auditor']);

interface GenerateReportPdfRequest {
  tenantId?: unknown;
  auditId?: unknown;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `"${field}" is required.`);
  }
  return value.trim();
}

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const caller = await requireCaller(request);
    if (!ALLOWED_ROLES.has(caller.role)) {
      throw new HttpError(403, 'You do not have permission to generate audit reports.');
    }
    const body = (await request.json().catch(() => ({}))) as GenerateReportPdfRequest;

    const auditId = requireString(body.auditId, 'auditId');
    // The tenant in the body is never trusted for anyone but a superadmin —
    // same rule every other function in this project follows.
    const isSuperAdmin = caller.role === 'super_admin';
    const tenantId = isSuperAdmin ? requireString(body.tenantId, 'tenantId') : caller.tenantId;

    const admin = serviceClient();

    const { data: audit, error: auditError } = await admin
      .from('audits')
      .select(
        'id, audit_number, standard_id, client_id, scope, status, findings, audit_type, '
          + 'audit_stage, planned_start_date, planned_end_date, actual_start_date, '
          + 'actual_end_date, audit_days, lead_auditor_id, audit_team, '
          + 'management_representative_name, confidentiality, report_issued_at',
      )
      .eq('id', auditId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (auditError) {
      console.error(auditError);
      throw new HttpError(500, 'Could not load the audit.');
    }
    if (!audit) throw new HttpError(404, 'That audit does not exist.');

    let client: AuditReportData['client'] = null;
    if (audit.client_id) {
      const { data: clientRow, error: clientError } = await admin
        .from('clients')
        .select('organization_name, industry, address, contact_name, sites')
        .eq('id', audit.client_id)
        .maybeSingle();
      if (clientError) console.error(clientError);
      client = clientRow
        ? {
            organizationName: clientRow.organization_name,
            industry: clientRow.industry ?? '',
            address: clientRow.address ?? null,
            contactName: clientRow.contact_name ?? '',
            sites: Array.isArray(clientRow.sites) ? clientRow.sites : [],
          }
        : null;
    }

    // The lead auditor's NAME, not their uuid: the report identifies the audit
    // team (ISO 19011 6.5.1 e) and a uuid identifies nobody.
    let leadAuditorName = '';
    if (audit.lead_auditor_id) {
      const { data: leadRow } = await admin
        .from('profiles')
        .select('display_name, email')
        .eq('id', audit.lead_auditor_id)
        .maybeSingle();
      leadAuditorName = leadRow?.display_name || leadRow?.email || '';
    }

    const [
      { data: findings, error: findingsError },
      { data: clauses, error: clausesError },
      { data: correctiveActions, error: correctiveActionsError },
    ] = await Promise.all([
      admin
        .from('findings')
        .select(
          'finding_number, clause_number, clause_title, title, type, status, severity, '
            + 'requirement, objective_evidence, nonconformity_statement, '
            + 'raised_by_auditor_name, raised_at, target_closure_date',
        )
        .eq('tenant_id', tenantId)
        .eq('audit_id', auditId)
        // By finding number, which sorts MNC- then NC- then OFI- then SP- —
        // worst first, the order an audit report is read in. Ordering by
        // clause_number sorted it as a STRING, putting 10.2 before 5.4.
        .order('finding_number'),
      admin
        .from('clause_assessments')
        .select('clause_number, clause_title, conformity_status, score')
        .eq('tenant_id', tenantId)
        .eq('audit_id', auditId)
        .order('clause_number'),
      admin
        .from('corrective_actions')
        .select('ca_number, title, status, target_date')
        .eq('tenant_id', tenantId)
        .eq('audit_id', auditId)
        .order('target_date'),
    ]);
    // A failed query here must not silently render a report with an emptied
    // section — that would look indistinguishable from a clean audit.
    if (findingsError || clausesError || correctiveActionsError) {
      console.error(findingsError, clausesError, correctiveActionsError);
      throw new HttpError(500, "Could not load the audit's findings, clauses, or corrective actions.");
    }

    // audits.findings is a denormalized summary nothing ever recomputes after
    // the audit is created — it is permanently all-zero the moment a real
    // finding is raised. Computed live from the findings this function
    // already fetched instead, so the summary block above the findings table
    // can never disagree with the table itself.
    const findingRows = findings ?? [];
    const findingsSummary = {
      totalFindings: findingRows.length,
      majorNCs: findingRows.filter((f) => f.type === 'major_nc').length,
      minorNCs: findingRows.filter((f) => f.type === 'minor_nc').length,
      ofis: findingRows.filter((f) => f.type === 'ofi').length,
      strongPoints: findingRows.filter((f) => f.type === 'strong_point').length,
      observations: findingRows.filter((f) => f.type === 'observation').length,
      closedNCs: findingRows.filter((f) => f.status === 'closed').length,
      openNCs: findingRows.filter((f) => f.status !== 'closed').length,
    };

    const reportData: AuditReportData = {
      audit: {
        auditNumber: audit.audit_number,
        standardId: audit.standard_id,
        scope: audit.scope ?? '',
        status: audit.status,
        auditType: audit.audit_type ?? '',
        auditStage: audit.audit_stage ?? '',
        plannedStartDate: audit.planned_start_date ?? '',
        plannedEndDate: audit.planned_end_date ?? '',
        actualStartDate: audit.actual_start_date ?? null,
        actualEndDate: audit.actual_end_date ?? null,
        auditDays: Number(audit.audit_days ?? 0),
        leadAuditorName,
        auditTeam: Array.isArray(audit.audit_team)
          ? (audit.audit_team as Array<Record<string, unknown>>).map((member) => ({
              displayName: String(member.displayName ?? member.display_name ?? 'Unknown'),
              role: String(member.role ?? ''),
            }))
          : [],
        managementRepresentativeName: audit.management_representative_name ?? '',
        confidentiality: audit.confidentiality ?? 'standard',
        reportIssuedAt: audit.report_issued_at ?? null,
        findings: findingsSummary,
      },
      client,
      findings: (findings ?? []).map((f) => ({
        findingNumber: f.finding_number,
        clauseNumber: f.clause_number,
        clauseTitle: f.clause_title ?? '',
        title: f.title,
        type: f.type,
        status: f.status,
        severity: f.severity ?? null,
        requirement: f.requirement ?? '',
        objectiveEvidence: f.objective_evidence ?? '',
        nonconformityStatement: f.nonconformity_statement ?? '',
        raisedByAuditorName: f.raised_by_auditor_name ?? '',
        raisedAt: f.raised_at ?? '',
        targetClosureDate: f.target_closure_date ?? null,
      })),
      clauseAssessments: (clauses ?? []).map((c) => ({
        clauseNumber: c.clause_number,
        clauseTitle: c.clause_title,
        conformityStatus: c.conformity_status,
        score: Number(c.score ?? 0),
      })),
      correctiveActions: (correctiveActions ?? []).map((ca) => ({
        caNumber: ca.ca_number,
        title: ca.title,
        status: ca.status,
        targetDate: ca.target_date,
      })),
      generatedAt: new Date().toISOString(),
    };

    const pdfBytes = await renderReportPdf(reportData);

    // Tenant id first path segment, matching every other private bucket's
    // policy convention (storage.foldername(name))[1] = current_tenant_id().
    // The audit number is deliberately not in the path — it can be
    // guessable/sequential, and the path is otherwise opaque.
    const storagePath = `${tenantId}/${auditId}-${Date.now()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from('reports')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error(uploadError);
      throw new HttpError(500, 'Could not store the generated report.');
    }

    const { data: reportRow, error: reportError } = await admin
      .from('reports')
      .insert({
        tenant_id: tenantId,
        audit_id: auditId,
        audit_number: audit.audit_number,
        format: 'pdf',
        storage_path: storagePath,
        size_bytes: pdfBytes.byteLength,
        generated_by: caller.userId,
      })
      .select('id')
      .single();
    if (reportError || !reportRow) {
      // The PDF is already stored and usable even if this metadata insert
      // failed; report the storage path regardless rather than losing work
      // the caller can still download.
      console.error(reportError);
    }

    return jsonResponse({
      storagePath,
      reportId: reportRow?.id ?? null,
      size: pdfBytes.byteLength,
      generatedAt: reportData.generatedAt,
    });
  }),
);
