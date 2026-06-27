/**
 * Clause navigator (DESIGN_DOC §9.3) — the full ISO 45001 clause tree from
 * `@soteria/core/iso45001` (RULE 4, never hardcoded), each row joined with its
 * local assessment status (or `not_audited` when none exists). Tapping a clause
 * opens its assessment screen.
 */
import { useMemo } from 'react';
import { FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ConformityStatus } from '@soteria/core';
import { SoteriaStrings } from '@soteria/core';
import { flattenClauses } from '@soteria/core/iso45001';
import { Screen } from '../../../../../components/common/Screen';
import { LoadingState } from '../../../../../components/common/StateViews';
import { ClauseCard } from '../../../../../components/audit/ClauseCard';
import { useClauseAssessments } from '../../../../../lib/useLocalData';
import { useAuditStore } from '../../../../../stores/auditStore';

export default function ClauseNavigatorScreen(): JSX.Element {
  const router = useRouter();
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: assessments, loading } = useClauseAssessments(auditId);
  const setActiveClause = useAuditStore((s) => s.setActiveClause);

  // Index local assessments by clause number for O(1) status lookup.
  const statusByClause = useMemo(() => {
    const map = new Map<string, { status: ConformityStatus; complete: boolean }>();
    for (const a of assessments) {
      map.set(a.clauseNumber, { status: a.conformityStatus, complete: a.isComplete });
    }
    return map;
  }, [assessments]);

  const clauses = useMemo(() => flattenClauses(), []);

  if (loading) {
    return (
      <Screen name="clause-navigator">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="clause-navigator">
      <FlatList
        data={clauses}
        keyExtractor={(item): string => item.number}
        renderItem={({ item }): JSX.Element => {
          const local = statusByClause.get(item.number);
          return (
            <ClauseCard
              clause={item}
              status={local?.status ?? 'not_audited'}
              isComplete={local?.complete ?? false}
              onPress={(): void => {
                setActiveClause(item.number);
                router.push(`/(app)/audits/${auditId}/clauses/${item.number}`);
              }}
            />
          );
        }}
      />
    </Screen>
  );
}
