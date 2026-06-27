'use client';

import { useState } from 'react';
import { Sparkles, X, AlertTriangle } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { callSuggestQuestions } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

export interface AICopilotPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in AI co-pilot (ARIA). Calls the `suggestQuestions` Cloud Function via
 * the typed callable wrapper (no server actions — static export). Every result
 * carries the mandatory AI disclaimer (RULE: AI content must be reviewed).
 */
export function AICopilotPanel({ open, onClose }: AICopilotPanelProps) {
  const { claims } = useAuth();
  const [clauseNumber, setClauseNumber] = useState('6.1.2');
  const [clauseTitle, setClauseTitle] = useState('Hazard identification and assessment');
  const [intervieweeRole, setIntervieweeRole] = useState('Safety Officer');
  const [context, setContext] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = claims?.tenantId ?? '';

  async function handleSuggest() {
    if (tenantId === '') {
      setError(SoteriaStrings.errors.permissionDenied);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await callSuggestQuestions({
        tenantId,
        clauseNumber,
        clauseTitle,
        intervieweeRole,
        organizationContext: context,
      });
      setQuestions(result.questions);
    } catch {
      setError(SoteriaStrings.ai.unavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-primary-900/30"
          onClick={onClose}
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-lg transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label={SoteriaStrings.ai.copilotTitle}
        aria-hidden={!open}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-lg">
          <span className="inline-flex items-center gap-sm font-display text-lg font-semibold text-text-primary">
            <Sparkles className="h-5 w-5 text-gold-500" aria-hidden />
            {SoteriaStrings.ai.copilotTitle}
          </span>
          <button
            onClick={onClose}
            aria-label={SoteriaStrings.common.close}
            className="rounded-md p-1 text-text-secondary hover:bg-background"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-md overflow-y-auto px-lg py-md">
          <div className="rounded-md border border-warning/30 bg-warning/10 px-md py-2 text-xs text-warning">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {SoteriaStrings.ai.disclaimer}
            </span>
          </div>

          <Input
            id="copilot-clause-number"
            label={SoteriaStrings.findings.clauseLabel}
            value={clauseNumber}
            onChange={(e) => setClauseNumber(e.target.value)}
          />
          <Input
            id="copilot-clause-title"
            label="Clause title"
            value={clauseTitle}
            onChange={(e) => setClauseTitle(e.target.value)}
          />
          <Input
            id="copilot-interviewee"
            label="Interviewee role"
            value={intervieweeRole}
            onChange={(e) => setIntervieweeRole(e.target.value)}
          />
          <Input
            id="copilot-context"
            label="Organization context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={SoteriaStrings.ai.askPlaceholder}
          />

          <Button onClick={() => void handleSuggest()} loading={loading}>
            {SoteriaStrings.ai.suggestQuestions}
          </Button>

          {error ? <p className="text-sm text-major-nc">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-text-secondary">{SoteriaStrings.ai.generating}</p>
          ) : null}

          {questions.length > 0 ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-text-primary">
              {questions.map((q, idx) => (
                <li key={idx}>{q}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </aside>
    </>
  );
}
