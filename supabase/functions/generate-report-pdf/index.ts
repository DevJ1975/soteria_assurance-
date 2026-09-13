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
    const body = (await request.json().catch(() => ({}))) as GenerateReportPdfRequest;

    const auditId = requireString(body.auditId, 'auditId');
    // The tenant in the body is never trusted for anyone but a superadmin —
    // same rule every other function in this project follows.
    const isSuperAdmin = caller.role === 'super_admin';
    const tenantId = isSuperAdmin ? requireString(body.tenantId, 'tenantId') : caller.tenantId;

    const admin = serviceClient();

    const { data: audit, error: auditError } = await admin
      .from('audits')
      .select('id, audit_number, standard_id, client_id, scope, status, findings')
      .eq('id', auditId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (auditError) throw new HttpError(500, 'Could not load the audit.');
    if (!audit) throw new HttpError(404, 'That audit does not exist.');

    let client: { organizationName: string } | null = null;
    if (audit.client_id) {
      const { data: clientRow } = await admin
        .from('clients')
        .select('organization_name')
        .eq('id', audit.client_id)
        .maybeSingle();
      client = clientRow ? { organizationName: clientRow.organization_name } : null;
    }

    const [{ data: findings }, { data: clauses }, { data: correctiveActions }] = await Promise.all([
      admin
        .from('findings')
        .select('finding_number, clause_number, title, type, status')
        .eq('tenant_id', tenantId)
        .eq('audit_id', auditId)
        .order('clause_number'),
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

    const reportData: AuditReportData = {
      audit: {
        auditNumber: audit.audit_number,
        standardId: audit.standard_id,
        scope: audit.scope ?? '',
        status: audit.status,
        // audits.findings is the same jsonb summary the dashboard reads; a
        // row created without one defaults to '{}', so every field is
        // defaulted here rather than trusting the shape.
        findings: {
          totalFindings: audit.findings?.totalFindings ?? 0,
          majorNCs: audit.findings?.majorNCs ?? 0,
          minorNCs: audit.findings?.minorNCs ?? 0,
          ofis: audit.findings?.ofis ?? 0,
          strongPoints: audit.findings?.strongPoints ?? 0,
          observations: audit.findings?.observations ?? 0,
          closedNCs: audit.findings?.closedNCs ?? 0,
          openNCs: audit.findings?.openNCs ?? 0,
        },
      },
      client,
      findings: (findings ?? []).map((f) => ({
        findingNumber: f.finding_number,
        clauseNumber: f.clause_number,
        title: f.title,
        type: f.type,
        status: f.status,
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
