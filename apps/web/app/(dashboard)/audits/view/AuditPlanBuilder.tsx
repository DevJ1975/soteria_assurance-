'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import type {
  Audit,
  AuditInspectionArea,
  AuditInterviewee,
  AuditPlan,
  AuditPlanActivity,
} from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useUpdateAudit } from '@/lib/hooks';

const EMPTY_PLAN: AuditPlan = {
  activities: [],
  documentReviewList: [],
  intervieweeList: [],
  areaInspectionList: [],
};

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

/**
 * Builds the audit plan (ISO 19011 §6.3.2).
 *
 * WHY THIS EXISTS
 * `audits.audit_plan` was written ONCE by the New Audit wizard as a hardcoded
 * empty structure and no code path ever updated it — there is no `updateAudit`
 * anywhere in the web app until now. The mobile plan screen is a read view, so
 * it rendered "No plan activities scheduled yet" unconditionally, forever.
 *
 * The consequence is not a missing screen: there was no audit plan to issue to
 * the auditee and no schedule to conduct the audit against, which is the
 * deliverable §6.3.2 is about.
 *
 * Clause references are free text rather than a picker. An audit plan is
 * written before fieldwork, often against clause groups ("8.1") rather than
 * leaves, and forcing a valid leaf clause here would make the plan harder to
 * write than it is on paper. Findings — where a wrong clause is actually
 * damaging — are validated against the dataset instead.
 */
