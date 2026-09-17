'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Search } from 'lucide-react';
import { listAvailableStandards } from '@soteria/core';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn';
import { Badge } from '@/components/ui/Badge';
import { callIndexClauses } from '@/lib/supabase-functions';
import { createClient } from '@/utils/supabase/client';

interface IndexRow {
  standardId: string;
  clauses: number;
  updatedAt: string | null;
}

/**
 * Platform services the superadmin actually has to operate.
 *
 * Right now that is the clause vector index, which is derived data: it is built
 * from the clause dataset in @soteria/core, so an edit there is invisible to
 * semantic search until it is rebuilt. That makes "when was this last built,
 * and against how many clauses" an operational question someone needs an answer
 * to, rather than something to infer from whether search results look right.
 */
export function PlatformPanel() {
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A rebuild is a series of batched round trips, not one call — without this
  // the button sits there for several seconds looking hung.
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: readError } = await createClient()
      .from('clause_embeddings')
      .select('standard_id, updated_at');
    if (readError) {
      setError(readError.message);
      return;
    }
    const byStandard = new Map<string, IndexRow>();
    for (const row of data ?? []) {
      const id = row.standard_id as string;
      const existing = byStandard.get(id);
      const updatedAt = row.updated_at as string | null;
      byStandard.set(id, {
        standardId: id,
        clauses: (existing?.clauses ?? 0) + 1,
        // The newest stamp across the standard's rows: a rebuild writes them
        // all in one upsert, so this is when that rebuild ran.
        updatedAt:
          existing?.updatedAt == null || (updatedAt != null && updatedAt > existing.updatedAt)
            ? updatedAt
            : existing.updatedAt,
      });
    }
    setRows([...byStandard.values()].sort((a, b) => a.standardId.localeCompare(b.standardId)));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function rebuild() {
    setRunning(true);
    setError(null);
    setMessage(null);
    setProgress(null);
    try {
      const result = await callIndexClauses({}, ({ standardId, done, total }) => {
        setProgress(`${standardId}: ${done} of ${total} clauses`);
      });
      const total = Object.values(result.indexed).reduce((sum, n) => sum + n, 0);
      setMessage(
        `Indexed ${total} clause${total === 1 ? '' : 's'} with ${result.model} (${result.dimensions} dimensions).`,
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The rebuild failed.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  // Roadmap standards have no clause data, so an empty index for them is
  // correct rather than something to flag.
  const available = listAvailableStandards();
  const missing = available.filter(
    (standard) => !rows.some((row) => row.standardId === standard.id && row.clauses > 0),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Search className="size-4" aria-hidden />
          Clause search index
        </CardTitle>
        <CardDescription>
          Powers “Describe it” in the wiki. Built from the clause dataset in{' '}
          <code className="font-mono text-xs">@soteria/core</code> using Supabase&apos;s built-in
          <code className="font-mono text-xs"> gte-small</code> model — no external AI provider and
          no per-query cost. Rebuild after the clause data changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {available.map((standard) => {
            const row = rows.find((r) => r.standardId === standard.id);
            return (
              <div
                key={standard.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Database className="size-4 text-text-muted" aria-hidden />
                  <span className="font-medium text-text-primary">{standard.name}</span>
                </span>
                <span className="inline-flex items-center gap-3 text-xs text-text-muted">
                  {row && row.clauses > 0 ? (
                    <>
                      <Badge tone="conforming">{row.clauses} clauses</Badge>
                      <span>
                        {row.updatedAt
                          ? `built ${new Date(row.updatedAt).toLocaleString()}`
                          : 'built'}
                      </span>
                    </>
                  ) : (
                    <Badge tone="warning">Not indexed</Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {missing.length > 0 ? (
          <Alert>
            <AlertDescription>
              {missing.map((s) => s.shortName).join(', ')} {missing.length === 1 ? 'has' : 'have'} no
              search index yet, so “Describe it” returns nothing for{' '}
              {missing.length === 1 ? 'it' : 'them'}. Rebuild to populate.
            </AlertDescription>
          </Alert>
        ) : null}

        {message !== null ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {error !== null ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button onClick={() => void rebuild()} disabled={running}>
            <RefreshCw className={running ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
            {running ? 'Rebuilding…' : 'Rebuild index'}
          </Button>
          {progress !== null ? (
            <span className="text-xs text-text-muted" aria-live="polite">
              {progress}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
