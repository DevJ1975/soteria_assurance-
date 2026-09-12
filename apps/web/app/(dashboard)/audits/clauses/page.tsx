'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SoteriaStrings,
  CONFORMITY_STATUS_META,
  DEFAULT_STANDARD_ID,
  getClauseTree,
  getStandard,
  type ClauseAssessment,
  type ConformityStatus,
  type StandardClauseTreeNode,
} from '@soteria/core';
import { getConformityColor } from '@soteria/ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { ClauseAssessmentEditor } from '@/components/ClauseAssessmentEditor';
import { useAudit, useClauseAssessments } from '@/lib/hooks';

/** Renders a single clause node and its children recursively. */
function ClauseRow({
  node,
  statusByNumber,
  depth,
  selectedClauseNumber,
  onSelect,
}: {
  node: StandardClauseTreeNode;
  statusByNumber: ReadonlyMap<string, ConformityStatus>;
  depth: number;
  selectedClauseNumber: string;
  onSelect: (clauseNumber: string) => void;
}) {
  const status: ConformityStatus = statusByNumber.get(node.clause.number) ?? 'not_audited';
  const meta = CONFORMITY_STATUS_META[status];
  const color = getConformityColor(status);
  const isSelected = selectedClauseNumber === node.clause.number;

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.clause.number)}
        aria-current={isSelected ? 'true' : undefined}
        className={`flex w-full items-center justify-between border-b border-border py-2 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus ${
          isSelected ? 'bg-background' : ''
        }`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <span className="flex items-baseline gap-sm">
          <span className="font-mono text-sm font-semibold text-primary-700">
            {node.clause.number}
          </span>
          <span className="text-sm text-text-primary">{node.clause.title}</span>
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-sm py-0.5 text-xs font-semibold"
          style={{ color, backgroundColor: `${color}1A`, borderColor: `${color}4D` }}
        >
          {meta.label}
        </span>
      </button>
      {node.children.map((child) => (
        <ClauseRow
          key={child.clause.number}
          node={child}
          statusByNumber={statusByNumber}
          depth={depth + 1}
          selectedClauseNumber={selectedClauseNumber}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function ClauseNavigator() {
  const params = useSearchParams();
  const auditId = params.get('id') ?? '';
  const auditQuery = useAudit(auditId);
  const assessmentsQuery = useClauseAssessments(auditId);
  // The clause tree belongs to the audit's standard, not to the app: "6.1.2"
  // exists in every Annex SL standard and means something different in each.
  const standardId = auditQuery.data?.standardId ?? DEFAULT_STANDARD_ID;
  const [selectedClauseNumber, setSelectedClauseNumber] = useState('');

  // The ISO 45001 clause tree is canonical, static data (RULE 4 — never
  // hardcode clause text). Built once.
  const tree = useMemo(() => getClauseTree(standardId), [standardId]);

  const assessmentByNumber = useMemo(() => {
    const map = new Map<string, ClauseAssessment>();
    for (const a of assessmentsQuery.data ?? []) {
      map.set(a.clauseNumber, a);
    }
    return map;
  }, [assessmentsQuery.data]);

  const statusByNumber = useMemo(() => {
    const map = new Map<string, ConformityStatus>();
    for (const [clauseNumber, assessment] of assessmentByNumber) {
      map.set(clauseNumber, assessment.conformityStatus);
    }
    return map;
  }, [assessmentByNumber]);

  if (auditId === '') {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }
  if (assessmentsQuery.isLoading) {
    return <LoadingState />;
  }
  if (assessmentsQuery.isError) {
    return <ErrorState />;
  }

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
        {SoteriaStrings.clauses.navigatorTitle}
      </h1>
      <div className="grid gap-lg lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ISO 45001:2018</CardTitle>
          </CardHeader>
          <CardBody>
            {tree.map((node) => (
              <ClauseRow
                key={node.clause.number}
                node={node}
                statusByNumber={statusByNumber}
                depth={0}
                selectedClauseNumber={selectedClauseNumber}
                onSelect={setSelectedClauseNumber}
              />
            ))}
          </CardBody>
        </Card>
        {selectedClauseNumber === '' ? (
          <EmptyState message="Select a clause to record its assessment." />
        ) : (
          <ClauseAssessmentEditor
            key={selectedClauseNumber}
            auditId={auditId}
            standardId={standardId}
            clauseNumber={selectedClauseNumber}
            assessment={assessmentByNumber.get(selectedClauseNumber)}
          />
        )}
      </div>
    </div>
  );
}

export default function ClausesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ClauseNavigator />
    </Suspense>
  );
}
