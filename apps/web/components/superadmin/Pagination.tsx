import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/shadcn';

/**
 * Offset pagination for the console tables.
 *
 * These lists are paged rather than fetched whole because PostgREST caps a
 * response at `max_rows` (1000): an unbounded select would silently truncate
 * and the table would look complete when it was not. The total comes from the
 * request's exact count, so "showing N of M" is always honest.
 */
export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const atStart = offset === 0;
  const atEnd = to >= total;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border-soft px-6 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={atStart}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={atEnd} onClick={() => onChange(offset + limit)}>
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
