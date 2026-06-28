import { SoteriaStrings, AI_DISCLAIMER } from '../constants/strings';

describe('SoteriaStrings', () => {
  it('groups copy by feature area', () => {
    expect(SoteriaStrings.common).toBeDefined();
    expect(SoteriaStrings.auth).toBeDefined();
    expect(SoteriaStrings.audit).toBeDefined();
    expect(SoteriaStrings.findings).toBeDefined();
    expect(SoteriaStrings.evidence).toBeDefined();
    expect(SoteriaStrings.meetings).toBeDefined();
    expect(SoteriaStrings.correctiveActions).toBeDefined();
    expect(SoteriaStrings.ai).toBeDefined();
    expect(SoteriaStrings.errors).toBeDefined();
  });

  it('exposes the AI disclaimer verbatim (multi-agent-guide §8)', () => {
    expect(AI_DISCLAIMER).toBe('AI-generated — auditor must review and approve');
    expect(SoteriaStrings.ai.disclaimer).toBe(AI_DISCLAIMER);
  });

  it('contains no empty string values', () => {
    const walk = (obj: Record<string, unknown>): void => {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        } else if (value && typeof value === 'object') {
          walk(value as Record<string, unknown>);
        }
      }
    };
    walk(SoteriaStrings);
  });
});
