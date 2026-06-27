'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SoteriaStrings,
  CONFORMITY_STATUS_META,
  getClauseTree,
  type ConformityStatus,
  type ISO45001ClauseTreeNode,
} from '@soteria/core';
import { getConformityColor } from '@soteria/ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { useClauseAssessments } from '@/lib/hooks';

/** Renders a single clause node and its children recursively. */
function ClauseRow({
  node,
  statusByNumber,
  depth,
}: {
  node: ISO45001ClauseTreeNode;
  statusByNumber: ReadonlyMap<string, ConformityStatus>;
  depth: number;
}) {
  const status: ConformityStatus = statusByNumber.get(node.clause.number) ?? 'not_audited';
  const meta = CONFORMITY_STATUS_META[status];
  const color = getConformityColor(status);

  return (
    <>
      <div
        className="flex items-center justify-between border-b border-border py-2"
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
      </div>
      {node.children.map((child) => (
        <ClauseRow
          key={child.clause.number}
          node={child}
          statusByNumber={statusByNumber}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

function ClauseNavigator() {
  const params = useSearchParams();
  const auditId = params.get('id') ?? '';
  const assessmentsQuery = useClauseAssessments(auditId);

  // The ISO 45001 clause tree is canonical, static data (RULE 4 — never
  // hardcode clause text). Built once.
  const tree = useMemo(() => getClauseTree(), []);

  const statusByNumber = useMemo(() => {
    const map = new Map<string, ConformityStatus>();
    for (const a of assessmentsQuery.data ?? []) {
      map.set(a.clauseNumber, a.conformityStatus);
    }
    return map;
  }, [assessmentsQuery.data]);

  if (auditId === '') {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }
  if (assessmentsQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        {SoteriaStrings.clauses.navigatorTitle}
      </h1>
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
            />
          ))}
        </CardBody>
      </Card>
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
