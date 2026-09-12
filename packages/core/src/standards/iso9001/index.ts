import type { StandardDefinition } from '../types';
import { ISO9001_CLAUSES } from './clauses';

export { ISO9001_CLAUSES };

/**
 * ISO 9001:2015 — Quality management systems. ROADMAP PLACEHOLDER.
 *
 * Registered but not yet built: `isAvailable` is `false` and the clause dataset
 * is empty. The prompt profile is authored ahead of the clause data so the AI
 * co-pilot is coherent from the moment the clauses land.
 */
export const ISO9001: StandardDefinition = {
  id: 'iso9001',
  name: 'ISO 9001:2015',
  shortName: 'ISO 9001',
  edition: '2015',
  discipline: 'Quality',
  isAvailable: false,
  clauses: ISO9001_CLAUSES,
  topLevelNumbers: ['4', '5', '6', '7', '8', '9', '10'],
  prompt: {
    personaName: 'ARIA',
    expertiseLines: [
      'Deep knowledge of ISO 9001:2015 text, intent, and application',
      'ISO 19011:2018 audit methodology and best practices',
      'Process approach, PDCA, and risk-based thinking',
      'Customer focus, satisfaction measurement, and complaint handling',
      'Control of externally provided processes, products, and services',
    ],
    relatedStandards: ['ISO 19011:2018', 'ISO 9000:2015', 'ISO 9004'],
    riskMethodologies: [
      'Process risk and opportunity register',
      'FMEA',
      'Turtle diagram process analysis',
    ],
  },
};
