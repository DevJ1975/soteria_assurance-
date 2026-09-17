'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { StandardId } from '@soteria/core';
import { Button } from '@/components/ui/Button';
import { callSearchClauses, type ClauseMatch } from '@/lib/supabase-functions';

/**
 * Finds clauses by meaning, for the auditor who has seen something and does not
 * yet know which requirement it bears on.
 *
 * This sits alongside the wiki's substring filter rather than replacing it.
 * They answer different questions: the filter is for "show me 6.1.2" and is
 * instant and free, this is for "contractor inductions stopped being recorded"
 * and costs a round trip. Making one of them do both jobs would make it worse
 * at each.
 */
export function ClauseSemanticSearch({
  standardId,
  onSelect,
}: {
  standardId: StandardId;
  onSelect: (clauseNumber: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ClauseMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed === '') return;
    setError(null);
    setLoading(true);
    try {
      const result = await callSearchClauses({ query: trimmed, standardId });
      setMatches(result.matches);
    } catch {
      setError('The clause search is unavailable. The wiki filter still works.');
      setMatches(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <form onSubmit={(event) => void search(event)} className="flex flex-col gap-sm">
        <textarea
          id="clause-semantic-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          placeholder="Describe what you observed — e.g. “contractor induction records stop after 2024”"
          className="w-full rounded-md border border-border bg-surface px-sm py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
        <Button type="submit" loading={loading} disabled={query.trim() === ''} variant="secondary">
          <Sparkles className="h-4 w-4" aria-hidden />
          Find relevant clauses
        </Button>
      </form>

      {loading ? (
        <p className="inline-flex items-center gap-sm px-sm py-md text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Searching the clause corpus…
        </p>
      ) : null}

      {error !== null ? <p className="px-sm text-sm text-major-nc">{error}</p> : null}

      {/* An empty result is a real answer, not a failure — saying so beats
          showing the four least-irrelevant clauses as if they were relevant. */}
      {matches !== null && matches.length === 0 && !loading ? (
        <p className="px-sm py-md text-sm text-text-secondary">
          Nothing in {standardId === 'iso45001' ? 'ISO 45001' : standardId} is a close enough match.
          Try describing the observation differently, or use the filter tab.
        </p>
      ) : null}

      {matches !== null && matches.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {matches.map((match) => (
            <li key={match.clause_number}>
              <button
                onClick={() => onSelect(match.clause_number)}
                className="flex w-full flex-col gap-0.5 rounded px-sm py-2 text-left transition-colors hover:bg-background"
              >
                <span className="flex items-baseline gap-sm">
                  <span className="font-mono text-xs font-semibold text-primary-700">
                    {match.clause_number}
                  </span>
                  <span className="truncate text-sm text-text-primary">{match.clause_title}</span>
                </span>
                {/* The score is shown because these results are ranked, not
                    exact: an auditor should be able to see that the third hit
                    is a long way behind the first. */}
                <span className="text-xs text-text-muted">
                  {Math.round(match.similarity * 100)}% match
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
