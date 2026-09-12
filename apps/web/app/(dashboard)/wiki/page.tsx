'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STANDARD_ID,
  flattenClauses,
  getClauseByNumber,
  getRelatedClauses,
  getStandard,
  listStandards,
  type StandardClause,
  type StandardId,
} from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';

/**
 * Clause wiki for any management-system standard the platform knows about.
 *
 * All clause guidance comes from `@soteria/core`'s canonical, IP-safe datasets
 * (RULE 4 — clause text is never hardcoded here). Roadmap standards are listed
 * in the picker rather than hidden, so the product tells you what is coming;
 * selecting one lands on a "not authored yet" panel instead of an empty list
 * that reads like a bug.
 */
const STANDARDS = listStandards();

export default function WikiPage() {
  const [standardId, setStandardId] = useState<StandardId>(DEFAULT_STANDARD_ID);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState('');

  const standard = getStandard(standardId);
  const allClauses = useMemo(() => flattenClauses(standardId), [standardId]);

  // Clause numbers are only unique within a standard, so a selection made in
  // one is meaningless in another. Reset to that standard's first clause.
  useEffect(() => {
    setSelected(allClauses[0]?.number ?? '');
    setFilter('');
  }, [allClauses]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (query === '') return allClauses;
    return allClauses.filter(
      (clause) =>
        clause.number.includes(query) ||
        clause.title.toLowerCase().includes(query) ||
        clause.requirementText.toLowerCase().includes(query),
    );
  }, [allClauses, filter]);

  const clause = selected === '' ? undefined : getClauseByNumber(standardId, selected);
  const related = clause ? getRelatedClauses(standardId, clause.number) : [];

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
            {standard.name} Wiki
          </h1>
          <p className="text-sm text-text-secondary">{standard.discipline}</p>
        </div>
        <div className="w-full sm:w-80">
          <Select
            id="wiki-standard"
            label="Standard"
            value={standardId}
            onChange={(event) => setStandardId(event.target.value as StandardId)}
          >
            {STANDARDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.isAvailable ? '' : ' — coming soon'}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!standard.isAvailable ? (
        <Card>
          <CardBody className="flex flex-col gap-sm py-lg text-center">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {standard.name} is not authored yet
            </h2>
            <p className="mx-auto max-w-prose text-sm text-text-secondary">
              {standard.shortName} is on the roadmap for {standard.discipline}. Its clause dataset
              has not been written, so there is no guidance to show and audits cannot yet be run
              against it.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-[20rem_1fr]">
          <Card className="max-h-[70vh] overflow-y-auto">
            <CardBody className="flex flex-col gap-sm">
              <Input
                id="wiki-filter"
                placeholder="Filter clauses…"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              {filtered.length === 0 ? (
                <p className="px-sm py-md text-sm text-text-secondary">
                  No clause matches “{filter.trim()}”.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {filtered.map((item) => (
                    <li key={item.number}>
                      <button
                        onClick={() => setSelected(item.number)}
                        className={`flex w-full items-baseline gap-sm rounded px-sm py-1 text-left text-sm transition-colors ${
                          item.number === selected
                            ? 'bg-primary-50 text-primary-700'
                            : 'hover:bg-background'
                        }`}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                      >
                        <span className="font-mono text-xs font-semibold">{item.number}</span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            {clause ? (
              <>
                <CardHeader>
                  <CardTitle>
                    <span className="font-mono text-primary-700">{clause.number}</span>{' '}
                    {clause.title}
                  </CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-md text-sm">
                  <section>
                    <h3 className="mb-1 font-display font-semibold text-text-primary">
                      Requirement
                    </h3>
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
                        {related.map((item: StandardClause) => (
                          <button key={item.number} onClick={() => setSelected(item.number)}>
                            <Badge tone="primary">{item.number}</Badge>
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
      )}
    </div>
  );
}

function WikiList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 font-display font-semibold text-text-primary">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
