'use client';

import { useMemo, useState } from 'react';
import {
  flattenClauses,
  getClauseByNumber,
  getRelatedClauses,
  type ISO45001Clause,
} from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

/**
 * ISO 45001:2018 wiki. All clause guidance comes from `@soteria/core`'s
 * canonical, IP-safe dataset (RULE 4 — clause text is never hardcoded here).
 */
export default function WikiPage() {
  const allClauses = useMemo(() => flattenClauses(), []);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string>(allClauses[0]?.number ?? '4');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q === '') {
      return allClauses;
    }
    return allClauses.filter(
      (c) => c.number.includes(q) || c.title.toLowerCase().includes(q),
    );
  }, [allClauses, filter]);

  const clause: ISO45001Clause | undefined = getClauseByNumber(selected);
  const related = clause ? getRelatedClauses(clause.number) : [];

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold text-text-primary">ISO 45001:2018 Wiki</h1>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[20rem_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto">
          <CardBody className="flex flex-col gap-sm">
            <Input
              id="wiki-filter"
              placeholder="Filter clauses…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ul className="flex flex-col">
              {filtered.map((c) => (
                <li key={c.number}>
                  <button
                    onClick={() => setSelected(c.number)}
                    className={`flex w-full items-baseline gap-sm rounded px-sm py-1 text-left text-sm transition-colors ${
                      c.number === selected
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-background'
                    }`}
                    style={{ paddingLeft: `${(c.level - 1) * 12 + 8}px` }}
                  >
                    <span className="font-mono text-xs font-semibold">{c.number}</span>
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          {clause ? (
            <>
              <CardHeader>
                <CardTitle>
                  <span className="font-mono text-primary-700">{clause.number}</span> {clause.title}
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-md text-sm">
                <section>
                  <h3 className="mb-1 font-display font-semibold text-text-primary">Requirement</h3>
                  <p className="text-text-secondary">{clause.requirementText}</p>
                </section>

                <WikiList title="Audit focus" items={clause.auditFocus} />
                <WikiList title="Typical audit questions" items={clause.typicalAuditQuestions} />
                <WikiList title="Common nonconformities" items={clause.commonNonconformities} />
                <WikiList title="Expected documents" items={clause.expectedDocuments} />

                {related.length > 0 ? (
                  <section>
                    <h3 className="mb-1 font-display font-semibold text-text-primary">
                      Related clauses
                    </h3>
                    <div className="flex flex-wrap gap-sm">
                      {related.map((r) => (
                        <button key={r.number} onClick={() => setSelected(r.number)}>
                          <Badge tone="primary">{r.number}</Badge>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </CardBody>
            </>
          ) : (
            <CardBody>
              <p className="text-sm text-text-secondary">Select a clause to view guidance.</p>
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}

function WikiList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section>
      <h3 className="mb-1 font-display font-semibold text-text-primary">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-text-secondary">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