export function AuditPlanBuilder({ audit }: { audit: Audit }) {
  const updateAudit = useUpdateAudit();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<AuditPlan>({ ...EMPTY_PLAN, ...audit.auditPlan });
  const [documents, setDocuments] = useState(
    (audit.auditPlan?.documentReviewList ?? []).join('\n'),
  );
  const [error, setError] = useState<string | null>(null);

  const activities = plan.activities ?? [];
  const interviewees = plan.intervieweeList ?? [];
  const areas = plan.areaInspectionList ?? [];

  function patch<K extends keyof AuditPlan>(key: K, value: AuditPlan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
  }

  async function onSave() {
    setError(null);
    try {
      await updateAudit.mutateAsync({
        auditId: audit.id,
        patch: {
          auditPlan: {
            ...plan,
            documentReviewList: documents
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line !== ''),
          },
        },
      });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  const total =
    activities.length + interviewees.length + areas.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Audit plan</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Done' : total === 0 ? 'Build plan' : 'Edit plan'}
        </Button>
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        {!open ? (
          total === 0 ? (
            <p className="text-sm text-text-secondary">
              No plan yet. The plan is what you issue to the auditee and conduct against.
            </p>
          ) : (
            <div className="flex flex-wrap gap-md text-sm text-text-secondary">
              <span>{activities.length} activities</span>
              <span>{interviewees.length} interviewees</span>
              <span>{areas.length} inspection areas</span>
              <span>{(plan.documentReviewList ?? []).length} documents</span>
            </div>
          )
        ) : (
          <>
            {/* ---- Activities ---- */}
            <Section
              title="Schedule"
              onAdd={() =>
                patch('activities', [
                  ...activities,
                  {
                    activityId: crypto.randomUUID(),
                    time: '09:00',
                    duration: 60,
                    activity: '',
                    clauses: [],
                    location: '',
                    auditorIds: [],
                    intervieweeIds: [],
                  } satisfies AuditPlanActivity,
                ])
              }
            >
              {activities.map((activity, index) => (
                <Row
                  key={activity.activityId}
                  onRemove={() =>
                    patch(
                      'activities',
                      activities.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Input
                    label={index === 0 ? 'Time' : undefined}
                    type="time"
                    value={activity.time}
                    onChange={(event) =>
                      patch(
                        'activities',
                        activities.map((a, i) =>
                          i === index ? { ...a, time: event.target.value } : a,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Activity' : undefined}
                    value={activity.activity}
                    onChange={(event) =>
                      patch(
                        'activities',
                        activities.map((a, i) =>
                          i === index ? { ...a, activity: event.target.value } : a,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Clauses' : undefined}
                    placeholder="5.1, 5.4"
                    value={activity.clauses.join(', ')}
                    onChange={(event) =>
                      patch(
                        'activities',
                        activities.map((a, i) =>
                          i === index ? { ...a, clauses: csv(event.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Location' : undefined}
                    value={activity.location}
                    onChange={(event) =>
                      patch(
                        'activities',
                        activities.map((a, i) =>
                          i === index ? { ...a, location: event.target.value } : a,
                        ),
                      )
                    }
                  />
                </Row>
              ))}
            </Section>

            {/* ---- Interviewees ---- */}
            <Section
              title="Interviewees"
              onAdd={() =>
                patch('intervieweeList', [
                  ...interviewees,
                  {
                    intervieweeId: crypto.randomUUID(),
                    name: '',
                    jobTitle: '',
                    department: '',
                    topics: [],
                  } satisfies AuditInterviewee,
                ])
              }
            >
              {interviewees.map((person, index) => (
                <Row
                  key={person.intervieweeId}
                  onRemove={() =>
                    patch(
                      'intervieweeList',
                      interviewees.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Input
                    label={index === 0 ? 'Name' : undefined}
                    value={person.name}
                    onChange={(event) =>
                      patch(
                        'intervieweeList',
                        interviewees.map((p, i) =>
                          i === index ? { ...p, name: event.target.value } : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Job title' : undefined}
                    value={person.jobTitle}
                    onChange={(event) =>
                      patch(
                        'intervieweeList',
                        interviewees.map((p, i) =>
                          i === index ? { ...p, jobTitle: event.target.value } : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Department' : undefined}
                    value={person.department}
                    onChange={(event) =>
                      patch(
                        'intervieweeList',
                        interviewees.map((p, i) =>
                          i === index ? { ...p, department: event.target.value } : p,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Topics' : undefined}
                    placeholder="5.4, worker consultation"
                    value={person.topics.join(', ')}
                    onChange={(event) =>
                      patch(
                        'intervieweeList',
                        interviewees.map((p, i) =>
                          i === index ? { ...p, topics: csv(event.target.value) } : p,
                        ),
                      )
                    }
                  />
                </Row>
              ))}
            </Section>

            {/* ---- Inspection areas ---- */}
            <Section
              title="Inspection areas"
              onAdd={() =>
                patch('areaInspectionList', [
                  ...areas,
                  {
                    areaId: crypto.randomUUID(),
                    name: '',
                    hazards: [],
                    clauses: [],
                  } satisfies AuditInspectionArea,
                ])
              }
            >
              {areas.map((area, index) => (
                <Row
                  key={area.areaId}
                  onRemove={() =>
                    patch(
                      'areaInspectionList',
                      areas.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Input
                    label={index === 0 ? 'Area' : undefined}
                    value={area.name}
                    onChange={(event) =>
                      patch(
                        'areaInspectionList',
                        areas.map((a, i) =>
                          i === index ? { ...a, name: event.target.value } : a,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Hazards' : undefined}
                    placeholder="welding fume, noise"
                    value={area.hazards.join(', ')}
                    onChange={(event) =>
                      patch(
                        'areaInspectionList',
                        areas.map((a, i) =>
                          i === index ? { ...a, hazards: csv(event.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <Input
                    label={index === 0 ? 'Clauses' : undefined}
                    placeholder="8.1, 8.1.2"
                    value={area.clauses.join(', ')}
                    onChange={(event) =>
                      patch(
                        'areaInspectionList',
                        areas.map((a, i) =>
                          i === index ? { ...a, clauses: csv(event.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <div />
                </Row>
              ))}
            </Section>

            <Textarea
              label="Documents to review (one per line)"
              rows={4}
              value={documents}
              onChange={(event) => setDocuments(event.target.value)}
            />

            {error !== null ? <ErrorState message={error} /> : null}

            <div className="flex justify-end gap-sm">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {SoteriaStrings.common.cancel}
              </Button>
              <Button loading={updateAudit.isPending} onClick={onSave}>
                {SoteriaStrings.common.save}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Section({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      {children}
    </div>
  );
}

function Row({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-end gap-sm md:grid-cols-[1fr_2fr_1.5fr_1.5fr_auto]">
      {children}
      <button
        type="button"
        aria-label="Remove"
        className="pb-2 text-text-muted hover:text-major-nc"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
