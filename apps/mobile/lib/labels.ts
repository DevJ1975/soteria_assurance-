/**
 * Display labels and colours for audit enums.
 *
 * The enum values are storage tokens (`in_progress`), not prose. Mapping them
 * here rather than in each screen keeps one wording for a status across the
 * dashboard, the audit list and the report, and keeps colour tied to the
 * design tokens rather than to hexes scattered through StyleSheets.
 */
import type { AuditStatus, AuditType } from '@soteria/core';
import { colors } from '../theme';

const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  findings_review: 'Findings review',
  report_pending: 'Report pending',
  report_issued: 'Report issued',
  closed: 'Closed',
  canceled: 'Canceled',
};

const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  initial_certification: 'Initial certification',
  surveillance: 'Surveillance',
  recertification: 'Recertification',
  internal: 'Internal',
  special: 'Special',
};

/**
 * Status colour, chosen for what the status means to an auditor rather than
 * for variety: work in flight is primary, anything awaiting someone else is
 * amber, a finished audit is the conformity green, a cancelled one is muted.
 */
const AUDIT_STATUS_COLORS: Record<AuditStatus, string> = {
  planned: colors.textSecondary,
  in_progress: colors.primary[500],
  findings_review: colors.warning,
  report_pending: colors.warning,
  report_issued: colors.primary[600],
  closed: colors.conforming,
  canceled: colors.textMuted,
};

export function auditStatusLabel(status: AuditStatus): string {
  return AUDIT_STATUS_LABELS[status] ?? status;
}

export function auditTypeLabel(type: AuditType): string {
  return AUDIT_TYPE_LABELS[type] ?? type;
}

export function auditStatusColor(status: AuditStatus): string {
  return AUDIT_STATUS_COLORS[status] ?? colors.textSecondary;
}
