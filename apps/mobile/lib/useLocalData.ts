/**
 * Reads from the offline database.
 *
 * These are the screens' only read path while in the field: WatermelonDB is
 * the source of truth on the device, and the sync manager reconciles it with
 * Postgres when a connection returns. Reading through Supabase here instead
 * would make every screen fail the moment a site has no signal, which is most
 * of them.
 *
 * Each hook subscribes to a live query, so a record changed by sync — or by
 * the auditor on another screen — re-renders the list without a refetch.
 */
import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import {
  database,
  type Audit,
  type ClauseAssessment,
  type Evidence as EvidenceModel,
  type Finding,
} from '../db';
import {
  TABLE_AUDITS,
  TABLE_CLAUSE_ASSESSMENTS,
  TABLE_EVIDENCE,
  TABLE_FINDINGS,
} from '../db/schema';

/** What every local query returns: current rows plus a first-load flag. */
export interface LocalQueryResult<T> {
  data: T;
  loading: boolean;
}

/** Every audit on the device, newest planned start first. */
export function useAudits(): LocalQueryResult<Audit[]> {
  const [data, setData] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = database
      .get<Audit>(TABLE_AUDITS)
      .query(Q.sortBy('planned_start_date', Q.desc))
      .observe()
      .subscribe((rows) => {
        setData(rows);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, []);

  return { data, loading };
}

/**
 * One audit by local id.
 *
 * Resolves to `null` rather than throwing when the id is unknown: a deep link
 * into an audit that has not synced to this device yet is an ordinary state,
 * not an error.
 */
export function useAudit(auditId: string): LocalQueryResult<Audit | null> {
  const [data, setData] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId === '') {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const subscription = database
      .get<Audit>(TABLE_AUDITS)
      .query(Q.where('id', auditId))
      .observe()
      .subscribe((rows) => {
        if (cancelled) return;
        setData(rows[0] ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [auditId]);

  return { data, loading };
}

/** Findings raised against one audit, newest first. */
export function useFindings(auditId: string): LocalQueryResult<Finding[]> {
  const [data, setData] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId === '') {
      setData([]);
      setLoading(false);
      return;
    }
    const subscription = database
      .get<Finding>(TABLE_FINDINGS)
      .query(Q.where('audit_id', auditId), Q.sortBy('local_created_at', Q.desc))
      .observe()
      .subscribe((rows) => {
        setData(rows);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, [auditId]);

  return { data, loading };
}

/** Every clause assessment recorded against one audit, in clause order. */
export function useClauseAssessments(auditId: string): LocalQueryResult<ClauseAssessment[]> {
  const [data, setData] = useState<ClauseAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId === '') {
      setData([]);
      setLoading(false);
      return;
    }
    const subscription = database
      .get<ClauseAssessment>(TABLE_CLAUSE_ASSESSMENTS)
      .query(Q.where('audit_id', auditId), Q.sortBy('clause_number', Q.asc))
      .observe()
      .subscribe((rows) => {
        setData(rows);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, [auditId]);

  return { data, loading };
}

/**
 * One clause's assessment within an audit.
 *
 * Resolves to `null` for a clause the auditor has not opened yet — which is
 * every clause at the start of an audit, so it is the normal case rather than
 * a missing record.
 */
export function useClauseAssessment(
  auditId: string,
  clauseNumber: string,
): LocalQueryResult<ClauseAssessment | null> {
  const [data, setData] = useState<ClauseAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId === '' || clauseNumber === '') {
      setData(null);
      setLoading(false);
      return;
    }
    const subscription = database
      .get<ClauseAssessment>(TABLE_CLAUSE_ASSESSMENTS)
      .query(Q.where('audit_id', auditId), Q.where('clause_number', clauseNumber))
      .observe()
      .subscribe((rows) => {
        setData(rows[0] ?? null);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, [auditId, clauseNumber]);

  return { data, loading };
}

/** Evidence captured during one audit, newest first. */
export function useEvidence(auditId: string): LocalQueryResult<EvidenceModel[]> {
  const [data, setData] = useState<EvidenceModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId === '') {
      setData([]);
      setLoading(false);
      return;
    }
    const subscription = database
      .get<EvidenceModel>(TABLE_EVIDENCE)
      .query(Q.where('audit_id', auditId), Q.sortBy('captured_at', Q.desc))
      .observe()
      .subscribe((rows) => {
        setData(rows);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, [auditId]);

  return { data, loading };
}
