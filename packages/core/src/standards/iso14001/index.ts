import type { StandardDefinition } from '../types';
import { ISO14001_CLAUSES } from './clauses';

export { ISO14001_CLAUSES };

/**
 * ISO 14001:2015 — Environmental management systems. ROADMAP PLACEHOLDER.
 *
 * Registered but not yet built: `isAvailable` is `false` and the clause dataset
 * is empty. The prompt profile is authored ahead of the clause data so the AI
 * co-pilot is coherent from the moment the clauses land.
 */
export const ISO14001: StandardDefinition = {
  id: 'iso14001',
  name: 'ISO 14001:2015',
  shortName: 'ISO 14001',
  edition: '2015',
  discipline: 'Environmental',
  isAvailable: false,
  clauses: ISO14001_CLAUSES,
  topLevelNumbers: ['4', '5', '6', '7', '8', '9', '10'],
  prompt: {
    personaName: 'ARIA',
    expertiseLines: [
      'Deep knowledge of ISO 14001:2015 text, intent, and application',
      'ISO 19011:2018 audit methodology and best practices',
      'Environmental aspect and impact identification and evaluation',
      'Compliance obligations and legal register management',
      'Life-cycle perspective applied to environmental controls',
    ],
    relatedStandards: ['ISO 19011:2018', 'ISO 14004', 'ISO 14031'],
    riskMethodologies: [
      'Environmental aspect/impact register',
      'Significance scoring',
      'Life-cycle assessment',
    ],
  },
};
