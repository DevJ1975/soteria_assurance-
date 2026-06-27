import {
  calculateTargetClosureDate,
  getReminderDates,
  isOverdue,
  daysBetween,
  REMINDER_OFFSETS_DAYS,
} from '../utils/deadlines';

describe('calculateTargetClosureDate', () => {
  const raisedAt = new Date('2026-01-01T00:00:00Z');

  it('returns raisedAt + 60 days for a major nonconformity', () => {
    const due = calculateTargetClosureDate('major_nc', raisedAt);
    expect(due).not.toBeNull();
    expect(daysBetween(raisedAt, due as Date)).toBe(60);
  });

  it('returns raisedAt + 90 days for a minor nonconformity', () => {
    const due = calculateTargetClosureDate('minor_nc', raisedAt);
    expect(due).not.toBeNull();
    expect(daysBetween(raisedAt, due as Date)).toBe(90);
  });

  it('returns null for OFI, strong point and observation', () => {
    expect(calculateTargetClosureDate('ofi', raisedAt)).toBeNull();
    expect(calculateTargetClosureDate('strong_point', raisedAt)).toBeNull();
    expect(calculateTargetClosureDate('observation', raisedAt)).toBeNull();
  });
});

describe('getReminderDates', () => {
  const due = new Date('2026-04-01T00:00:00Z');

  it('returns reminders 30, 14 and 7 days before the due date', () => {
    const reminders = getReminderDates(due);
    expect(reminders).toHaveLength(REMINDER_OFFSETS_DAYS.length);
    expect(daysBetween(reminders[0] as Date, due)).toBe(30);
    expect(daysBetween(reminders[1] as Date, due)).toBe(14);
    expect(daysBetween(reminders[2] as Date, due)).toBe(7);
  });

  it('produces reminders strictly before the due date', () => {
    for (const reminder of getReminderDates(due)) {
      expect(reminder.getTime()).toBeLessThan(due.getTime());
    }
  });
});

describe('isOverdue', () => {
  it('is true when due is before now', () => {
    expect(
      isOverdue(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z')),
    ).toBe(true);
  });

  it('is false when due is after now', () => {
    expect(
      isOverdue(new Date('2026-01-03T00:00:00Z'), new Date('2026-01-02T00:00:00Z')),
    ).toBe(false);
  });

  it('is false at the exact due moment (not strictly before)', () => {
    const moment = new Date('2026-01-02T00:00:00Z');
    expect(isOverdue(moment, new Date(moment.getTime()))).toBe(false);
  });
});

describe('daysBetween', () => {
  it('returns a positive count when b is after a', () => {
    expect(
      daysBetween(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-11T00:00:00Z')),
    ).toBe(10);
  });

  it('returns a negative count when b is before a', () => {
    expect(
      daysBetween(new Date('2026-01-11T00:00:00Z'), new Date('2026-01-01T00:00:00Z')),
    ).toBe(-10);
  });

  it('returns 0 for the same calendar day regardless of time of day', () => {
    expect(
      daysBetween(new Date('2026-01-01T01:00:00Z'), new Date('2026-01-01T23:00:00Z')),
    ).toBe(0);
  });
});
