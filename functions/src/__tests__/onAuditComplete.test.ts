import { summariseFindings } from '../audit/onAuditComplete';

describe('summariseFindings', () => {
  it('aggregates counts by type and NC open/closed state', () => {
    const summary = summariseFindings([
      { type: 'major_nc', status: 'open' },
      { type: 'major_nc', status: 'closed' },
      { type: 'minor_nc', status: 'acknowledged' },
      { type: 'ofi', status: 'open' },
      { type: 'strong_point', status: 'open' },
      { type: 'observation', status: 'open' },
    ]);

    expect(summary.totalFindings).toBe(6);
    expect(summary.majorNCs).toBe(2);
    expect(summary.minorNCs).toBe(1);
    expect(summary.ofis).toBe(1);
    expect(summary.strongPoints).toBe(1);
    expect(summary.observations).toBe(1);
    expect(summary.closedNCs).toBe(1);
    expect(summary.openNCs).toBe(2);
  });

  it('handles an empty finding list', () => {
    const summary = summariseFindings([]);
    expect(summary.totalFindings).toBe(0);
    expect(summary.openNCs).toBe(0);
  });
});
