import {
  buildReminderEmail,
  reminderOffsetDueToday,
  selectDueReminders,
} from '../notifications/caReminders';

const NOW = new Date('2026-06-27T08:00:00.000Z');

describe('reminderOffsetDueToday', () => {
  it('returns the offset when the due date is exactly 30/14/7 days away', () => {
    expect(reminderOffsetDueToday('2026-07-27', NOW)).toBe(30);
    expect(reminderOffsetDueToday('2026-07-11', NOW)).toBe(14);
    expect(reminderOffsetDueToday('2026-07-04', NOW)).toBe(7);
  });

  it('returns null when no reminder is due today', () => {
    expect(reminderOffsetDueToday('2026-07-10', NOW)).toBeNull();
    expect(reminderOffsetDueToday('2026-06-27', NOW)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    expect(reminderOffsetDueToday('not-a-date', NOW)).toBeNull();
  });
});

describe('selectDueReminders', () => {
  it('selects only open findings whose reminder is due today', () => {
    const due = selectDueReminders(
      [
        {
          id: 'f1',
          tenantId: 't1',
          findingNumber: 'NCR-2026-001',
          title: 'A',
          status: 'open',
          targetClosureDate: '2026-07-04',
        },
        {
          id: 'f2',
          tenantId: 't1',
          findingNumber: 'NCR-2026-002',
          title: 'B',
          status: 'closed',
          targetClosureDate: '2026-07-04',
        },
        {
          id: 'f3',
          tenantId: 't1',
          findingNumber: 'NCR-2026-003',
          title: 'C',
          status: 'open',
          targetClosureDate: '2026-07-10',
        },
        {
          id: 'f4',
          tenantId: 't1',
          findingNumber: 'NCR-2026-004',
          title: 'D',
          status: 'open',
        },
      ],
      NOW,
    );

    expect(due).toHaveLength(1);
    expect(due[0]?.finding.id).toBe('f1');
    expect(due[0]?.offsetDays).toBe(7);
  });
});

describe('buildReminderEmail', () => {
  it('produces a subject and body referencing the finding and offset', () => {
    const email = buildReminderEmail({
      finding: {
        id: 'f1',
        tenantId: 't1',
        findingNumber: 'NCR-2026-001',
        title: 'Hazard gap',
        targetClosureDate: '2026-07-04',
      },
      offsetDays: 7,
    });
    expect(email.subject).toContain('NCR-2026-001');
    expect(email.subject).toContain('7 days');
    expect(email.text).toContain('Hazard gap');
  });
});
